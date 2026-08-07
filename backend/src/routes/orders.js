import { Router } from 'express';
import { Order, Cart, PromoCode, STATUS_TRANSITIONS } from '../models/Order.js';
import { ReturnRequest } from '../models/Finance.js';
import { Product } from '../models/Catalog.js';
import { Review, Setting } from '../models/Misc.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { notify, walletAdjust, paginate } from '../utils/helpers.js';
import { priceCart } from './cart.js';
import { validatePromo, placeOrderFromCart, restoreItemStock } from '../services/checkout.js';
import { emit } from '../socket.js';

const router = Router();
const round2 = (n) => Math.round(n * 100) / 100;

// POST /api/orders/promo-check { code } — validate against current cart
router.post(
  '/promo-check',
  protect,
  asyncH(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || !cart.items.length) return res.status(400).json({ message: 'Cart is empty' });
    const { groups } = await priceCart(cart);
    const subtotal = groups.reduce((s, g) => s + g.itemsTotal, 0);
    const result = await validatePromo(
      req.body.code,
      req.user._id,
      subtotal,
      groups.map((g) => g.partner._id)
    );
    if (result.error) return res.status(400).json({ message: result.error });
    res.json({ code: result.promo.code, discount: result.discount, description: result.promo.description });
  })
);

// POST /api/orders — place order from cart
// { addressId, paymentMethod: 'cod'|'wallet', promoCode?, tip?, note?, scheduledFor?, selfPickup? }
// Gateway payments (stripe/razorpay) do NOT use this route — see /api/payments.
router.post(
  '/',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const { addressId, paymentMethod = 'cod', promoCode, tip = 0, note, scheduledFor, selfPickup = false } = req.body;
    if (!['cod', 'wallet'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Use the payments API for card/UPI payments' });
    }
    const orders = await placeOrderFromCart(req.user, {
      addressId, paymentMethod, promoCode, tip, note, scheduledFor, selfPickup,
    });
    res.status(201).json({ orders });
  })
);

// GET /api/orders/my — customer history
router.get(
  '/my',
  protect,
  asyncH(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const q = { customer: req.user._id, hiddenForCustomer: { $ne: true } };
    if (req.query.status) q.status = req.query.status;
    const [orders, total] = await Promise.all([
      Order.find(q)
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate('partner', 'name partnerProfile.storeName partnerProfile.logo')
        .populate('rider', 'name phone riderProfile.vehicleType riderProfile.ratingAvg riderProfile.ratingCount'),
      Order.countDocuments(q),
    ]);
    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  })
);

// GET /api/orders/partner — partner's orders
router.get(
  '/partner',
  protect,
  authorize('partner'),
  asyncH(async (req, res) => {
    const { page, limit, skip } = paginate(req);
    const q = { partner: req.user._id };
    if (req.query.status) q.status = req.query.status;
    if (req.query.active === 'true')
      q.status = { $in: ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery'] };
    const [orders, total] = await Promise.all([
      Order.find(q)
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate('customer', 'name phone')
        .populate('rider', 'name phone'),
      Order.countDocuments(q),
    ]);
    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  })
);

// GET /api/orders/rider/available — unassigned orders ready for pickup
router.get(
  '/rider/available',
  protect,
  authorize('rider'),
  asyncH(async (req, res) => {
    if (req.user.riderProfile?.kycStatus !== 'approved') {
      return res.json({ orders: [], message: 'Your account is pending approval' });
    }
    const orders = await Order.find({
      rider: null,
      selfPickup: { $ne: true },
      status: { $in: ['confirmed', 'preparing', 'ready'] },
    })
      .sort('createdAt')
      .limit(30)
      .populate('partner', 'name partnerProfile.storeName partnerProfile.address partnerProfile.city')
      .populate('customer', 'name');
    res.json({ orders });
  })
);

// GET /api/orders/rider/mine — rider's assigned orders
router.get(
  '/rider/mine',
  protect,
  authorize('rider'),
  asyncH(async (req, res) => {
    const q = { rider: req.user._id };
    if (req.query.active === 'true')
      q.status = { $in: ['assigned', 'ready', 'picked_up', 'out_for_delivery'] };
    if (req.query.status) q.status = req.query.status;
    const orders = await Order.find(q)
      .sort('-createdAt')
      .limit(50)
      .populate('partner', 'name partnerProfile.storeName partnerProfile.address partnerProfile.lat partnerProfile.lng')
      .populate('customer', 'name phone');
    res.json({ orders });
  })
);

// POST /api/orders/:id/accept — rider claims an order
router.post(
  '/:id/accept',
  protect,
  authorize('rider'),
  asyncH(async (req, res) => {
    if (req.user.riderProfile?.kycStatus !== 'approved') {
      return res.status(403).json({ message: 'Your rider account is not approved yet' });
    }
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, rider: null, selfPickup: { $ne: true }, status: { $in: ['confirmed', 'preparing', 'ready'] } },
      {
        rider: req.user._id,
        status: 'assigned',
        $push: { statusHistory: { status: 'assigned', by: req.user._id } },
      },
      { new: true }
    );
    if (!order) return res.status(400).json({ message: 'Order already taken or not available' });
    await notify(order.customer, 'Rider assigned', `${req.user.name} will deliver your order ${order.orderNumber}.`, { type: 'order', order: order._id });
    await notify(order.partner, 'Rider assigned', `${req.user.name} accepted order ${order.orderNumber}.`, { type: 'order', order: order._id });
    res.json({ order });
  })
);

