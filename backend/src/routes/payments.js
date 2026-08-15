import { Router } from 'express';
import crypto from 'crypto';
import Stripe from 'stripe';
import Razorpay from 'razorpay';
import { Payment } from '../models/Finance.js';
import { Setting } from '../models/Misc.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { walletAdjust } from '../utils/helpers.js';
import { quoteCart, placeOrderFromCart } from '../services/checkout.js';

const router = Router();
const round2 = (n) => Math.round(n * 100) / 100;

/** Normalize gateway SDK errors into readable API errors. */
function gatewayError(e, gateway) {
  const message =
    e?.error?.description || // razorpay
    e?.raw?.message ||       // stripe
    e?.message ||
    'Payment gateway error';
  const err = new Error(`${gateway}: ${message}`);
  err.status = 502;
  return err;
}

// ---- Gateway config (Settings collection, .env fallback) ----

async function gatewayConfig() {
  const settings = await Setting.find({
    key: {
      $in: [
        'stripeEnabled', 'stripePublishableKey', 'stripeSecretKey', 'stripeWebhookSecret',
        'razorpayEnabled', 'razorpayKeyId', 'razorpayKeySecret', 'razorpayWebhookSecret',
        'paypalEnabled', 'paypalClientId', 'paypalClientSecret', 'paypalTestMode', 'paypalWebhookId',
        'paytmEnabled', 'paytmMid', 'paytmMerchantKey', 'paytmWebsite', 'paytmTestMode',
        'flutterwaveEnabled', 'flutterwaveSecretKey', 'flutterwaveSecretHash',
        'midtransEnabled', 'midtransServerKey', 'midtransClientKey', 'midtransTestMode',
        'phonepeEnabled', 'phonepeMerchantId', 'phonepeSaltKey', 'phonepeSaltIndex', 'phonepeTestMode',
        'currencyCode',
      ],
    },
  });
  const s = Object.fromEntries(settings.map((x) => [x.key, x.value]));
  return {
    currency: (s.currencyCode || process.env.CURRENCY_CODE || 'INR').toUpperCase(),
    stripe: {
      enabled: !!s.stripeEnabled,
      publishableKey: s.stripePublishableKey || process.env.STRIPE_PUBLISHABLE_KEY || '',
      secretKey: s.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '',
      webhookSecret: s.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '',
    },
    razorpay: {
      enabled: !!s.razorpayEnabled,
      keyId: s.razorpayKeyId || process.env.RAZORPAY_KEY_ID || '',
      keySecret: s.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || '',
      webhookSecret: s.razorpayWebhookSecret || process.env.RAZORPAY_WEBHOOK_SECRET || '',
    },
    paypal: {
      enabled: !!s.paypalEnabled,
      clientId: s.paypalClientId || '',
      clientSecret: s.paypalClientSecret || '',
      base: s.paypalTestMode === false ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
      // PayPal has no shared secret — the webhook is verified by calling them back with
      // the id of the webhook subscription you registered in their dashboard.
      webhookId: s.paypalWebhookId || process.env.PAYPAL_WEBHOOK_ID || '',
    },
    paytm: {
      enabled: !!s.paytmEnabled,
      mid: s.paytmMid || '',
      merchantKey: s.paytmMerchantKey || '',
      website: s.paytmWebsite || (s.paytmTestMode === false ? 'DEFAULT' : 'WEBSTAGING'),
      base: s.paytmTestMode === false ? 'https://securegw.paytm.in' : 'https://securegw-stage.paytm.in',
    },
    flutterwave: {
      enabled: !!s.flutterwaveEnabled,
      secretKey: s.flutterwaveSecretKey || '',
      // Flutterwave signs webhooks with a hash you choose in their dashboard, not the secret key.
      secretHash: s.flutterwaveSecretHash || process.env.FLUTTERWAVE_SECRET_HASH || '',
    },
    midtrans: {
      enabled: !!s.midtransEnabled,
      serverKey: s.midtransServerKey || '',
      clientKey: s.midtransClientKey || '',
      // Snap creates the hosted page; the v2 API reports its status.
      snapBase: s.midtransTestMode === false ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com',
      apiBase: s.midtransTestMode === false ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com',
    },
    phonepe: {
      enabled: !!s.phonepeEnabled,
      merchantId: s.phonepeMerchantId || '',
      saltKey: s.phonepeSaltKey || '',
      saltIndex: String(s.phonepeSaltIndex || '1'),
      base: s.phonepeTestMode === false
        ? 'https://api.phonepe.com/apis/hermes'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    },
  };
}

// PhonePe signs every request with X-VERIFY: sha256(payload + path + saltKey)###saltIndex.
function phonepeChecksum(payloadOrEmpty, path, cfg) {
  const hash = crypto.createHash('sha256').update(payloadOrEmpty + path + cfg.phonepe.saltKey).digest('hex');
  return `${hash}###${cfg.phonepe.saltIndex}`;
}

/** Throw a clean 503 when a gateway is toggled on without credentials. */
function requireConfigured(name, ok) {
  if (!ok) {
    const err = new Error(`${name} is not configured. Admin: Settings → Payments.`);
    err.status = 503;
    throw err;
  }
}

