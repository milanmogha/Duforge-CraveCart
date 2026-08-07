import { describe, it, expect, beforeEach } from 'vitest';
import { api, auth, login, makeUser, makeProduct } from './helpers.js';
import { Order } from '../src/models/Order.js';
import { Review } from '../src/models/Misc.js';
import User from '../src/models/User.js';

// The status machine (STATUS_TRANSITIONS in models/Order.js) decides who may move an
// order where. Getting it wrong is how a rider marks someone else's order delivered.

let customer, partner, rider, product;
let cToken, pToken, rToken;
let order;

async function placeOrder({ selfPickup = false } = {}) {
  const addr = await api()
    .post('/api/auth/addresses')
    .set(auth(cToken))
    .send({ label: 'Home', line1: '1 Test St', city: 'Testville', pincode: '110001' });

  await api().post('/api/cart').set(auth(cToken)).send({ productId: product._id, qty: 1 });

  const res = await api()
    .post('/api/orders')
    .set(auth(cToken))
    .send({
      addressId: selfPickup ? undefined : addr.body.addresses.at(-1)._id,
      paymentMethod: 'cod',
      selfPickup,
    });
  return res.body.orders[0];
}

/** Drive an order to a given status using whichever party is allowed to do it. */
async function advance(id, status, token) {
  return api().put(`/api/orders/${id}/status`).set(auth(token)).send({ status });
}

beforeEach(async () => {
  partner = await makeUser({ role: 'partner' });
  rider = await makeUser({ role: 'rider' });
  customer = await makeUser({ role: 'customer' });
  product = await makeProduct(partner, { price: 100 });

  cToken = await login(customer.email, 'pass1234', 'customer');
  pToken = await login(partner.email, 'pass1234', 'partner');
  rToken = await login(rider.email, 'pass1234', 'rider');

  order = await placeOrder();
});

describe('order status machine', () => {
  it('walks the happy path pending → confirmed → preparing → ready → delivered', async () => {
    expect((await advance(order._id, 'confirmed', pToken)).status).toBe(200);
    expect((await advance(order._id, 'preparing', pToken)).status).toBe(200);
    expect((await advance(order._id, 'ready', pToken)).status).toBe(200);

    await api().post(`/api/orders/${order._id}/accept`).set(auth(rToken)).expect(200);
    expect((await advance(order._id, 'picked_up', rToken)).status).toBe(200);
    expect((await advance(order._id, 'out_for_delivery', rToken)).status).toBe(200);

    const done = await advance(order._id, 'delivered', rToken);
    expect(done.status).toBe(200);
    expect(done.body.order.status).toBe('delivered');
  });

  it('refuses an illegal jump (pending straight to delivered)', async () => {
    // Use an admin: they pass the role and party checks, so what's left is the
    // transition rule itself — otherwise a 403 would mask a missing 400.
    const admin = await makeUser({ role: 'admin' });
    const aToken = await login(admin.email, 'pass1234', 'admin');

    const res = await advance(order._id, 'delivered', aToken);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot move from 'pending'/i);
  });

  it('refuses a status change from the wrong role — a customer cannot confirm their own order', async () => {
    const res = await advance(order._id, 'confirmed', cToken);
    expect(res.status).toBe(403);
  });

  it('refuses a status change from someone who is not a party to the order', async () => {
    const other = await makeUser({ role: 'partner' });
    const otherToken = await login(other.email, 'pass1234', 'partner');

    const res = await advance(order._id, 'confirmed', otherToken);
    expect(res.status).toBe(403);
  });

  it('lets the customer cancel while the order is still cancellable, but not after', async () => {
    expect((await advance(order._id, 'cancelled', cToken)).status).toBe(200);

    const second = await placeOrder();
    await advance(second._id, 'confirmed', pToken);
    await advance(second._id, 'preparing', pToken);
    await advance(second._id, 'ready', pToken);

    // 'ready' is past the cancellable window
    const late = await advance(second._id, 'cancelled', cToken);
    expect(late.status).toBe(400);
  });

  it('settles the partner wallet when the order is delivered', async () => {
    await advance(order._id, 'confirmed', pToken);
    await advance(order._id, 'preparing', pToken);
    await advance(order._id, 'ready', pToken);
    await api().post(`/api/orders/${order._id}/accept`).set(auth(rToken));
    await advance(order._id, 'picked_up', rToken);
    await advance(order._id, 'out_for_delivery', rToken);
    await advance(order._id, 'delivered', rToken);

    const freshPartner = await User.findById(partner._id);
    expect(freshPartner.walletBalance).toBeGreaterThan(0);

    const settled = await Order.findById(order._id);
    expect(settled.settled).toBe(true);
    expect(settled.paymentStatus).toBe('paid');
  });
});

