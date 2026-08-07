import mongoose from 'mongoose';
import { Order, Cart, PromoCode } from '../models/Order.js';
import { Product } from '../models/Catalog.js';
import { Setting } from '../models/Misc.js';
import { notify, walletAdjust } from '../utils/helpers.js';
import { priceCart } from '../routes/cart.js';

const round2 = (n) => Math.round(n * 100) / 100;
const fail = (message, status = 400) => {
  const err = new Error(message);
  err.status = status;
  throw err;
};

/** Atomically decrement stock for one order line (variant-aware). Returns false if short. */
async function decItemStock(it) {
  if (it.variantId) {
    const r = await Product.updateOne(
      { _id: it.product, variants: { $elemMatch: { _id: it.variantId, stock: { $gte: it.qty } } } },
      { $inc: { 'variants.$.stock': -it.qty, soldCount: it.qty } }
    );
    return r.modifiedCount === 1;
  }
  const r = await Product.updateOne(
    { _id: it.product, stock: { $gte: it.qty } },
    { $inc: { stock: -it.qty, soldCount: it.qty } }
  );
  return r.modifiedCount === 1;
}

/** Reverse decItemStock (used on rollback and on refund/cancel). */
export async function restoreItemStock(it) {
  if (it.variantId) {
    await Product.updateOne(
      { _id: it.product, 'variants._id': it.variantId },
      { $inc: { 'variants.$.stock': it.qty, soldCount: -it.qty } }
    );
  } else {
    await Product.updateOne({ _id: it.product }, { $inc: { stock: it.qty, soldCount: -it.qty } });
  }
}

export async function validatePromo(code, userId, subtotal, partnerIds) {
  const promo = await PromoCode.findOne({ code: String(code).toUpperCase(), active: true });
  if (!promo) return { error: 'Invalid promo code' };
  const now = new Date();
  if (promo.startsAt && promo.startsAt > now) return { error: 'Promo not started yet' };
  if (promo.endsAt && promo.endsAt < now) return { error: 'Promo has expired' };
  if (promo.usageLimit > 0 && promo.usedCount >= promo.usageLimit)
    return { error: 'Promo usage limit reached' };
  if (promo.partner && !partnerIds.includes(String(promo.partner)))
    return { error: 'Promo not valid for this store' };
  if (subtotal < promo.minOrder)
    return { error: `Minimum order of ${promo.minOrder} required for this promo` };
  if (promo.perUserLimit > 0) {
    // Count distinct checkouts, not split orders: a multi-store cart makes several
    // orders that share one checkoutGroup and must count as a single use.
    const match = {
      customer: userId,
      promoCode: promo.code,
      status: { $nin: ['cancelled', 'refunded'] },
    };
    const groups = await Order.distinct('checkoutGroup', match);
    const legacy = await Order.countDocuments({ ...match, checkoutGroup: null });
    const used = groups.filter(Boolean).length + legacy;
    if (used >= promo.perUserLimit) return { error: 'You have already used this promo' };
  }
  let discount =
    promo.type === 'percent' ? (subtotal * promo.value) / 100 : Math.min(promo.value, subtotal);
  if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
  return { promo, discount: round2(discount) };
}

// v1 parity (Web_setting.php): platform-wide cart limits; 0/unset = off.
// Runs on both quote and place so COD/wallet orders can't bypass it.
async function enforceCartLimits(groups, subtotal) {
  const rows = await Setting.find({ key: { $in: ['maxCartItems', 'minCartAmount'] } });
  const limit = Object.fromEntries(rows.map((s) => [s.key, Number(s.value) || 0]));
  const itemCount = groups.reduce((s, g) => s + g.items.reduce((n, i) => n + i.qty, 0), 0);
  if (limit.maxCartItems > 0 && itemCount > limit.maxCartItems) {
    fail(`Cart can hold at most ${limit.maxCartItems} item(s)`);
  }
  if (limit.minCartAmount > 0 && subtotal < limit.minCartAmount) {
    fail(`Minimum order amount is ${limit.minCartAmount}`);
  }
}

/**
 * Price the user's cart exactly as checkout would, without placing anything.
 * Returns { grandTotal, groups, subtotal, discount }.
 */
export async function quoteCart(user, { promoCode, tip = 0, selfPickup = false } = {}) {
  const cart = await Cart.findOne({ user: user._id });
  if (!cart || !cart.items.length) fail('Cart is empty');
  const { groups, invalid } = await priceCart(cart);
  if (invalid.length) fail('Some items are no longer available');
  if (!groups.length) fail('Cart is empty');
  if (selfPickup) groups.forEach((g) => (g.deliveryCharge = 0));

  const subtotal = groups.reduce((s, g) => s + g.itemsTotal, 0);
  await enforceCartLimits(groups, subtotal);

  let discount = 0;
  if (promoCode) {
    const result = await validatePromo(promoCode, user._id, subtotal, groups.map((g) => g.partner._id));
    if (result.error) fail(result.error);
    discount = result.discount;
  }
  const grandTotal = round2(
    groups.reduce((s, g) => s + g.itemsTotal + g.taxTotal + g.deliveryCharge, 0) +
      (selfPickup ? 0 : Number(tip || 0)) -
      discount
  );
  return { grandTotal, subtotal, discount, groups };
}

/**
 * Place order(s) from the user's cart — one Order per partner group.
 * opts: { addressId, paymentMethod, promoCode, tip, note, scheduledFor, selfPickup, expectPaidAmount }
 * For gateway methods (stripe/razorpay) the payment must already be verified by the caller;
 * pass expectPaidAmount to guard against the cart changing between intent and confirmation.
 */