// GET /api/orders/:id/tracking — live tracking snapshot (v1: get_live_tracking_details)
router.get(
  '/:id/tracking',
  protect,
  asyncH(async (req, res) => {
    const order = await Order.findById(req.params.id)
      .populate('partner', 'name partnerProfile.storeName partnerProfile.address partnerProfile.lat partnerProfile.lng')
      .populate('rider', 'name phone riderProfile.vehicleType riderProfile.currentLat riderProfile.currentLng riderProfile.locationUpdatedAt');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const uid = String(req.user._id);
    const isParty =
      uid === String(order.customer) ||
      uid === String(order.partner?._id) ||
      uid === String(order.rider?._id || '');
    if (!isParty && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not your order' });
    }
    const pp = order.partner?.partnerProfile || {};
    const rp = order.rider?.riderProfile || {};
    res.json({
      tracking: {
        status: order.status,
        selfPickup: order.selfPickup,
        store: {
          label: pp.storeName || order.partner?.name,
          address: pp.address,
          lat: pp.lat ?? null,
          lng: pp.lng ?? null,
        },
        destination: {
          label: order.deliveryAddress?.label,
          address: order.deliveryAddress?.line1,
          lat: order.deliveryAddress?.lat ?? null,
          lng: order.deliveryAddress?.lng ?? null,
        },
        rider: order.rider
          ? {
              name: order.rider.name,
              phone: order.rider.phone,
              vehicleType: rp.vehicleType,
              lat: rp.currentLat ?? null,
              lng: rp.currentLng ?? null,
              updatedAt: rp.locationUpdatedAt || null,
            }
          : null,
      },
    });
  })
);

// GET /api/orders/:id — detail (scoped by role)
router.get(
  '/:id',
  protect,
  asyncH(async (req, res) => {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name phone avatar')
      .populate('partner', 'name phone partnerProfile.storeName partnerProfile.logo partnerProfile.address partnerProfile.lat partnerProfile.lng')
      .populate('rider', 'name phone riderProfile.vehicleType riderProfile.ratingAvg riderProfile.ratingCount riderProfile.currentLat riderProfile.currentLng');
    if (!order) return res.status(404).json({ message: 'Order not found' });
    const uid = String(req.user._id);
    const isParty =
      uid === String(order.customer?._id) ||
      uid === String(order.partner?._id) ||
      uid === String(order.rider?._id || '');
    if (!isParty && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not your order' });
    }
    res.json({ order });
  })
);

