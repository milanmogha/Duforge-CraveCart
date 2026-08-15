import { Router } from 'express';
import crypto from 'crypto';
import { Floor, DiningTable, Waiter, TableBooking } from '../models/DineIn.js';
import { Product } from '../models/Catalog.js';
import { Order } from '../models/Order.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { notify } from '../utils/helpers.js';

// v1 parity: partner dine-in module (Table_booking.php + Point_of_sale.php).
// Everything here is partner-scoped; the customer-facing booking endpoint
// lives in routes/catalog.js.
const router = Router();
router.use(protect, authorize('partner'));

// ---- Floors / Tables / Waiters CRUD ----
const round2 = (n) => Math.round(n * 100) / 100;
for (const [path, Model, fields] of [
  ['floors', Floor, ['title', 'active']],
  ['tables', DiningTable, ['title', 'floor', 'capacity', 'active']],
  ['waiters', Waiter, ['name', 'phone', 'active']],
]) {
  router.get(`/${path}`, asyncH(async (req, res) => {
    const items = await Model.find({ partner: req.user._id }).sort('-createdAt')
      .populate(path === 'tables' ? { path: 'floor', select: 'title' } : []);
    res.json({ items });
  }));
  router.post(`/${path}`, asyncH(async (req, res) => {
    const data = { partner: req.user._id };
    for (const k of fields) if (req.body[k] !== undefined) data[k] = req.body[k];
    const item = await Model.create(data);
    res.status(201).json({ item });
  }));
  router.put(`/${path}/:id`, asyncH(async (req, res) => {
    const item = await Model.findOne({ _id: req.params.id, partner: req.user._id });
    if (!item) return res.status(404).json({ message: 'Not found' });
    for (const k of fields) if (req.body[k] !== undefined) item[k] = req.body[k];
    await item.save();
    res.json({ item });
  }));
  router.delete(`/${path}/:id`, asyncH(async (req, res) => {
    const item = await Model.findOneAndDelete({ _id: req.params.id, partner: req.user._id });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  }));
}

// ---- Table bookings (partner side) ----
router.get(
  '/bookings',
  asyncH(async (req, res) => {
    const q = { partner: req.user._id };
    if (req.query.status) q.status = req.query.status;
    if (req.query.date) {
      const day = new Date(req.query.date);
      q.bookedFor = { $gte: day, $lt: new Date(day.getTime() + 86400000) };
    }
    const items = await TableBooking.find(q).sort('bookedFor').limit(200)
      .populate('table', 'title capacity');
    res.json({ items });
  })
);
router.put(
  '/bookings/:id',
  asyncH(async (req, res) => {
    const booking = await TableBooking.findOne({ _id: req.params.id, partner: req.user._id });
    if (!booking) return res.status(404).json({ message: 'Not found' });
    const allowed = ['status', 'table', 'note', 'bookedFor', 'partySize'];
    for (const k of allowed) if (req.body[k] !== undefined) booking[k] = req.body[k];
    await booking.save();
    if (req.body.status && booking.customer) {
      await notify(booking.customer, `Table booking ${booking.status}`,
        `Your table booking for ${new Date(booking.bookedFor).toLocaleString('en-IN')} is now ${booking.status}.`);
    }
    res.json({ booking });
  })
);

