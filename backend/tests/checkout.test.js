import { describe, it, expect, beforeEach } from 'vitest';
import { api, auth, login, makeUser, makeProduct, setSetting } from './helpers.js';
import { PromoCode } from '../src/models/Order.js';
import { Product } from '../src/models/Catalog.js';
import User from '../src/models/User.js';

// Pricing is server-authoritative (services/checkout.js). These tests exist because a
// client that can influence what it is charged is the worst kind of migration regression.

let customer, partner, product, token, addressId;

beforeEach(async () => {
  partner = await makeUser({ role: 'partner' });
  product = await makeProduct(partner, { price: 100, stock: 10 });
  customer = await makeUser({ role: 'customer' });
  token = await login(customer.email, 'pass1234', 'customer');

  const res = await api()
    .post('/api/auth/addresses')
    .set(auth(token))
    .send({ label: 'Home', line1: '1 Test St', city: 'Testville', pincode: '110001' });
  addressId = res.body.addresses.at(-1)._id;
});

const addItem = (qty = 1) =>
  api().post('/api/cart').set(auth(token)).send({ productId: product._id, qty });

describe('cart pricing', () => {
  it('prices the cart from the database, not from anything the client sends', async () => {
    await addItem(2);
    const res = await api().get('/api/cart').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.groups[0].itemsTotal).toBe(200);
  });

  it('ignores a client-supplied price', async () => {
    await api()
      .post('/api/cart')
      .set(auth(token))
      .send({ productId: product._id, qty: 1, price: 1, lineTotal: 1 });

    const res = await api().get('/api/cart').set(auth(token));
    expect(res.body.groups[0].itemsTotal).toBe(100);
  });

  it('refuses a product that is not active', async () => {
    await Product.updateOne({ _id: product._id }, { status: 'draft' });
    const res = await addItem();
    expect(res.status).toBe(400);
  });
});

describe('placing an order', () => {
  it('places a COD order and decrements stock', async () => {
    await addItem(2);
    const res = await api()
      .post('/api/orders')
      .set(auth(token))
      .send({ addressId, paymentMethod: 'cod' });

    expect(res.status).toBe(201);
    const order = res.body.orders[0];
    expect(order.itemsTotal).toBe(200);
    expect(order.status).toBe('pending');

    const fresh = await Product.findById(product._id);
    expect(fresh.stock).toBe(8);
  });

  it('empties the cart once the order is placed', async () => {
    await addItem();
    await api().post('/api/orders').set(auth(token)).send({ addressId, paymentMethod: 'cod' });

    const cart = await api().get('/api/cart').set(auth(token));
    expect(cart.body.groups).toHaveLength(0);
  });

  it('rejects a gateway payment on this route — those must go through /api/payments', async () => {
    await addItem();
    const res = await api()
      .post('/api/orders')
      .set(auth(token))
      .send({ addressId, paymentMethod: 'stripe' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/payments api/i);
  });

  it('refuses a wallet payment the customer cannot afford', async () => {
    await addItem();
    const res = await api()
      .post('/api/orders')
      .set(auth(token))
      .send({ addressId, paymentMethod: 'wallet' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/balance/i);
  });

  it('debits the wallet when the customer can afford it', async () => {
    await User.updateOne({ _id: customer._id }, { walletBalance: 1000 });
    await addItem();

    const res = await api()
      .post('/api/orders')
      .set(auth(token))
      .send({ addressId, paymentMethod: 'wallet' });
    expect(res.status).toBe(201);

    const fresh = await User.findById(customer._id);
    expect(fresh.walletBalance).toBe(1000 - res.body.orders[0].grandTotal);
  });

  it('charges no delivery fee or tip on a self-pickup order', async () => {
    await addItem();
    const res = await api()
      .post('/api/orders')
      .set(auth(token))
      .send({ paymentMethod: 'cod', selfPickup: true, tip: 50 });

    expect(res.status).toBe(201);
    const order = res.body.orders[0];
    expect(order.deliveryCharge).toBe(0);
    expect(order.tip).toBe(0);
  });
});

describe('promo codes', () => {
  it('applies a valid promo and refuses one below its minimum order value', async () => {
    await PromoCode.create({
      code: 'SAVE50', type: 'flat', value: 50, minOrder: 150, active: true,
    });

    await addItem(1); // 100 — under the 150 minimum
    const tooSmall = await api().post('/api/orders/promo-check').set(auth(token)).send({ code: 'SAVE50' });
    expect(tooSmall.status).toBe(400);

    await addItem(1); // now 200
    const ok = await api().post('/api/orders/promo-check').set(auth(token)).send({ code: 'SAVE50' });
    expect(ok.status).toBe(200);
    expect(ok.body.discount).toBe(50);
  });

  it('rejects an unknown promo code', async () => {
    await addItem();
    const res = await api().post('/api/orders/promo-check').set(auth(token)).send({ code: 'NOPE' });
    expect(res.status).toBe(400);
  });

  it('rejects an inactive promo code', async () => {
    await PromoCode.create({ code: 'OFF', type: 'flat', value: 10, active: false });
    await addItem();
    const res = await api().post('/api/orders/promo-check').set(auth(token)).send({ code: 'OFF' });
    expect(res.status).toBe(400);
  });
});

describe('cart limits (v1 Web_setting: max_cart_items / min_cart_amount)', () => {
  it('enforces the minimum cart amount at checkout', async () => {
    await setSetting('minCartAmount', 500);
    await addItem(1); // 100

    const res = await api()
      .post('/api/orders')
      .set(auth(token))
      .send({ addressId, paymentMethod: 'cod' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/minimum/i);
  });
});
