import { Notification } from '../models/Misc.js';
import { Transaction } from '../models/Finance.js';
import User from '../models/User.js';

export async function notify(userId, title, body, extra = {}) {
  try {
    await Notification.create({ user: userId, title, body, ...extra });
  } catch (e) {
    console.error('notify failed', e.message);
  }
  // Mirror every in-app notification to the user's devices when FCM is
  // configured (no-op in dev mode). Fire-and-forget — never block the caller.
  (async () => {
    const { sendPush } = await import('../services/comms.js');
    const user = await User.findById(userId).select('email fcmToken fcmTokens');
    if (!user) return;
    if (!user.fcmTokens?.length && user.fcmToken) user.fcmTokens = [user.fcmToken];
    await sendPush(user, title, body, extra);
  })().catch((e) => console.error('push failed', e.message));
}

/**
 * Adjust a user's wallet and record the transaction. amount > 0 credit, < 0 debit.
 * Uses an atomic conditional $inc so concurrent adjustments can't lose updates or
 * drive the balance negative (previous read-modify-write was racy).
 */
export async function walletAdjust(userId, amount, source, { order, note } = {}) {
  const delta = Math.round(amount * 100) / 100;
  const filter = { _id: userId };
  // For debits, only apply if the balance is high enough — atomically.
  if (delta < 0) filter.walletBalance = { $gte: -delta };

  const user = await User.findOneAndUpdate(
    filter,
    { $inc: { walletBalance: delta } },
    { new: true }
  );
  if (!user) {
    const exists = await User.exists({ _id: userId });
    const err = new Error(exists ? 'Insufficient wallet balance' : 'Wallet user not found');
    err.status = exists ? 400 : 500;
    throw err;
  }

  // Keep the stored balance free of floating-point drift for display.
  const newBalance = Math.round(user.walletBalance * 100) / 100;
  if (newBalance !== user.walletBalance) {
    await User.updateOne({ _id: userId }, { $set: { walletBalance: newBalance } });
  }

  await Transaction.create({
    user: userId,
    type: delta >= 0 ? 'credit' : 'debit',
    amount: Math.abs(delta),
    balanceAfter: newBalance,
    source,
    order,
    note,
  });
  return newBalance;
}

export function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function paginate(req, defLimit = 20) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || defLimit);
  return { page, limit, skip: (page - 1) * limit };
}