// ---- POS billing (v1 Point_of_sale.php) ----
// Walk-in / dine-in sale: server-authoritative pricing over the partner's own
// products; the order is created already delivered & paid (cash stays with the
// store, so no wallet settlement is made — recorded for reporting only).
router.post(
  '/pos/orders',
  asyncH(async (req, res) => {
    if (req.user.partnerProfile?.kycStatus !== 'approved') {
      return res.status(403).json({ message: 'Store must be approved before using POS' });
    }
    const { items = [], orderType = 'pos', table, waiter, customerName, customerPhone, discount = 0 } = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ message: 'Add at least one item' });
    if (!['pos', 'dine_in'].includes(orderType)) return res.status(400).json({ message: 'orderType must be pos or dine_in' });

    const orderItems = [];
    let itemsTotal = 0;
    let taxTotal = 0;
    for (const line of items) {
      const product = await Product.findOne({ _id: line.productId, partner: req.user._id })
        .populate('tax', 'percentage active');
      if (!product) return res.status(400).json({ message: 'Product not found in your store' });
      const qty = Math.max(1, Number(line.qty) || 1);
      let unitPrice = product.salePrice ?? product.price;
      let variantName = null;
      if (line.variantId) {
        const v = product.variants.id(line.variantId);
        if (!v) return res.status(400).json({ message: `Variant not found for ${product.title}` });
        unitPrice = v.price;
        variantName = v.name;
      }
      const lineTotal = round2(unitPrice * qty);
      const taxPercent = product.tax?.active ? product.tax.percentage : product.taxPercent;
      const effectiveTax = product.isPriceInclusiveTax ? 0 : taxPercent;
      itemsTotal = round2(itemsTotal + lineTotal);
      taxTotal = round2(taxTotal + (lineTotal * effectiveTax) / 100);
      orderItems.push({
        product: product._id,
        title: product.title,
        image: product.images[0] || null,
        variantName,
        unitPrice,
        taxPercent: effectiveTax,
        qty,
        lineTotal,
      });
    }

    const disc = Math.min(Math.max(0, Number(discount) || 0), itemsTotal);
    const grandTotal = round2(itemsTotal + taxTotal - disc);

    // Walk-in customer: reuse by phone or register a lightweight account
    // (v1 POS registers customers the same way). Falls back to a per-store
    // guest account when no details are given.
    let customerId = null;
    const phone = (customerPhone || '').trim();
    if (phone) {
      const existing = await User.findOne({ phone, role: 'customer' });
      if (existing) customerId = existing._id;
      else {
        const guest = await User.create({
          name: customerName?.trim() || 'Walk-in customer',
          email: `walkin-${phone}@pos.cravecart.local`,
          phone,
          password: crypto.randomBytes(9).toString('base64url'),
          role: 'customer',
        });
        customerId = guest._id;
      }
    } else {
      const guestEmail = `walkin-${req.user._id}@pos.cravecart.local`;
      let guest = await User.findOne({ email: guestEmail });
      if (!guest) {
        guest = await User.create({
          name: 'Walk-in customer',
          email: guestEmail,
          password: crypto.randomBytes(9).toString('base64url'),
          role: 'customer',
        });
      }
      customerId = guest._id;
    }

    const now = new Date();
    const order = await Order.create({
      customer: customerId,
      partner: req.user._id,
      items: orderItems,
      itemsTotal,
      taxTotal,
      discount: disc,
      grandTotal,
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      status: 'completed',
      statusHistory: [
        { status: 'pending', at: now },
        { status: 'completed', by: req.user._id, at: now },
      ],
      selfPickup: true,
      orderType,
      table: table || null,
      waiter: waiter || null,
      deliveredAt: now,
      settled: true,
      partnerEarning: grandTotal, // cash already with the store; no wallet movement
    });

    // decrement stock like a normal sale
    for (const it of orderItems) {
      if (it.variantName) {
        await Product.updateOne(
          { _id: it.product, 'variants.name': it.variantName },
          { $inc: { 'variants.$.stock': -it.qty, soldCount: it.qty } }
        );
      } else {
        await Product.updateOne({ _id: it.product }, { $inc: { stock: -it.qty, soldCount: it.qty } });
      }
    }

    const populated = await Order.findById(order._id).populate('table', 'title').populate('waiter', 'name');
    res.status(201).json({ order: populated });
  })
);

// GET /api/dinein/pos/orders — recent POS / dine-in sales
router.get(
  '/pos/orders',
  asyncH(async (req, res) => {
    const items = await Order.find({ partner: req.user._id, orderType: { $in: ['pos', 'dine_in'] } })
      .sort('-createdAt').limit(50)
      .populate('table', 'title').populate('waiter', 'name').populate('customer', 'name phone');
    res.json({ items });
  })
);

export default router;