function stripeClient(cfg) {
  if (!cfg.stripe.enabled || !cfg.stripe.secretKey) {
    const err = new Error('Stripe is not configured. Admin: Settings → Payments.');
    err.status = 503;
    throw err;
  }
  return new Stripe(cfg.stripe.secretKey);
}

function razorpayClient(cfg) {
  if (!cfg.razorpay.enabled || !cfg.razorpay.keyId || !cfg.razorpay.keySecret) {
    const err = new Error('Razorpay is not configured. Admin: Settings → Payments.');
    err.status = 503;
    throw err;
  }
  return new Razorpay({ key_id: cfg.razorpay.keyId, key_secret: cfg.razorpay.keySecret });
}

// GET /api/payments/methods — what the checkout should offer
router.get(
  '/methods',
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    res.json({
      methods: [
        { id: 'cod', label: 'Cash on Delivery', enabled: true },
        { id: 'wallet', label: 'CraveCart Wallet', enabled: true },
        {
          id: 'stripe', label: 'Card (Stripe)',
          enabled: cfg.stripe.enabled && !!cfg.stripe.secretKey,
          publishableKey: cfg.stripe.publishableKey,
        },
        {
          id: 'razorpay', label: 'UPI / Card (Razorpay)',
          enabled: cfg.razorpay.enabled && !!cfg.razorpay.keyId,
          keyId: cfg.razorpay.keyId,
        },
        { id: 'paypal', label: 'PayPal', enabled: cfg.paypal.enabled && !!cfg.paypal.clientId, redirect: true },
        { id: 'paytm', label: 'Paytm', enabled: cfg.paytm.enabled && !!cfg.paytm.mid, redirect: true },
        { id: 'flutterwave', label: 'Flutterwave', enabled: cfg.flutterwave.enabled && !!cfg.flutterwave.secretKey, redirect: true },
        { id: 'midtrans', label: 'Midtrans', enabled: cfg.midtrans.enabled && !!cfg.midtrans.serverKey, redirect: true },
        { id: 'phonepe', label: 'PhonePe', enabled: cfg.phonepe.enabled && !!cfg.phonepe.merchantId, redirect: true },
      ],
      currency: cfg.currency,
    });
  })
);

// Resolve the amount for an intent: order → quote the cart; topup → validated flat amount.
async function resolveAmount(user, { purpose, params, amount }) {
  if (purpose === 'topup') {
    const amt = round2(Number(amount));
    if (!amt || amt <= 0 || amt > 100000) {
      const err = new Error('Invalid top-up amount');
      err.status = 400;
      throw err;
    }
    return amt;
  }
  const quote = await quoteCart(user, params);
  return quote.grandTotal;
}

const sanitizeParams = (p = {}) => ({
  addressId: p.addressId,
  promoCode: p.promoCode,
  tip: Number(p.tip || 0),
  note: p.note,
  selfPickup: !!p.selfPickup,
  scheduledFor: p.scheduledFor,
});

// ---- Stripe (hosted Checkout Session) ----

// POST /api/payments/stripe/create-session { purpose: 'order'|'topup', amount?, params?, returnUrl }
router.post(
  '/stripe/create-session',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    const stripe = stripeClient(cfg);
    const { purpose = 'order', returnUrl } = req.body;
    const params = sanitizeParams(req.body.params);
    const amount = await resolveAmount(req.user, { purpose, params, amount: req.body.amount });

    const origin = returnUrl || req.headers.origin || 'http://localhost:5173';
    const payment = await Payment.create({
      user: req.user._id,
      gateway: 'stripe',
      purpose,
      amount,
      currency: cfg.currency,
      checkoutParams: purpose === 'order' ? params : undefined,
    });

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: req.user.email,
        line_items: [
          {
            price_data: {
              currency: cfg.currency.toLowerCase(),
              product_data: {
                name: purpose === 'topup' ? 'CraveCart wallet top-up' : 'CraveCart order',
              },
              unit_amount: Math.round(amount * 100),
            },
            quantity: 1,
          },
        ],
        metadata: { paymentId: String(payment._id), userId: String(req.user._id), purpose },
        success_url: `${origin}/payment/stripe-return?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/payment/stripe-return?cancelled=1`,
      });
    } catch (e) {
      payment.status = 'failed';
      payment.error = e.message;
      await payment.save();
      throw gatewayError(e, 'Stripe');
    }

    payment.stripeSessionId = session.id;
    await payment.save();
    res.json({ url: session.url, sessionId: session.id, amount });
  })
);

// POST /api/payments/stripe/confirm { sessionId } — verify + fulfill
router.post(
  '/stripe/confirm',
  protect,
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    const stripe = stripeClient(cfg);
    const payment = await Payment.findOne({
      stripeSessionId: req.body.sessionId,
      user: req.user._id,
    });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    if (payment.status === 'consumed') {
      return res.json({ ...(await fulfilledResponse(payment)), alreadyDone: true });
    }
    const session = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: 'Payment not completed', paymentStatus: session.payment_status });
    }
    const paidAmount = round2((session.amount_total || 0) / 100);
    await confirmAndFulfill(payment, req.user, paidAmount, String(session.payment_intent || ''), res);
  })
);

