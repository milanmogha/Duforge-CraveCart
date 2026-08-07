// Background jobs (v1 parity: admin Cron_job.php) — plain setInterval, no
// external scheduler. Tunable via Settings keys:
//   autoCancelMinutes  — cancel unaccepted `pending` orders after N minutes (0/absent = off)
//   autoCompleteDays   — move `delivered` orders to `completed` after N days (default 3, 0 = off)
import { Order } from './models/Order.js';
import { Setting } from './models/Misc.js';
import { notify } from './utils/helpers.js';

const EVERY = 5 * 60 * 1000;

async function getNumberSetting(key, def) {
  const s = await Setting.findOne({ key });
  const n = Number(s?.value);
  return Number.isFinite(n) ? n : def;
}

async function autoCancelStalePending() {
  const minutes = await getNumberSetting('autoCancelMinutes', 0);
  if (!minutes) return;
  const cutoff = new Date(Date.now() - minutes * 60000);
  const stale = await Order.find({ status: 'pending', createdAt: { $lt: cutoff } }).limit(50);
  for (const order of stale) {
    order.status = 'cancelled';
    order.cancelReason = `Auto-cancelled — store did not accept within ${minutes} minutes`;
    order.statusHistory.push({ status: 'cancelled', at: new Date() });
    await order.save();
    // refund prepaid amounts back to the wallet, same as a manual cancel
    const { refundOrder } = await import('./routes/orders.js');
    await refundOrder(order).catch((e) => console.error('auto-cancel refund failed', e.message));
    await order.save();
    await notify(order.customer, 'Order auto-cancelled',
      `Order ${order.orderNumber} was cancelled because the store did not accept it in time. Any payment was refunded to your wallet.`);
  }
  if (stale.length) console.log(`[jobs] auto-cancelled ${stale.length} stale pending order(s)`);
}

async function autoCompleteDelivered() {
  const days = await getNumberSetting('autoCompleteDays', 3);
  if (!days) return;
  const cutoff = new Date(Date.now() - days * 86400000);
  const { modifiedCount } = await Order.updateMany(
    { status: 'delivered', deliveredAt: { $lt: cutoff } },
    { $set: { status: 'completed' }, $push: { statusHistory: { status: 'completed', at: new Date() } } }
  );
  if (modifiedCount) console.log(`[jobs] auto-completed ${modifiedCount} delivered order(s)`);
}

export function startJobs() {
  const tick = () => {
    autoCancelStalePending().catch((e) => console.error('[jobs] auto-cancel failed:', e.message));
    autoCompleteDelivered().catch((e) => console.error('[jobs] auto-complete failed:', e.message));
  };
  setTimeout(tick, 15000); // first run shortly after boot
  setInterval(tick, EVERY);
  console.log('[jobs] background jobs started (every 5 min)');
}