describe('self-pickup', () => {
  it('is completed by the partner (ready → delivered) with no rider involved', async () => {
    const pickup = await placeOrder({ selfPickup: true });
    await advance(pickup._id, 'confirmed', pToken);
    await advance(pickup._id, 'preparing', pToken);
    await advance(pickup._id, 'ready', pToken);

    const res = await advance(pickup._id, 'delivered', pToken);
    expect(res.status).toBe(200);
    expect(res.body.order.rider).toBeFalsy();
  });

  it('is hidden from the riders\' available list', async () => {
    await placeOrder({ selfPickup: true });
    const res = await api().get('/api/orders/rider/available').set(auth(rToken));
    expect(res.body.orders.every((o) => !o.selfPickup)).toBe(true);
  });
});

describe('order access control', () => {
  it('refuses to show an order to a stranger', async () => {
    const stranger = await makeUser({ role: 'customer' });
    const sToken = await login(stranger.email, 'pass1234', 'customer');

    const res = await api().get(`/api/orders/${order._id}`).set(auth(sToken));
    expect(res.status).toBe(403);
  });
});

describe('invoice (v1 get_invoice_html)', () => {
  it('renders a printable document for a party to the order', async () => {
    const res = await api().get(`/api/orders/${order._id}/invoice`).set(auth(cToken));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toContain('INVOICE');
    expect(res.text).toContain(order.orderNumber);
  });

  it('refuses a stranger', async () => {
    const stranger = await makeUser({ role: 'customer' });
    const sToken = await login(stranger.email, 'pass1234', 'customer');

    const res = await api().get(`/api/orders/${order._id}/invoice`).set(auth(sToken));
    expect(res.status).toBe(403);
  });

  it('escapes user-controlled text rather than injecting it into the markup', async () => {
    await Order.updateOne({ _id: order._id }, { customerNote: '<script>alert(1)</script>' });

    const res = await api().get(`/api/orders/${order._id}/invoice`).set(auth(cToken));
    expect(res.text).not.toContain('<script>alert(1)</script>');
    expect(res.text).toContain('&lt;script&gt;');
  });
});

describe('ratings', () => {
  const deliver = async (id) => {
    await advance(id, 'confirmed', pToken);
    await advance(id, 'preparing', pToken);
    await advance(id, 'ready', pToken);
    await api().post(`/api/orders/${id}/accept`).set(auth(rToken));
    await advance(id, 'picked_up', rToken);
    await advance(id, 'out_for_delivery', rToken);
    await advance(id, 'delivered', rToken);
  };

  it('records a rating and raises the partner average', async () => {
    await deliver(order._id);

    const res = await api()
      .post(`/api/orders/${order._id}/rate`)
      .set(auth(cToken))
      .send({ rating: 5, comment: 'great', riderRating: 4 });
    expect(res.status).toBe(200);

    const p = await User.findById(partner._id);
    expect(p.partnerProfile.ratingAvg).toBe(5);
    expect(p.partnerProfile.ratingCount).toBe(1);

    const r = await User.findById(rider._id);
    expect(r.riderProfile.ratingAvg).toBe(4);
  });

  it('refuses to rate an order that has not been delivered', async () => {
    const res = await api().post(`/api/orders/${order._id}/rate`).set(auth(cToken)).send({ rating: 5 });
    expect(res.status).toBe(400);
  });

  it('unwinds the averages when a rating is deleted, so they do not drift upward', async () => {
    await deliver(order._id);
    await api().post(`/api/orders/${order._id}/rate`).set(auth(cToken)).send({ rating: 5, riderRating: 5 });

    const res = await api().delete(`/api/orders/${order._id}/rate`).set(auth(cToken));
    expect(res.status).toBe(200);

    const p = await User.findById(partner._id);
    expect(p.partnerProfile.ratingCount).toBe(0);
    expect(p.partnerProfile.ratingAvg).toBe(0);
    expect(await Review.countDocuments({ order: order._id })).toBe(0);
  });
});

describe('removing an order from history (v1 delete_order)', () => {
  it('hides a cancelled order from the customer without destroying the record', async () => {
    await advance(order._id, 'cancelled', cToken);

    await api().delete(`/api/orders/${order._id}`).set(auth(cToken)).expect(200);

    const list = await api().get('/api/orders/my').set(auth(cToken));
    expect(list.body.orders.find((o) => o._id === order._id)).toBeUndefined();

    // still on the books for the partner/admin ledgers
    expect(await Order.findById(order._id)).not.toBeNull();
  });

  it('refuses to remove an order that is still in flight', async () => {
    const res = await api().delete(`/api/orders/${order._id}`).set(auth(cToken));
    expect(res.status).toBe(400);
  });
});