// ---- Razorpay (in-page Checkout) ----

// POST /api/payments/razorpay/create-order { purpose, amount?, params? }
router.post(
  '/razorpay/create-order',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    const rzp = razorpayClient(cfg);
    const { purpose = 'order' } = req.body;
    const params = sanitizeParams(req.body.params);
    const amount = await resolveAmount(req.user, { purpose, params, amount: req.body.amount });

    const payment = await Payment.create({
      user: req.user._id,
      gateway: 'razorpay',
      purpose,
      amount,
      currency: cfg.currency,
      checkoutParams: purpose === 'order' ? params : undefined,
    });

    let rzpOrder;
    try {
      rzpOrder = await rzp.orders.create({
        amount: Math.round(amount * 100),
        currency: cfg.currency,
        receipt: String(payment._id),
        notes: { paymentId: String(payment._id), purpose },
      });
    } catch (e) {
      payment.status = 'failed';
      payment.error = e?.error?.description || e.message;
      await payment.save();
      throw gatewayError(e, 'Razorpay');
    }

    payment.razorpayOrderId = rzpOrder.id;
    await payment.save();
    res.json({
      razorpayOrderId: rzpOrder.id,
      keyId: cfg.razorpay.keyId,
      amount,
      currency: cfg.currency,
      name: 'CraveCart',
      prefill: { name: req.user.name, email: req.user.email, contact: req.user.phone || '' },
    });
  })
);

// POST /api/payments/razorpay/verify { razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post(
  '/razorpay/verify',
  protect,
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id, user: req.user._id });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'consumed') {
      return res.json({ ...(await fulfilledResponse(payment)), alreadyDone: true });
    }

    const expected = crypto
      .createHmac('sha256', cfg.razorpay.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expected !== razorpay_signature) {
      payment.status = 'failed';
      payment.error = 'Signature verification failed';
      await payment.save();
      return res.status(400).json({ message: 'Payment signature verification failed' });
    }

    await confirmAndFulfill(payment, req.user, payment.amount, razorpay_payment_id, res);
  })
);

// ---- PayPal (Orders v2, redirect approval flow) ----
// Wired for the pitch: works against sandbox/live the moment client id+secret
// are pasted into Settings → Payments. Untested until credentials exist.

async function paypalToken(cfg) {
  const auth = Buffer.from(`${cfg.paypal.clientId}:${cfg.paypal.clientSecret}`).toString('base64');
  const r = await fetch(`${cfg.paypal.base}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw gatewayError(new Error(await r.text()), 'PayPal');
  return (await r.json()).access_token;
}

// POST /api/payments/paypal/create-order { purpose, amount?, params?, returnUrl }
router.post(
  '/paypal/create-order',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    requireConfigured('PayPal', cfg.paypal.enabled && cfg.paypal.clientId && cfg.paypal.clientSecret);
    const { purpose = 'order', returnUrl } = req.body;
    const params = sanitizeParams(req.body.params);
    const amount = await resolveAmount(req.user, { purpose, params, amount: req.body.amount });
    const origin = returnUrl || req.headers.origin || 'http://localhost:5173';

    const payment = await Payment.create({
      user: req.user._id, gateway: 'paypal', purpose, amount, currency: cfg.currency,
      checkoutParams: purpose === 'order' ? params : undefined,
    });

    const token = await paypalToken(cfg);
    const r = await fetch(`${cfg.paypal.base}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{ custom_id: String(payment._id), amount: { currency_code: cfg.currency, value: amount.toFixed(2) } }],
        application_context: {
          brand_name: 'CraveCart',
          user_action: 'PAY_NOW',
          return_url: `${origin}/payment/gateway-return?gateway=paypal`,
          cancel_url: `${origin}/payment/gateway-return?gateway=paypal&cancelled=1`,
        },
      }),
    });
    if (!r.ok) {
      payment.status = 'failed';
      payment.error = await r.text();
      await payment.save();
      throw gatewayError(new Error(payment.error), 'PayPal');
    }
    const order = await r.json();
    payment.gatewayOrderId = order.id;
    await payment.save();
    const approve = (order.links || []).find((l) => l.rel === 'approve' || l.rel === 'payer-action');
    res.json({ url: approve?.href, orderId: order.id, amount });
  })
);