async function settleOrder(order) {
  if (order.settled) return;
  const partner = await User.findById(order.partner);
  const commissionPercent = partner?.partnerProfile?.commissionPercent ?? 10;
  const commission = round2((order.itemsTotal * commissionPercent) / 100);
  const partnerEarning = round2(order.itemsTotal + order.taxTotal - commission - order.discount);
  const riderEarning = round2(order.deliveryCharge + order.tip);

  order.commissionAmount = commission;
  order.partnerEarning = Math.max(0, partnerEarning);
  order.riderEarning = riderEarning;
  order.settled = true;
  order.paymentStatus = 'paid';
  order.deliveredAt = new Date();

  await walletAdjust(order.partner, order.partnerEarning, 'order_earning', {
    order: order._id,
    note: `Earning for order ${order.orderNumber} (commission ${commissionPercent}%)`,
  });
  if (order.rider && riderEarning > 0) {
    await walletAdjust(order.rider, riderEarning, 'order_earning', {
      order: order._id,
      note: `Delivery fee + tip for order ${order.orderNumber}`,
    });
  }
  if (order.paymentMethod === 'cod' && order.rider) {
    await User.updateOne(
      { _id: order.rider },
      { $inc: { 'riderProfile.codHeld': order.grandTotal } }
    );
  }

  await grantReferralReward(order).catch((e) => console.error('referral reward failed', e.message));
}

// v1 parity (validate_refer_code + referral settings): when a referred customer's
// FIRST order is delivered, the referrer's wallet is credited. Configure via
// Settings keys `referralAmount` (0/absent = disabled) and `referralMinOrder`.
async function grantReferralReward(order) {
  const keys = ['referralAmount', 'referralMinOrder', 'referralMethod', 'referralMaxAmount', 'referralBonusTimes'];
  const s = Object.fromEntries(
    (await Setting.find({ key: { $in: keys } })).map((x) => [x.key, x.value])
  );

  // `referralAmount` doubles as the on/off switch: 0 or absent = disabled.
  const configured = Number(s.referralAmount || 0);
  if (!configured) return;

  const customer = await User.findById(order.customer).select('referredBy name');
  if (!customer?.referredBy) return;
  if (order.grandTotal < Number(s.referralMinOrder || 0)) return;

  // v1 pays out on the buyer's first N delivered orders (refer_earn_bonus_times),
  // not just the first. This order is already marked settled, so exclude it.
  const bonusTimes = Math.max(1, Number(s.referralBonusTimes || 1));
  const settledBefore = await Order.countDocuments({
    customer: order.customer, settled: true, _id: { $ne: order._id },
  });
  if (settledBefore >= bonusTimes) return;

  // v1 refer_earn_method: 'percentage' (of the order total, capped) or a flat amount.
  let amount = configured;
  if (s.referralMethod === 'percentage') {
    amount = (order.grandTotal * configured) / 100;
    const cap = Number(s.referralMaxAmount || 0);
    if (cap > 0) amount = Math.min(amount, cap);
  }
  amount = Math.round(amount * 100) / 100;
  if (amount <= 0) return;

  await walletAdjust(customer.referredBy, amount, 'referral_bonus', {
    order: order._id,
    note: `Referral bonus — ${customer.name}'s order ${order.orderNumber} was delivered`,
  });
  await notify(customer.referredBy, 'Referral bonus credited 🎉',
    `₹${amount} added to your wallet — ${customer.name} completed an order.`);
}

// Reverse an order: restock, refund the customer, unwind any settlement that was
// already paid out, and give the promo use back. Idempotent on paymentStatus.
export async function refundOrder(order) {
  if (order.paymentStatus === 'refunded') return;

  // restock (variant-aware)
  for (const it of order.items) {
    if (it.product) await restoreItemStock(it);
  }

  // if the order was already settled (delivered), claw back what we paid out
  if (order.settled) {
    if (order.partnerEarning > 0) {
      await walletAdjust(order.partner, -order.partnerEarning, 'order_refund', {
        order: order._id,
        note: `Reversed store earning — order ${order.orderNumber} refunded`,
      }).catch((e) => console.error('partner earning reversal failed', e.message));
    }
    if (order.rider && order.riderEarning > 0) {
      await walletAdjust(order.rider, -order.riderEarning, 'order_refund', {
        order: order._id,
        note: `Reversed delivery earning — order ${order.orderNumber} refunded`,
      }).catch((e) => console.error('rider earning reversal failed', e.message));
    }
    if (order.paymentMethod === 'cod' && order.rider) {
      await User.updateOne(
        { _id: order.rider },
        { $inc: { 'riderProfile.codHeld': -order.grandTotal } }
      );
    }
  }

  // refund the customer for prepaid (wallet/card/UPI) orders
  if (order.paymentStatus === 'paid' && order.paymentMethod !== 'cod') {
    await walletAdjust(order.customer, order.grandTotal, 'order_refund', {
      order: order._id,
      note: `Refund for order ${order.orderNumber}`,
    });
  }
  order.paymentStatus = 'refunded';

  // give the promo use back — only when the last live order of the checkout is gone
  if (order.promoCode && order.checkoutGroup) {
    const remaining = await Order.countDocuments({
      checkoutGroup: order.checkoutGroup,
      promoCode: order.promoCode,
      _id: { $ne: order._id },
      status: { $nin: ['cancelled', 'refunded'] },
    });
    if (!remaining) {
      await PromoCode.updateOne(
        { code: order.promoCode, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } }
      );
    }
  }
}

