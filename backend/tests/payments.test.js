import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import { api, auth, login, makeUser, setSetting } from './helpers.js';
import { Payment } from '../src/models/Finance.js';
import User from '../src/models/User.js';

// A webhook is an unauthenticated request that can move money. These tests pin the two
// properties that matter: a forged payload is refused, and fulfilment happens at most once.

let customer, token;

beforeEach(async () => {
  customer = await makeUser({ role: 'customer' });
  token = await login(customer.email, 'pass1234', 'customer');
});

describe('available payment methods', () => {
  it('offers COD and wallet, and hides every gateway that is not configured', async () => {
    const res = await api().get('/api/payments/methods');
    const byId = Object.fromEntries(res.body.methods.map((m) => [m.id, m]));

    expect(byId.cod.enabled).toBe(true);
    expect(byId.wallet.enabled).toBe(true);
    for (const g of ['stripe', 'razorpay', 'paypal', 'paytm', 'flutterwave', 'midtrans', 'phonepe']) {
      expect(byId[g].enabled).toBe(false);
    }
  });

  it('lists every gateway v1 supported', async () => {
    const res = await api().get('/api/payments/methods');
    const ids = res.body.methods.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining(['stripe', 'razorpay', 'paypal', 'paytm', 'flutterwave', 'midtrans', 'phonepe'])
    );
  });
});

describe('a gateway that is enabled but has no credentials', () => {
  it('answers with a clean 503 instead of crashing', async () => {
    await setSetting('midtransEnabled', true);

    const res = await api()
      .post('/api/payments/midtrans/create-transaction')
      .set(auth(token))
      .send({ purpose: 'topup', amount: 100 });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/not configured/i);
  });
});

describe('webhook signature verification', () => {
  it('refuses a Razorpay webhook when no secret is configured', async () => {
    // Regression guard: this used to accept *any* payload when the secret was blank,
    // and Razorpay shipped enabled with an empty secret.
    const res = await api()
      .post('/api/payments/webhook/razorpay')
      .send({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'x', amount: 100 } } } });

    expect(res.status).toBe(503);
  });

  it('refuses a Stripe webhook when no secret is configured', async () => {
    const res = await api()
      .post('/api/payments/webhook/stripe')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ type: 'checkout.session.completed' })));

    expect(res.status).toBe(503);
  });

  it('rejects a forged Razorpay signature', async () => {
    await setSetting('razorpayWebhookSecret', 'whsec_test');

    const res = await api()
      .post('/api/payments/webhook/razorpay')
      .set('x-razorpay-signature', 'forged')
      .send({ event: 'payment.captured', payload: { payment: { entity: { order_id: 'x', amount: 100 } } } });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/signature/i);
  });

  it('accepts a correctly signed Razorpay webhook', async () => {
    await setSetting('razorpayWebhookSecret', 'whsec_test');

    const body = { event: 'payment.captured', payload: { payment: { entity: { order_id: 'unknown', amount: 100 } } } };
    const signature = crypto.createHmac('sha256', 'whsec_test').update(JSON.stringify(body)).digest('hex');

    const res = await api()
      .post('/api/payments/webhook/razorpay')
      .set('x-razorpay-signature', signature)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('rejects a forged Midtrans signature and accepts a valid one', async () => {
    await setSetting('midtransServerKey', 'SB-Mid-server-KEY');

    const forged = await api()
      .post('/api/payments/webhook/midtrans')
      .send({ order_id: 'o1', status_code: '200', gross_amount: '100.00', signature_key: 'forged', transaction_status: 'settlement' });
    expect(forged.status).toBe(400);

    const signature_key = crypto
      .createHash('sha512')
      .update('o1' + '200' + '100.00' + 'SB-Mid-server-KEY')
      .digest('hex');

    const valid = await api()
      .post('/api/payments/webhook/midtrans')
      .send({ order_id: 'o1', status_code: '200', gross_amount: '100.00', signature_key, transaction_status: 'settlement' });
    expect(valid.status).toBe(200);
  });

  it('rejects a forged PhonePe signature and accepts a valid one', async () => {
    await setSetting('phonepeSaltKey', 'SALT');
    await setSetting('phonepeSaltIndex', '1');

    const payload = Buffer.from(
      JSON.stringify({ code: 'PAYMENT_SUCCESS', data: { merchantTransactionId: 't1', amount: 10000 } })
    ).toString('base64');

    const forged = await api()
      .post('/api/payments/webhook/phonepe')
      .set('X-VERIFY', 'forged###1')
      .send({ response: payload });
    expect(forged.status).toBe(400);

    const xverify = crypto.createHash('sha256').update(payload + 'SALT').digest('hex') + '###1';
    const valid = await api()
      .post('/api/payments/webhook/phonepe')
      .set('X-VERIFY', xverify)
      .send({ response: payload });
    expect(valid.status).toBe(200);
  });

  it('rejects a Flutterwave webhook with the wrong hash', async () => {
    await setSetting('flutterwaveSecretHash', 'myhash');

    const res = await api()
      .post('/api/payments/webhook/flutterwave')
      .set('verif-hash', 'wrong')
      .send({ event: 'charge.completed', data: { status: 'successful', tx_ref: 'x' } });

    expect(res.status).toBe(400);
  });
});

describe('fulfilment is idempotent', () => {
  it('tops up the wallet exactly once even if the webhook fires twice', async () => {
    await setSetting('midtransServerKey', 'SB-Mid-server-KEY');
    await setSetting('midtransEnabled', true);

    // Stand in for a completed hosted checkout: the intent exists and is awaiting capture.
    const payment = await Payment.create({
      user: customer._id,
      gateway: 'midtrans',
      purpose: 'topup',
      amount: 500,
      currency: 'INR',
      status: 'created',
    });
    payment.gatewayOrderId = String(payment._id);
    await payment.save();

    const body = {
      order_id: payment.gatewayOrderId,
      status_code: '200',
      gross_amount: '500.00',
      transaction_status: 'settlement',
      transaction_id: 'tx-1',
    };
    body.signature_key = crypto
      .createHash('sha512')
      .update(body.order_id + body.status_code + body.gross_amount + 'SB-Mid-server-KEY')
      .digest('hex');

    await api().post('/api/payments/webhook/midtrans').send(body).expect(200);
    await api().post('/api/payments/webhook/midtrans').send(body).expect(200); // replay

    const fresh = await User.findById(customer._id);
    expect(fresh.walletBalance).toBe(500); // not 1000

    const settled = await Payment.findById(payment._id);
    expect(settled.status).toBe('consumed');
  });
});