// POST /api/payments/paypal/confirm { orderId } — capture + fulfill
router.post(
  '/paypal/confirm',
  protect,
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    requireConfigured('PayPal', cfg.paypal.enabled && cfg.paypal.clientId && cfg.paypal.clientSecret);
    const payment = await Payment.findOne({ gateway: 'paypal', gatewayOrderId: req.body.orderId, user: req.user._id });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'consumed') {
      return res.json({ ...(await fulfilledResponse(payment)), alreadyDone: true });
    }
    const token = await paypalToken(cfg);
    const r = await fetch(`${cfg.paypal.base}/v2/checkout/orders/${payment.gatewayOrderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await r.json();
    const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];
    if (!r.ok || data.status !== 'COMPLETED' || !capture) {
      return res.status(400).json({ message: `PayPal payment not completed (${data.status || r.status})` });
    }
    await confirmAndFulfill(payment, req.user, round2(Number(capture.amount?.value || payment.amount)), capture.id, res);
  })
);

// ---- Paytm (initiateTransaction + hosted payment page) ----
// Untested until MID/key are configured (stage gateway by default).

// POST /api/payments/paytm/create-txn { purpose, amount?, params?, returnUrl }
router.post(
  '/paytm/create-txn',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    requireConfigured('Paytm', cfg.paytm.enabled && cfg.paytm.mid && cfg.paytm.merchantKey);
    const { default: PaytmChecksum } = await import('paytmchecksum');
    const { purpose = 'order', returnUrl } = req.body;
    const params = sanitizeParams(req.body.params);
    const amount = await resolveAmount(req.user, { purpose, params, amount: req.body.amount });
    const origin = returnUrl || req.headers.origin || 'http://localhost:5173';

    const payment = await Payment.create({
      user: req.user._id, gateway: 'paytm', purpose, amount, currency: cfg.currency,
      checkoutParams: purpose === 'order' ? params : undefined,
    });
    payment.gatewayOrderId = String(payment._id);
    await payment.save();

    const body = {
      requestType: 'Payment',
      mid: cfg.paytm.mid,
      websiteName: cfg.paytm.website,
      orderId: payment.gatewayOrderId,
      callbackUrl: `${origin}/payment/gateway-return?gateway=paytm&orderId=${payment.gatewayOrderId}`,
      txnAmount: { value: amount.toFixed(2), currency: cfg.currency },
      userInfo: { custId: String(req.user._id) },
    };
    const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), cfg.paytm.merchantKey);
    const r = await fetch(
      `${cfg.paytm.base}/theia/api/v1/initiateTransaction?mid=${cfg.paytm.mid}&orderId=${payment.gatewayOrderId}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, head: { signature } }) }
    );
    const data = await r.json().catch(() => ({}));
    const txnToken = data?.body?.txnToken;
    if (!txnToken) {
      payment.status = 'failed';
      payment.error = data?.body?.resultInfo?.resultMsg || `Paytm initiate failed (${r.status})`;
      await payment.save();
      throw gatewayError(new Error(payment.error), 'Paytm');
    }
    res.json({
      url: `${cfg.paytm.base}/theia/api/v1/showPaymentPage?mid=${cfg.paytm.mid}&orderId=${payment.gatewayOrderId}&txnToken=${txnToken}`,
      orderId: payment.gatewayOrderId,
      amount,
    });
  })
);