// PUT /api/orders/:id/status  { status, reason? }
router.put(
  '/:id/status',
  protect,
  asyncH(async (req, res) => {
    const { status, reason } = req.body;
    const rule = STATUS_TRANSITIONS[status];
    if (!rule) return res.status(400).json({ message: 'Invalid status' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const uid = String(req.user._id);
    const role = req.user.role;
    const isOwner =
      (role === 'customer' && uid === String(order.customer)) ||
      (role === 'partner' && uid === String(order.partner)) ||
      (role === 'rider' && uid === String(order.rider || '')) ||
      role === 'admin';
    // self-pickup orders skip the rider leg: partner hands over directly (ready → delivered)
    const pickupHandover =
      order.selfPickup && status === 'delivered' && ['partner', 'admin'].includes(role) &&
      ['ready', 'preparing', 'confirmed'].includes(order.status);

    if (!isOwner || (!rule.roles.includes(role) && !pickupHandover)) {
      return res.status(403).json({ message: 'You cannot set this status' });
    }
    if (!rule.from.includes(order.status) && !pickupHandover) {
      return res
        .status(400)
        .json({ message: `Cannot move from '${order.status}' to '${status}'` });
    }

    order.status = status;
    order.statusHistory.push({ status, by: req.user._id, note: reason });
    if (status === 'cancelled') {
      order.cancelReason = reason || 'No reason given';
      await refundOrder(order);
    }
    if (status === 'refunded') {
      order.cancelReason = reason || order.cancelReason;
      await refundOrder(order);
    }
    if (status === 'delivered') await settleOrder(order);
    await order.save();

    try {
      emit(`order_status_${order._id}`, { status, reason });
    } catch (err) {}

    const labels = {
      confirmed: 'Order confirmed by the store',
      preparing: 'Your order is being prepared',
      ready: 'Order is ready for pickup',
      picked_up: 'Rider picked up your order',
      out_for_delivery: 'Your order is out for delivery',
      delivered: 'Your order was delivered. Enjoy!',
      cancelled: `Order cancelled${reason ? ': ' + reason : ''}`,
      completed: 'Order completed',
      refunded: 'Your refund has been processed',
    };
    if (labels[status]) {
      await notify(order.customer, `Order ${order.orderNumber}`, labels[status], { type: 'order', order: order._id });
    }
    if (status === 'cancelled') {
      await notify(order.partner, `Order ${order.orderNumber} cancelled`, reason || '', { type: 'order', order: order._id });
    }
    res.json({ order });
  })
);

// POST /api/orders/:id/reorder — copy a past order's items into the cart (v1: re_order)
router.post(
  '/:id/reorder',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.customer) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Order not found' });
    }
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

    const added = [];
    const skipped = [];
    for (const it of order.items) {
      if (!it.product) { skipped.push(it.title); continue; }
      const product = await Product.findById(it.product);
      if (!product || product.status !== 'active') { skipped.push(it.title); continue; }
      // re-match variant by id first, then by name (variant ids survive edits; names survive re-creation)
      let variantId;
      if (product.variants.length) {
        const v =
          (it.variantId && product.variants.id(it.variantId)) ||
          product.variants.find((x) => x.name === it.variantName);
        if (!v) { skipped.push(it.title); continue; }
        variantId = String(v._id);
      }
      const addonIds = (it.addons || [])
        .map((a) => product.addons.find((x) => x.name === a.name))
        .filter(Boolean)
        .map((a) => String(a._id));
      cart.items.push({ product: product._id, variantId, addonIds, qty: it.qty, note: it.note });
      added.push(it.title);
    }
    await cart.save();
    if (!added.length) {
      return res.status(400).json({ message: 'None of the items are available anymore', skipped });
    }
    res.json({ message: `${added.length} item(s) added to cart`, added, skipped });
  })
);

