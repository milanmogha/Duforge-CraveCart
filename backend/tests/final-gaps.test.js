import { describe, it, expect, beforeEach } from 'vitest';
import { api, auth, login, makeUser, makeProduct, setSetting } from './helpers.js';
import { Ticket } from '../src/models/Misc.js';

// The last five v1 methods, found by sweeping all 95 in Api.php against the v2 route table:
// get_rider_rating, get_order_rating, edit_ticket, get_delivery_charges, ipn (PayPal webhook).

let customer, partner, rider, product, cToken, pToken, rToken, order;

async function deliverAnOrder() {
  const addr = await api()
    .post('/api/auth/addresses')
    .set(auth(cToken))
    .send({ label: 'Home', line1: '1 St', city: 'Testville', pincode: '110001' });

  await api().post('/api/cart').set(auth(cToken)).send({ productId: product._id, qty: 1 });
  const placed = await api()
    .post('/api/orders')
    .set(auth(cToken))
    .send({ addressId: addr.body.addresses.at(-1)._id, paymentMethod: 'cod' });

  const id = placed.body.orders[0]._id;
  const move = (status, tk) => api().put(`/api/orders/${id}/status`).set(auth(tk)).send({ status });

  await move('confirmed', pToken);
  await move('preparing', pToken);
  await move('ready', pToken);
  await api().post(`/api/orders/${id}/accept`).set(auth(rToken));
  await move('picked_up', rToken);
  await move('out_for_delivery', rToken);
  await move('delivered', rToken);
  return placed.body.orders[0];
}

beforeEach(async () => {
  partner = await makeUser({
    role: 'partner',
    partnerProfile: { storeName: 'Corner Store', slug: 'corner', kycStatus: 'approved', isOpen: true, deliveryCharge: 40, freeDeliveryAbove: 500 },
  });
  rider = await makeUser({ role: 'rider' });
  customer = await makeUser({ role: 'customer' });
  product = await makeProduct(partner, { price: 100, stock: 50 });

  cToken = await login(customer.email, 'pass1234', 'customer');
  pToken = await login(partner.email, 'pass1234', 'partner');
  rToken = await login(rider.email, 'pass1234', 'rider');
});

describe('rider rating is visible to the customer (v1 get_rider_rating)', () => {
  it('returns the rider\'s rating on the order, not just their vehicle', async () => {
    order = await deliverAnOrder();
    await api().post(`/api/orders/${order._id}/rate`).set(auth(cToken)).send({ rating: 5, riderRating: 4 });

    // A second customer sees the rider's accumulated rating before the delivery.
    const other = await makeUser({ role: 'customer' });
    const oToken = await login(other.email, 'pass1234', 'customer');
    const oAddr = await api().post('/api/auth/addresses').set(auth(oToken))
      .send({ label: 'Home', line1: '2 St', city: 'Testville', pincode: '110001' });
    await api().post('/api/cart').set(auth(oToken)).send({ productId: product._id, qty: 1 });
    const placed = await api().post('/api/orders').set(auth(oToken))
      .send({ addressId: oAddr.body.addresses.at(-1)._id, paymentMethod: 'cod' });

    const id = placed.body.orders[0]._id;
    await api().put(`/api/orders/${id}/status`).set(auth(pToken)).send({ status: 'confirmed' });
    await api().post(`/api/orders/${id}/accept`).set(auth(rToken));

    const res = await api().get(`/api/orders/${id}`).set(auth(oToken));
    expect(res.body.order.rider.riderProfile.ratingAvg).toBe(4);
    expect(res.body.order.rider.riderProfile.ratingCount).toBe(1);
  });
});

describe('reading back a rating (v1 get_order_rating / get_product_rating)', () => {
  it('returns nothing before the order is rated', async () => {
    order = await deliverAnOrder();

    const res = await api().get(`/api/orders/${order._id}/rate`).set(auth(cToken));
    expect(res.status).toBe(200);
    expect(res.body.rated).toBe(false);
    expect(res.body.order).toBeNull();
  });

  it('returns the store, rider and product ratings the customer left', async () => {
    order = await deliverAnOrder();
    await api()
      .post(`/api/orders/${order._id}/rate`)
      .set(auth(cToken))
      .send({ rating: 5, comment: 'great', riderRating: 3, riderComment: 'slow' });

    const res = await api().get(`/api/orders/${order._id}/rate`).set(auth(cToken));
    expect(res.body.rated).toBe(true);
    expect(res.body.order).toMatchObject({ rating: 5, comment: 'great' });
    expect(res.body.rider).toMatchObject({ rating: 3, comment: 'slow' });
    expect(res.body.products).toHaveLength(1);
  });

  it('refuses a stranger', async () => {
    order = await deliverAnOrder();
    const stranger = await makeUser({ role: 'customer' });
    const sToken = await login(stranger.email, 'pass1234', 'customer');

    const res = await api().get(`/api/orders/${order._id}/rate`).set(auth(sToken));
    expect(res.status).toBe(403);
  });
});