// POST /api/payments/paytm/confirm { orderId } — order status check + fulfill
router.post(
  '/paytm/confirm',
  protect,
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    requireConfigured('Paytm', cfg.paytm.enabled && cfg.paytm.mid && cfg.paytm.merchantKey);
    const { default: PaytmChecksum } = await import('paytmchecksum');
    const payment = await Payment.findOne({ gateway: 'paytm', gatewayOrderId: req.body.orderId, user: req.user._id });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'consumed') {
      return res.json({ ...(await fulfilledResponse(payment)), alreadyDone: true });
    }
    const body = { mid: cfg.paytm.mid, orderId: payment.gatewayOrderId };
    const signature = await PaytmChecksum.generateSignature(JSON.stringify(body), cfg.paytm.merchantKey);
    const r = await fetch(`${cfg.paytm.base}/v3/order/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, head: { signature } }),
    });
    const data = await r.json().catch(() => ({}));
    if (data?.body?.resultInfo?.resultStatus !== 'TXN_SUCCESS') {
      return res.status(400).json({ message: `Paytm payment not completed (${data?.body?.resultInfo?.resultMsg || r.status})` });
    }
    const paid = round2(Number(data.body.txnAmount || payment.amount));
    await confirmAndFulfill(payment, req.user, paid, data.body.txnId || '', res);
  })
);

// ---- Flutterwave (hosted standard checkout) ----
// Untested until the secret key is configured.

// POST /api/payments/flutterwave/create-payment { purpose, amount?, params?, returnUrl }
router.post(
  '/flutterwave/create-payment',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    requireConfigured('Flutterwave', cfg.flutterwave.enabled && cfg.flutterwave.secretKey);
    const { purpose = 'order', returnUrl } = req.body;
    const params = sanitizeParams(req.body.params);
    const amount = await resolveAmount(req.user, { purpose, params, amount: req.body.amount });
    const origin = returnUrl || req.headers.origin || 'http://localhost:5173';

    const payment = await Payment.create({
      user: req.user._id, gateway: 'flutterwave', purpose, amount, currency: cfg.currency,
      checkoutParams: purpose === 'order' ? params : undefined,
    });
    payment.gatewayOrderId = String(payment._id); // tx_ref
    await payment.save();

    const r = await fetch('https://api.flutterwave.com/v3/payments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.flutterwave.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: payment.gatewayOrderId,
        amount: amount.toFixed(2),
        currency: cfg.currency,
        redirect_url: `${origin}/payment/gateway-return?gateway=flutterwave&tx_ref=${payment.gatewayOrderId}`,
        customer: { email: req.user.email, name: req.user.name, phonenumber: req.user.phone || '' },
        customizations: { title: 'CraveCart', description: purpose === 'topup' ? 'Wallet top-up' : 'Order payment' },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.status !== 'success' || !data.data?.link) {
      payment.status = 'failed';
      payment.error = data.message || `Flutterwave create failed (${r.status})`;
      await payment.save();
      throw gatewayError(new Error(payment.error), 'Flutterwave');
    }
    res.json({ url: data.data.link, txRef: payment.gatewayOrderId, amount });
  })
);

// POST /api/payments/flutterwave/confirm { txRef } — verify + fulfill
router.post(
  '/flutterwave/confirm',
  protect,
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    requireConfigured('Flutterwave', cfg.flutterwave.enabled && cfg.flutterwave.secretKey);
    const payment = await Payment.findOne({ gateway: 'flutterwave', gatewayOrderId: req.body.txRef, user: req.user._id });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'consumed') {
      return res.json({ ...(await fulfilledResponse(payment)), alreadyDone: true });
    }
    const r = await fetch(
      `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(payment.gatewayOrderId)}`,
      { headers: { Authorization: `Bearer ${cfg.flutterwave.secretKey}` } }
    );
    const data = await r.json().catch(() => ({}));
    const tx = data?.data;
    if (!r.ok || tx?.status !== 'successful' || Number(tx.amount) < payment.amount || tx.currency !== payment.currency) {
      return res.status(400).json({ message: `Flutterwave payment not completed (${tx?.status || r.status})` });
    }
    await confirmAndFulfill(payment, req.user, round2(Number(tx.amount)), String(tx.id || ''), res);
  })
);

// ---- Midtrans (Snap hosted checkout — v1 create_midtrans_transaction) ----
// Untested until a server key is configured.

// POST /api/payments/midtrans/create-transaction { purpose, amount?, params?, returnUrl }
router.post(
  '/midtrans/create-transaction',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    requireConfigured('Midtrans', cfg.midtrans.enabled && cfg.midtrans.serverKey);
    const { purpose = 'order', returnUrl } = req.body;
    const params = sanitizeParams(req.body.params);
    const amount = await resolveAmount(req.user, { purpose, params, amount: req.body.amount });
    const origin = returnUrl || req.headers.origin || 'http://localhost:5173';

    const payment = await Payment.create({
      user: req.user._id, gateway: 'midtrans', purpose, amount, currency: cfg.currency,
      checkoutParams: purpose === 'order' ? params : undefined,
    });
    payment.gatewayOrderId = String(payment._id);
    await payment.save();

    // Snap rejects fractional gross_amount — it settles in whole currency units.
    const gross = Math.round(amount);
    const auth = Buffer.from(`${cfg.midtrans.serverKey}:`).toString('base64');
    const r = await fetch(`${cfg.midtrans.snapBase}/snap/v1/transactions`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        transaction_details: { order_id: payment.gatewayOrderId, gross_amount: gross },
        customer_details: { first_name: req.user.name, email: req.user.email, phone: req.user.phone || '' },
        callbacks: { finish: `${origin}/payment/gateway-return?gateway=midtrans&orderId=${payment.gatewayOrderId}` },
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.redirect_url) {
      payment.status = 'failed';
      payment.error = (data.error_messages || []).join(', ') || `Midtrans create failed (${r.status})`;
      await payment.save();
      throw gatewayError(new Error(payment.error), 'Midtrans');
    }
    res.json({ url: data.redirect_url, token: data.token, orderId: payment.gatewayOrderId, amount });
  })
);

// POST /api/payments/midtrans/confirm { orderId } — v1 get_midtrans_transaction_status
router.post(
  '/midtrans/confirm',
  protect,
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    requireConfigured('Midtrans', cfg.midtrans.enabled && cfg.midtrans.serverKey);
    const payment = await Payment.findOne({ gateway: 'midtrans', gatewayOrderId: req.body.orderId, user: req.user._id });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'consumed') {
      return res.json({ ...(await fulfilledResponse(payment)), alreadyDone: true });
    }

    const auth = Buffer.from(`${cfg.midtrans.serverKey}:`).toString('base64');
    const r = await fetch(`${cfg.midtrans.apiBase}/v2/${encodeURIComponent(payment.gatewayOrderId)}/status`, {
      headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
    });
    const tx = await r.json().catch(() => ({}));
    // capture = card authorised+captured, settlement = funds moved. Both mean paid.
    const paid = ['capture', 'settlement'].includes(tx.transaction_status) &&
      (tx.fraud_status === undefined || tx.fraud_status === 'accept');
    if (!r.ok || !paid || Number(tx.gross_amount) < Math.round(payment.amount)) {
      return res.status(400).json({ message: `Midtrans payment not completed (${tx.transaction_status || r.status})` });
    }
    await confirmAndFulfill(payment, req.user, round2(Number(tx.gross_amount)), String(tx.transaction_id || ''), res);
  })
);

// ---- PhonePe (hosted PAY_PAGE — v1 phonepe_web / phonepe_app) ----
// Untested until merchant credentials are configured.

// POST /api/payments/phonepe/create-payment { purpose, amount?, params?, returnUrl }
router.post(
  '/phonepe/create-payment',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    requireConfigured('PhonePe', cfg.phonepe.enabled && cfg.phonepe.merchantId && cfg.phonepe.saltKey);
    const { purpose = 'order', returnUrl } = req.body;
    const params = sanitizeParams(req.body.params);
    const amount = await resolveAmount(req.user, { purpose, params, amount: req.body.amount });
    const origin = returnUrl || req.headers.origin || 'http://localhost:5173';

    const payment = await Payment.create({
      user: req.user._id, gateway: 'phonepe', purpose, amount, currency: cfg.currency,
      checkoutParams: purpose === 'order' ? params : undefined,
    });
    payment.gatewayOrderId = String(payment._id); // merchantTransactionId
    await payment.save();

    const payload = {
      merchantId: cfg.phonepe.merchantId,
      merchantTransactionId: payment.gatewayOrderId,
      merchantUserId: String(req.user._id),
      amount: Math.round(amount * 100), // paise
      redirectUrl: `${origin}/payment/gateway-return?gateway=phonepe&orderId=${payment.gatewayOrderId}`,
      redirectMode: 'REDIRECT',
      callbackUrl: `${origin}/api/payments/webhook/phonepe`,
      mobileNumber: req.user.phone || undefined,
      paymentInstrument: { type: 'PAY_PAGE' },
    };
    const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');

    const r = await fetch(`${cfg.phonepe.base}/pg/v1/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'X-VERIFY': phonepeChecksum(base64, '/pg/v1/pay', cfg),
      },
      body: JSON.stringify({ request: base64 }),
    });
    const data = await r.json().catch(() => ({}));
    const url = data?.data?.instrumentResponse?.redirectInfo?.url;
    if (!r.ok || !data.success || !url) {
      payment.status = 'failed';
      payment.error = data.message || `PhonePe create failed (${r.status})`;
      await payment.save();
      throw gatewayError(new Error(payment.error), 'PhonePe');
    }
    res.json({ url, orderId: payment.gatewayOrderId, amount });
  })
);