export async function placeOrderFromCart(user, opts = {}) {
  const {
    addressId,
    paymentMethod = 'cod',
    promoCode,
    tip = 0,
    note,
    scheduledFor,
    selfPickup = false,
    expectPaidAmount,
  } = opts;

  const address = user.addresses.id(addressId) || user.addresses.find((a) => a.isDefault);
  if (!address && !selfPickup) fail('Please select a delivery address');

  const cart = await Cart.findOne({ user: user._id });
  if (!cart || !cart.items.length) fail('Cart is empty');

  const { groups, invalid } = await priceCart(cart);
  if (invalid.length) {
    const err = new Error('Some items are no longer available');
    err.status = 400;
    err.invalid = invalid;
    throw err;
  }
  if (!groups.length) fail('Cart is empty');

  for (const g of groups) {
    if (!g.partner.isOpen) fail(`${g.partner.storeName} is currently closed`);
    if (g.itemsTotal < g.partner.minOrder)
      fail(`${g.partner.storeName} requires a minimum order of ${g.partner.minOrder}`);
    for (const it of g.items) {
      if (it.stock < it.qty) fail(`Insufficient stock for ${it.title}`);
    }
  }

  const subtotal = groups.reduce((s, g) => s + g.itemsTotal, 0);
  await enforceCartLimits(groups, subtotal);
  let promo = null;
  let totalDiscount = 0;
  if (promoCode) {
    const result = await validatePromo(promoCode, user._id, subtotal, groups.map((g) => g.partner._id));
    if (result.error) fail(result.error);
    promo = result.promo;
    totalDiscount = result.discount;
  }

  if (selfPickup) groups.forEach((g) => (g.deliveryCharge = 0));

  const effectiveTip = selfPickup ? 0 : Number(tip || 0);
  const grandAll = round2(
    groups.reduce((s, g) => s + g.itemsTotal + g.taxTotal + g.deliveryCharge, 0) +
      effectiveTip -
      totalDiscount
  );

  if (expectPaidAmount != null && Math.abs(grandAll - expectPaidAmount) > 0.01) {
    fail(
      `Cart total (${grandAll}) no longer matches the paid amount (${expectPaidAmount}). Payment will be refunded to your wallet — please try again.`
    );
  }
  if (paymentMethod === 'wallet' && user.walletBalance < grandAll) {
    fail('Insufficient wallet balance');
  }

  const isGateway = ['stripe', 'razorpay'].includes(paymentMethod);
  const checkoutGroup = new mongoose.Types.ObjectId();

  // Reserve stock atomically up front so concurrent checkouts can't oversell.
  // If any line is short, roll back everything already reserved and fail cleanly.
  const allItems = groups.flatMap((g) => g.items);
  const reserved = [];
  for (const it of allItems) {
    if (await decItemStock(it)) {
      reserved.push(it);
    } else {
      for (const done of reserved) await restoreItemStock(done);
      fail(`Insufficient stock for ${it.title}`);
    }
  }

  const orders = [];
  let walletDebited = 0;
  try {
    for (const [idx, g] of groups.entries()) {
      // platform promo: discount split proportionally; partner promo: only that partner's group
      let discount = 0;
      if (promo) {
        if (promo.partner) discount = String(promo.partner) === g.partner._id ? totalDiscount : 0;
        else discount = round2((totalDiscount * g.itemsTotal) / subtotal);
      }
      const orderTip = idx === 0 ? effectiveTip : 0; // tip goes with first order's rider
      const grandTotal = round2(g.itemsTotal + g.taxTotal + g.deliveryCharge + orderTip - discount);

      const order = await Order.create({
        customer: user._id,
        checkoutGroup,
        partner: g.partner._id,
        items: g.items.map(({ cartItemId, stock, ...it }) => it),
        itemsTotal: g.itemsTotal,
        taxTotal: g.taxTotal,
        deliveryCharge: g.deliveryCharge,
        tip: orderTip,
        discount,
        promoCode: promo ? promo.code : undefined,
        grandTotal,
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
        selfPickup,
        deliveryAddress: selfPickup
          ? { label: 'Self pickup', line1: 'Pickup at store', city: '' }
          : address.toObject(),
        customerNote: note,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
        statusHistory: [{ status: 'pending', by: user._id }],
      });

      if (paymentMethod === 'wallet') {
        await walletAdjust(user._id, -grandTotal, 'order_payment', {
          order: order._id,
          note: `Payment for order ${order.orderNumber}`,
        });
        walletDebited = round2(walletDebited + grandTotal);
      }
      await notify(
        g.partner._id,
        'New order received',
        `Order ${order.orderNumber} — ${g.items.length} item(s), total ${grandTotal}${isGateway ? ' (prepaid)' : ''}`,
        { type: 'order', order: order._id }
      );
      orders.push(order);
    }
  } catch (e) {
    // Undo partial work so a mid-loop failure can't leak stock/money or orphan orders.
    for (const it of reserved) await restoreItemStock(it);
    if (walletDebited > 0) {
      await walletAdjust(user._id, walletDebited, 'order_refund', { note: 'Reversed failed checkout' });
    }
    if (orders.length) await Order.deleteMany({ _id: { $in: orders.map((o) => o._id) } });
    throw e;
  }

  if (promo) await PromoCode.updateOne({ _id: promo._id }, { $inc: { usedCount: 1 } });

  cart.items = [];
  await cart.save();
  await notify(
    user._id,
    'Order placed',
    `Your order${orders.length > 1 ? 's have' : ' has'} been placed successfully.`,
    { type: 'order', order: orders[0]._id }
  );
  return orders;
}