// POST /api/orders/:id/rate  { rating, comment?, riderRating?, riderComment? }
router.post(
  '/:id/rate',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.customer) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (!['delivered', 'completed'].includes(order.status)) {
      return res.status(400).json({ message: 'You can rate only delivered orders' });
    }
    if (order.rated) return res.status(400).json({ message: 'Order already rated' });

    const { rating, comment, riderRating, riderComment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be 1-5' });
    }

    const bumpAgg = async (Model, id, path, value) => {
      const doc = await Model.findById(id);
      if (!doc) return;
      const profile = path ? doc[path] : doc;
      const count = profile.ratingCount + 1;
      profile.ratingAvg = Math.round(((profile.ratingAvg * profile.ratingCount + value) / count) * 10) / 10;
      profile.ratingCount = count;
      await doc.save();
    };

    await Review.create({
      user: req.user._id,
      order: order._id,
      partner: order.partner,
      target: 'partner',
      rating,
      comment,
      verifiedPurchase: true,
    });
    await bumpAgg(User, order.partner, 'partnerProfile', rating);

    // also attach the review to each product in the order
    for (const it of order.items) {
      if (!it.product) continue;
      await Review.create({
        user: req.user._id,
        order: order._id,
        product: it.product,
        target: 'product',
        rating,
        comment,
        verifiedPurchase: true,
      });
      await bumpAgg(Product, it.product, null, rating);
    }

    if (order.rider && riderRating >= 1 && riderRating <= 5) {
      await Review.create({
        user: req.user._id,
        order: order._id,
        rider: order.rider,
        target: 'rider',
        rating: riderRating,
        comment: riderComment,
        verifiedPurchase: true,
      });
      await bumpAgg(User, order.rider, 'riderProfile', riderRating);
    }

    order.rated = true;
    if (order.status === 'delivered') {
      order.status = 'completed';
      order.statusHistory.push({ status: 'completed', by: req.user._id, note: 'Auto-completed on rating' });
    }
    await order.save();
    res.json({ message: 'Thanks for your feedback!', order });
  })
);