// POST /api/payments/phonepe/confirm { orderId } — v1 phonepe_check_status
router.post(
  '/phonepe/confirm',
  protect,
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    requireConfigured('PhonePe', cfg.phonepe.enabled && cfg.phonepe.merchantId && cfg.phonepe.saltKey);
    const payment = await Payment.findOne({ gateway: 'phonepe', gatewayOrderId: req.body.orderId, user: req.user._id });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    if (payment.status === 'consumed') {
      return res.json({ ...(await fulfilledResponse(payment)), alreadyDone: true });
    }

    const path = `/pg/v1/status/${cfg.phonepe.merchantId}/${payment.gatewayOrderId}`;
    const r = await fetch(`${cfg.phonepe.base}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'X-VERIFY': phonepeChecksum('', path, cfg),
        'X-MERCHANT-ID': cfg.phonepe.merchantId,
      },
    });
    const data = await r.json().catch(() => ({}));
    const paidPaise = Number(data?.data?.amount || 0);
    const ok = r.ok && data.success && data?.code === 'PAYMENT_SUCCESS' &&
      paidPaise >= Math.round(payment.amount * 100);
    if (!ok) {
      return res.status(400).json({ message: `PhonePe payment not completed (${data?.code || r.status})` });
    }
    await confirmAndFulfill(
      payment, req.user, round2(paidPaise / 100),
      String(data?.data?.transactionId || ''), res
    );
  })
);

// ---- Fulfillment (shared) ----

async function fulfilledResponse(payment) {
  await payment.populate('orders');
  return payment.purpose === 'topup'
    ? { message: 'Wallet topped up', purpose: 'topup' }
    : { message: 'Order placed', purpose: 'order', orders: payment.orders };
}

/**
 * Atomically take ownership of a payment for fulfillment. Only one caller (client
 * confirm/verify OR the webhook) can win — the rest get null. This is what makes
 * fulfillment idempotent and lets webhooks recover abandoned-but-paid checkouts.
 */
async function claimPayment(paymentId) {
  return Payment.findOneAndUpdate(
    { _id: paymentId, status: { $in: ['created', 'paid'] } },
    { $set: { status: 'fulfilling' } },
    { new: true }
  );
}

/** Fulfill a claimed payment: credit a top-up, or place the order the payment was for. */
async function runFulfillment(payment, user, paidAmount) {
  if (payment.purpose === 'topup') {
    const balance = await walletAdjust(user._id, paidAmount, 'wallet_topup', {
      note: `Wallet top-up via ${payment.gateway}`,
    });
    payment.status = 'consumed';
    await payment.save();
    return { message: 'Wallet topped up', purpose: 'topup', balance };
  }

  try {
    const orders = await placeOrderFromCart(user, {
      ...payment.checkoutParams,
      paymentMethod: payment.gateway,
      expectPaidAmount: paidAmount,
    });
    payment.status = 'consumed';
    payment.orders = orders.map((o) => o._id);
    await payment.save();
    return { message: 'Order placed', purpose: 'order', orders };
  } catch (e) {
    // Payment captured but order failed (cart changed / stock gone) → refund to wallet.
    const balance = await walletAdjust(user._id, paidAmount, 'order_refund', {
      note: `Refund: payment via ${payment.gateway} succeeded but order failed (${e.message})`,
    });
    payment.status = 'failed';
    payment.error = e.message;
    await payment.save();
    const err = new Error(`${e.message} The paid amount has been credited to your wallet (balance ${balance}).`);
    err.status = 400;
    throw err;
  }
}

/** Verify a payment (already gateway-checked), claim it, and fulfill — shared by confirm/verify. */
async function confirmAndFulfill(payment, user, paidAmount, gatewayPaymentId, res) {
  if (payment.status === 'consumed') {
    return res.json({ ...(await fulfilledResponse(payment)), alreadyDone: true });
  }
  const claimed = await claimPayment(payment._id);
  if (!claimed) {
    // The webhook (or a concurrent confirm) is handling it — report current state.
    const fresh = await Payment.findById(payment._id);
    if (fresh?.status === 'consumed') {
      return res.json({ ...(await fulfilledResponse(fresh)), alreadyDone: true });
    }
    return res.status(202).json({
      message: 'Payment received — your order is being finalized. Check "My Orders" shortly.',
      processing: true,
    });
  }
  if (gatewayPaymentId) claimed.gatewayPaymentId = gatewayPaymentId;
  const result = await runFulfillment(claimed, user, paidAmount);
  res.json(result);
}

// ---- Webhooks (reconciliation) ----
// Primary fulfillment is the client-driven confirm/verify above; webhooks log + mark payments
// paid so missed confirmations can be reconciled.

// POST /api/payments/webhook/stripe (raw body — mounted with express.raw in server.js)
router.post(
  '/webhook/stripe',
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    // An unsigned webhook is an unauthenticated request to fulfill an order. Without a
    // secret we cannot tell Stripe from anyone else who can reach this URL, so refuse
    // rather than trust the body. (Fulfillment still works without the webhook — it is
    // the recovery path for checkouts the customer abandoned after paying.)
    if (!cfg.stripe.webhookSecret) {
      return res.status(503).json({ message: 'Stripe webhook secret is not configured' });
    }
    let event;
    try {
      const stripe = stripeClient(cfg);
      event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], cfg.stripe.webhookSecret);
    } catch (e) {
      return res.status(400).json({ message: `Webhook signature failed: ${e.message}` });
    }
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        const payment = await Payment.findOne({ stripeSessionId: session.id });
        const claimed = payment && (await claimPayment(payment._id));
        if (claimed) {
          claimed.gatewayPaymentId = String(session.payment_intent || '');
          const user = await User.findById(claimed.user);
          const paidAmount = round2((session.amount_total || 0) / 100);
          // Recover the abandoned checkout; errors are already recorded on the payment.
          await runFulfillment(claimed, user, paidAmount).catch((e) =>
            console.error('stripe webhook fulfillment failed', e.message)
          );
        }
      }
    }
    res.json({ received: true });
  })
);

// POST /api/payments/webhook/razorpay
router.post(
  '/webhook/razorpay',
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    // Same reasoning as the Stripe webhook: no secret, no trust.
    if (!cfg.razorpay.webhookSecret) {
      return res.status(503).json({ message: 'Razorpay webhook secret is not configured' });
    }
    const expected = crypto
      .createHmac('sha256', cfg.razorpay.webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (expected !== req.headers['x-razorpay-signature']) {
      return res.status(400).json({ message: 'Webhook signature failed' });
    }
    const entity = req.body?.payload?.payment?.entity;
    if (req.body?.event === 'payment.captured' && entity?.order_id) {
      const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
      const claimed = payment && (await claimPayment(payment._id));
      if (claimed) {
        claimed.gatewayPaymentId = entity.id;
        const user = await User.findById(claimed.user);
        const paidAmount = round2((entity.amount || 0) / 100);
        // Recover the abandoned checkout; errors are already recorded on the payment.
        await runFulfillment(claimed, user, paidAmount).catch((e) =>
          console.error('razorpay webhook fulfillment failed', e.message)
        );
      }
    }
    res.json({ received: true });
  })
);

// Webhooks below share one job with the two above: recover a checkout the customer
// paid for but abandoned before the browser came back. `claimPayment` is the race
// guard — whoever claims first (confirm or webhook) fulfills; the loser no-ops.

// POST /api/payments/webhook/paypal — v1 `ipn`.
// PayPal issues no shared secret: you verify by handing the headers + body back to them
// along with the id of the webhook subscription registered in their dashboard, and they
// tell you whether the signature is genuine. No webhook id ⇒ nothing to verify against ⇒ refuse.
router.post(
  '/webhook/paypal',
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    if (!cfg.paypal.webhookId || !cfg.paypal.clientId) {
      return res.status(503).json({ message: 'PayPal webhook is not configured' });
    }

    const token = await paypalToken(cfg);
    const verify = await fetch(`${cfg.paypal.base}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_algo: req.headers['paypal-auth-algo'],
        cert_url: req.headers['paypal-cert-url'],
        transmission_id: req.headers['paypal-transmission-id'],
        transmission_sig: req.headers['paypal-transmission-sig'],
        transmission_time: req.headers['paypal-transmission-time'],
        webhook_id: cfg.paypal.webhookId,
        webhook_event: req.body,
      }),
    });
    const verdict = await verify.json().catch(() => ({}));
    if (verdict.verification_status !== 'SUCCESS') {
      return res.status(400).json({ message: 'Webhook signature failed' });
    }

    if (req.body?.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = req.body.resource || {};
      // The capture carries our order id in supplementary_data, not at the top level.
      const orderId = resource.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        const payment = await Payment.findOne({ gateway: 'paypal', gatewayOrderId: orderId });
        const claimed = payment && (await claimPayment(payment._id));
        if (claimed) {
          claimed.gatewayPaymentId = String(resource.id || '');
          const user = await User.findById(claimed.user);
          const paidAmount = round2(Number(resource.amount?.value || 0));
          await runFulfillment(claimed, user, paidAmount).catch((e) =>
            console.error('paypal webhook fulfillment failed', e.message)
          );
        }
      }
    }
    res.json({ received: true });
  })
);

