import { describe, it, expect, beforeEach } from 'vitest';
import { api, auth, login, makeUser, makeProduct, setSetting } from './helpers.js';
import User from '../src/models/User.js';

// v1 process_referral_bonus(): on delivery, credit the *referrer* — flat or a capped
// percentage — for the buyer's first N orders, above a minimum order value.

let partner, rider, product, referrer;

async function deliverAnOrderFor(customer) {
  const cToken = await login(customer.email, 'pass1234', 'customer');
  const pToken = await login(partner.email, 'pass1234', 'partner');
  const rToken = await login(rider.email, 'pass1234', 'rider');

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

const balanceOf = async (u) => (await User.findById(u._id)).walletBalance;

beforeEach(async () => {
  partner = await makeUser({ role: 'partner' });
  rider = await makeUser({ role: 'rider' });
  product = await makeProduct(partner, { price: 500, stock: 100 });
  referrer = await makeUser({ role: 'customer', referralCode: 'FRIEND1' });
});

describe('referral payout', () => {
  it('pays nothing while the programme is switched off', async () => {
    const referred = await makeUser({ role: 'customer', referredBy: referrer._id });
    await deliverAnOrderFor(referred);

    expect(await balanceOf(referrer)).toBe(0);
  });

  it('credits the referrer a flat bonus when the referred customer\'s order is delivered', async () => {
    await setSetting('referralAmount', 50);

    const referred = await makeUser({ role: 'customer', referredBy: referrer._id });
    await deliverAnOrderFor(referred);

    expect(await balanceOf(referrer)).toBe(50);
  });

  it('pays nothing for a customer who was not referred', async () => {
    await setSetting('referralAmount', 50);

    const walkIn = await makeUser({ role: 'customer' });
    await deliverAnOrderFor(walkIn);

    expect(await balanceOf(referrer)).toBe(0);
  });

  it('honours the minimum order value', async () => {
    await setSetting('referralAmount', 50);
    await setSetting('referralMinOrder', 10_000); // far above this order

    const referred = await makeUser({ role: 'customer', referredBy: referrer._id });
    await deliverAnOrderFor(referred);

    expect(await balanceOf(referrer)).toBe(0);
  });

  it('pays a percentage of the order, capped (v1 refer_earn_method = percentage)', async () => {
    await setSetting('referralAmount', 10); // 10%
    await setSetting('referralMethod', 'percentage');
    await setSetting('referralMaxAmount', 30);

    const referred = await makeUser({ role: 'customer', referredBy: referrer._id });
    const order = await deliverAnOrderFor(referred);

    // 10% of the grand total would exceed the ₹30 cap, so the cap applies.
    expect(order.grandTotal * 0.1).toBeGreaterThan(30);
    expect(await balanceOf(referrer)).toBe(30);
  });

  it('pays only for the buyer\'s first order by default', async () => {
    await setSetting('referralAmount', 50);

    const referred = await makeUser({ role: 'customer', referredBy: referrer._id });
    await deliverAnOrderFor(referred);
    await deliverAnOrderFor(referred); // second order — no further bonus

    expect(await balanceOf(referrer)).toBe(50);
  });

  it('pays across the first N orders when bonusTimes is raised (v1 refer_earn_bonus_times)', async () => {
    await setSetting('referralAmount', 50);
    await setSetting('referralBonusTimes', 2);

    const referred = await makeUser({ role: 'customer', referredBy: referrer._id });
    await deliverAnOrderFor(referred);
    await deliverAnOrderFor(referred);
    await deliverAnOrderFor(referred); // third is past the limit

    expect(await balanceOf(referrer)).toBe(100);
  });
});

describe('referral code validation (v1 validate_refer_code)', () => {
  it('accepts a real code and rejects an unknown one', async () => {
    // Like v1, the endpoint answers 200 either way and reports validity in the body.
    const good = await api().get('/api/auth/validate-refer-code?code=FRIEND1');
    expect(good.body).toMatchObject({ valid: true, referrerName: referrer.name });

    const bad = await api().get('/api/auth/validate-refer-code?code=NOPE');
    expect(bad.body.valid).toBe(false);
  });

  it('records who referred a new signup', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({
        name: 'Referred', email: 'ref@test.cravecart', phone: '9700000123',
        password: 'pass1234', referralCode: 'FRIEND1',
      });
    expect(res.status).toBe(201);

    const created = await User.findById(res.body.user._id);
    expect(String(created.referredBy)).toBe(String(referrer._id));
  });
});