// GET /api/orders/:id/invoice — v1 Invoice.php / get_invoice_html.
// Rendered server-side and returned as a complete printable A4 document so the
// storefront, partner console and admin console all share one invoice instead of
// each reimplementing the layout (the POS thermal receipt stays client-side — it's
// a different paper size and a different moment).
router.get(
  '/:id/invoice',
  protect,
  asyncH(async (req, res) => {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name phone email')
      .populate('partner', 'name phone partnerProfile.storeName partnerProfile.address');
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const uid = String(req.user._id);
    const isParty =
      uid === String(order.customer?._id) ||
      uid === String(order.partner?._id) ||
      uid === String(order.rider || '');
    if (!isParty && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not your order' });
    }

    const settings = Object.fromEntries(
      (await Setting.find({ key: { $in: ['appName', 'currency', 'supportEmail', 'supportPhone'] } }))
        .map((s) => [s.key, s.value])
    );
    const brand = settings.appName || 'DapiGO';
    const cur = settings.currency || '₹';
    const money = (n) => `${cur}${Number(n || 0).toFixed(2)}`;
    // Escape everything interpolated — order notes and product titles are user input.
    const esc = (s) =>
      String(s ?? '').replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
      );

    const pp = order.partner?.partnerProfile || {};
    const addr = order.deliveryAddress;
    const rows = order.items
      .map(
        (it) => `<tr>
          <td>${esc(it.title)}${it.variantName ? `<br><small>${esc(it.variantName)}</small>` : ''}</td>
          <td class="n">${it.qty}</td>
          <td class="n">${money(it.price)}</td>
          <td class="n">${money(it.lineTotal)}</td>
        </tr>`
      )
      .join('');

    const line = (label, value, cls = '') =>
      `<tr class="${cls}"><td colspan="3" class="n">${label}</td><td class="n">${value}</td></tr>`;

    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${esc(order.orderNumber)}</title>
<style>
  *{box-sizing:border-box}
  body{font:14px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#292929;margin:0;padding:32px;background:#f7f7f7}
  .sheet{max-width:800px;margin:0 auto;background:#fff;padding:40px;border-radius:8px}
  .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #00b3a6;padding-bottom:16px;margin-bottom:24px}
  h1{margin:0;color:#00b3a6;font-size:26px}
  h2{font-size:15px;margin:0 0 6px}
  .muted{color:#6b7280;font-size:13px}
  .cols{display:flex;gap:32px;margin-bottom:24px}
  .cols>div{flex:1}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{padding:10px;border-bottom:1px solid #e5e7eb;text-align:left}
  th{background:#f7f7f7;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
  .n{text-align:right}
  .total td{font-weight:800;font-size:16px;border-top:2px solid #292929;border-bottom:none}
  .badge{display:inline-block;padding:3px 10px;border-radius:99px;background:#e6f7f5;color:#00857a;font-size:12px;font-weight:700}
  @media print{body{background:#fff;padding:0}.sheet{border-radius:0;padding:0}.noprint{display:none}}
</style></head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <h1>${esc(brand)}</h1>
        <div class="muted">${esc(settings.supportEmail || '')} ${esc(settings.supportPhone || '')}</div>
      </div>
      <div style="text-align:right">
        <h2>INVOICE</h2>
        <div class="muted">${esc(order.orderNumber)}</div>
        <div class="muted">${new Date(order.createdAt).toLocaleString()}</div>
        <div style="margin-top:6px"><span class="badge">${esc(order.status)}</span></div>
      </div>
    </div>

    <div class="cols">
      <div>
        <h2>Sold by</h2>
        <div>${esc(pp.storeName || order.partner?.name || '')}</div>
        <div class="muted">${esc(pp.address || '')}</div>
        <div class="muted">${esc(order.partner?.phone || '')}</div>
      </div>
      <div>
        <h2>${order.selfPickup ? 'Picked up by' : 'Delivered to'}</h2>
        <div>${esc(order.customer?.name || '')}</div>
        ${addr && !order.selfPickup
          ? `<div class="muted">${esc(addr.line1 || '')}${addr.area ? ', ' + esc(addr.area) : ''}<br>${esc(addr.city || '')} ${esc(addr.pincode || '')}</div>`
          : '<div class="muted">Self pickup at store</div>'}
        <div class="muted">${esc(order.customer?.phone || '')}</div>
      </div>
    </div>

    <table>
      <thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Amount</th></tr></thead>
      <tbody>
        ${rows}
        ${line('Items total', money(order.itemsTotal))}
        ${line('Tax', money(order.taxTotal))}
        ${order.selfPickup ? '' : line('Delivery', money(order.deliveryCharge))}
        ${order.tip > 0 ? line('Rider tip', money(order.tip)) : ''}
        ${order.discount > 0 ? line(`Discount${order.promoCode ? ' (' + esc(order.promoCode) + ')' : ''}`, '−' + money(order.discount)) : ''}
        ${line('Total', money(order.grandTotal), 'total')}
      </tbody>
    </table>

    <p class="muted" style="margin-top:24px">
      Paid via ${esc((order.paymentMethod || '').toUpperCase())} · payment ${esc(order.paymentStatus)}
      ${order.customerNote ? `<br>Note: ${esc(order.customerNote)}` : ''}
    </p>

    <button class="noprint" onclick="window.print()"
      style="margin-top:16px;padding:10px 18px;border:0;border-radius:8px;background:#00b3a6;color:#fff;font-weight:700;cursor:pointer">
      Print / Save as PDF
    </button>
  </div>
</body></html>`);
  })
);

// GET /api/orders/:id/rate — v1 get_order_rating / get_product_rating / get_rider_rating.
// Read back the review the customer left, so the UI can show "you rated this 4★" rather
// than offering to rate an order that is already rated.
router.get(
  '/:id/rate',
  protect,
  asyncH(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const uid = String(req.user._id);
    const isParty =
      uid === String(order.customer) ||
      uid === String(order.partner) ||
      uid === String(order.rider || '');
    if (!isParty && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not your order' });
    }

    const reviews = await Review.find({ order: order._id })
      .select('target rating comment product partner rider createdAt');

    // v1 exposed these as three separate calls; one round-trip returns all three.
    res.json({
      rated: order.rated,
      order: reviews.find((r) => r.target === 'partner') || null,
      rider: reviews.find((r) => r.target === 'rider') || null,
      products: reviews.filter((r) => r.target === 'product'),
    });
  })
);

// DELETE /api/orders/:id/rate — v1 delete_order_rating / delete_product_rating /
// delete_rider_rating. Removing a review must also unwind the cached average on the
// rated entity, or the aggregates drift permanently upward.
router.delete(
  '/:id/rate',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.customer) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Order not found' });
    }
    const reviews = await Review.find({ order: order._id, user: req.user._id });
    if (!reviews.length) return res.status(404).json({ message: 'No rating to remove' });

    const dropAgg = async (Model, id, path, value) => {
      const doc = await Model.findById(id);
      if (!doc) return;
      const profile = path ? doc[path] : doc;
      const count = profile.ratingCount - 1;
      profile.ratingAvg =
        count > 0 ? Math.round(((profile.ratingAvg * profile.ratingCount - value) / count) * 10) / 10 : 0;
      profile.ratingCount = Math.max(0, count);
      await doc.save();
    };

    for (const r of reviews) {
      if (r.target === 'partner') await dropAgg(User, r.partner, 'partnerProfile', r.rating);
      else if (r.target === 'product') await dropAgg(Product, r.product, null, r.rating);
      else if (r.target === 'rider') await dropAgg(User, r.rider, 'riderProfile', r.rating);
    }
    await Review.deleteMany({ _id: { $in: reviews.map((r) => r._id) } });

    order.rated = false;
    await order.save();
    res.json({ message: 'Rating removed', removed: reviews.length });
  })
);

// DELETE /api/orders/:id — v1 delete_order. Customers may only remove a finished order
// from their own history; live orders must be cancelled, not deleted, and the record is
// kept for the partner/rider/admin ledgers.
router.delete(
  '/:id',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order || String(order.customer) !== String(req.user._id)) {
      return res.status(404).json({ message: 'Order not found' });
    }
    if (!['cancelled', 'refunded', 'completed'].includes(order.status)) {
      return res.status(400).json({ message: 'Only cancelled or completed orders can be removed' });
    }
    order.hiddenForCustomer = true;
    await order.save();
    res.json({ message: 'Order removed from your history' });
  })
);

// POST /api/orders/:id/return  { reason } — v1 Return_request.php (customer side).
// Window controlled by Settings key `returnWindowDays` (default 7).
router.post(
  '/:id/return',
  protect,
  authorize('customer'),
  asyncH(async (req, res) => {
    const order = await Order.findOne({ _id: req.params.id, customer: req.user._id });
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (!['delivered', 'completed'].includes(order.status)) {
      return res.status(400).json({ message: 'Only delivered orders can be returned' });
    }
    const reason = (req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ message: 'Please tell us why you want to return this order' });
    const windowSetting = await Setting.findOne({ key: 'returnWindowDays' });
    const windowDays = Number(windowSetting?.value ?? 7);
    const deliveredAt = order.deliveredAt || order.updatedAt;
    if (Date.now() - new Date(deliveredAt).getTime() > windowDays * 86400000) {
      return res.status(400).json({ message: `Return window (${windowDays} days) has passed` });
    }
    const existing = await ReturnRequest.findOne({ order: order._id });
    if (existing) return res.status(400).json({ message: `A return request already exists (${existing.status})` });
    const request = await ReturnRequest.create({ order: order._id, customer: req.user._id, reason });
    res.status(201).json({ request });
  })
);

// GET /api/orders/:id/return — customer checks their request status
router.get(
  '/:id/return',
  protect,
  asyncH(async (req, res) => {
    const request = await ReturnRequest.findOne({ order: req.params.id, customer: req.user._id });
    res.json({ request });
  })
);

export default router;