// POST /api/payments/webhook/flutterwave
// Flutterwave signs with a static hash you set in their dashboard, sent as `verif-hash`.
router.post(
  '/webhook/flutterwave',
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    // No secret means we cannot tell a real callback from a forged one, and a forged
    // one would fulfill an unpaid order. Refuse rather than trust.
    if (!cfg.flutterwave.secretHash) {
      return res.status(503).json({ message: 'Flutterwave webhook secret is not configured' });
    }
    if (req.headers['verif-hash'] !== cfg.flutterwave.secretHash) {
      return res.status(400).json({ message: 'Webhook signature failed' });
    }
    const data = req.body?.data;
    if (req.body?.event === 'charge.completed' && data?.status === 'successful' && data?.tx_ref) {
      const payment = await Payment.findOne({ gateway: 'flutterwave', gatewayOrderId: data.tx_ref });
      const claimed = payment && (await claimPayment(payment._id));
      if (claimed) {
        claimed.gatewayPaymentId = String(data.id || '');
        const user = await User.findById(claimed.user);
        await runFulfillment(claimed, user, round2(Number(data.amount || 0))).catch((e) =>
          console.error('flutterwave webhook fulfillment failed', e.message)
        );
      }
    }
    res.json({ received: true });
  })
);

// POST /api/payments/webhook/midtrans
// Midtrans signs with sha512(order_id + status_code + gross_amount + serverKey).
router.post(
  '/webhook/midtrans',
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    const b = req.body || {};
    if (!cfg.midtrans.serverKey) {
      return res.status(503).json({ message: 'Midtrans is not configured' });
    }
    const expected = crypto
      .createHash('sha512')
      .update(`${b.order_id}${b.status_code}${b.gross_amount}${cfg.midtrans.serverKey}`)
      .digest('hex');
    if (expected !== b.signature_key) {
      return res.status(400).json({ message: 'Webhook signature failed' });
    }
    const paid = ['capture', 'settlement'].includes(b.transaction_status) &&
      (b.fraud_status === undefined || b.fraud_status === 'accept');
    if (paid && b.order_id) {
      const payment = await Payment.findOne({ gateway: 'midtrans', gatewayOrderId: b.order_id });
      const claimed = payment && (await claimPayment(payment._id));
      if (claimed) {
        claimed.gatewayPaymentId = String(b.transaction_id || '');
        const user = await User.findById(claimed.user);
        await runFulfillment(claimed, user, round2(Number(b.gross_amount || 0))).catch((e) =>
          console.error('midtrans webhook fulfillment failed', e.message)
        );
      }
    }
    res.json({ received: true });
  })
);