describe('editing a ticket (v1 edit_ticket)', () => {
  const openTicket = () =>
    api().post('/api/support/tickets').set(auth(cToken)).send({ subject: 'Wrong item', message: 'Got the wrong thing', type: 'order' });

  it('lets the owner correct an open ticket, including the opening message', async () => {
    const t = await openTicket();

    const res = await api()
      .put(`/api/support/tickets/${t.body.ticket._id}`)
      .set(auth(cToken))
      .send({ subject: 'Wrong item — updated', message: 'Actually it was missing' });

    expect(res.status).toBe(200);
    expect(res.body.ticket.subject).toBe('Wrong item — updated');
    expect(res.body.ticket.messages[0].message).toBe('Actually it was missing');
  });

  it('freezes the ticket once it is closed, so a resolved thread cannot be rewritten', async () => {
    const t = await openTicket();
    await Ticket.updateOne({ _id: t.body.ticket._id }, { status: 'closed' });

    const res = await api()
      .put(`/api/support/tickets/${t.body.ticket._id}`)
      .set(auth(cToken))
      .send({ subject: 'sneaky rewrite' });

    expect(res.status).toBe(400);
  });

  it('refuses someone else\'s ticket', async () => {
    const t = await openTicket();
    const stranger = await makeUser({ role: 'customer' });
    const sToken = await login(stranger.email, 'pass1234', 'customer');

    const res = await api()
      .put(`/api/support/tickets/${t.body.ticket._id}`)
      .set(auth(sToken))
      .send({ subject: 'not mine' });

    expect(res.status).toBe(403);
  });
});

describe('delivery charges (v1 get_delivery_charges)', () => {
  it('quotes a store\'s delivery charge before anything is in the cart', async () => {
    const res = await api().get(`/api/catalog/delivery-charges?partner=${partner._id}`);
    expect(res.status).toBe(200);
    expect(res.body.charge).toMatchObject({
      storeName: 'Corner Store',
      deliveryCharge: 40,
      freeDeliveryAbove: 500,
      payable: null, // unknowable without a basket value
    });
  });

  it('applies the free-delivery threshold when a subtotal is supplied', async () => {
    const under = await api().get(`/api/catalog/delivery-charges?partner=${partner._id}&subtotal=100`);
    expect(under.body.charge.payable).toBe(40);

    const over = await api().get(`/api/catalog/delivery-charges?partner=${partner._id}&subtotal=600`);
    expect(over.body.charge.payable).toBe(0);
  });

  it('agrees with what the cart actually bills — the two must not drift apart', async () => {
    await api().post('/api/cart').set(auth(cToken)).send({ productId: product._id, qty: 1 }); // 100

    const cart = await api().get('/api/cart').set(auth(cToken));
    const quote = await api().get(`/api/catalog/delivery-charges?partner=${partner._id}&subtotal=100`);

    expect(quote.body.charge.payable).toBe(cart.body.groups[0].deliveryCharge);
  });

  it('404s an unknown partner', async () => {
    const res = await api().get('/api/catalog/delivery-charges?partner=6a51e32d8a3e6144833349da');
    expect(res.status).toBe(404);
  });
});

describe('PayPal webhook (v1 ipn)', () => {
  it('refuses when no webhook id is configured — there is nothing to verify against', async () => {
    const res = await api()
      .post('/api/payments/webhook/paypal')
      .send({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} });

    expect(res.status).toBe(503);
  });

  it('is registered as a route', async () => {
    await setSetting('paypalWebhookId', 'WH-TEST');
    // With a webhook id but no client id it still refuses, rather than 404ing.
    const res = await api().post('/api/payments/webhook/paypal').send({});
    expect(res.status).not.toBe(404);
  });
});