// POST /api/payments/webhook/phonepe
// PhonePe posts { response: <base64> } and signs it with X-VERIFY: sha256(base64 + saltKey)###index.
router.post(
  '/webhook/phonepe',
  asyncH(async (req, res) => {
    const cfg = await gatewayConfig();
    const encoded = req.body?.response;
    if (!encoded) return res.status(400).json({ message: 'Missing response' });
    if (!cfg.phonepe.saltKey) {
      return res.status(503).json({ message: 'PhonePe is not configured' });
    }
    // Note the empty path: the callback checksum covers the payload alone.
    if (req.headers['x-verify'] !== phonepeChecksum(encoded, '', cfg)) {
      return res.status(400).json({ message: 'Webhook signature failed' });
    }
    let decoded = {};
    try {
      decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    } catch {
      return res.status(400).json({ message: 'Malformed response' });
    }
    const txnId = decoded?.data?.merchantTransactionId;
    if (decoded?.code === 'PAYMENT_SUCCESS' && txnId) {
      const payment = await Payment.findOne({ gateway: 'phonepe', gatewayOrderId: txnId });
      const claimed = payment && (await claimPayment(payment._id));
      if (claimed) {
        claimed.gatewayPaymentId = String(decoded?.data?.transactionId || '');
        const user = await User.findById(claimed.user);
        const paidAmount = round2(Number(decoded?.data?.amount || 0) / 100);
        await runFulfillment(claimed, user, paidAmount).catch((e) =>
          console.error('phonepe webhook fulfillment failed', e.message)
        );
      }
    }
    res.json({ received: true });
  })
);

// GET /api/payments/mine — my gateway payment attempts
router.get(
  '/mine',
  protect,
  asyncH(async (req, res) => {
    const payments = await Payment.find({ user: req.user._id }).sort('-createdAt').limit(30);
    res.json({ payments });
  })
);

export default router;
