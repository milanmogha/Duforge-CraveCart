import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { Router } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { Category, Product, Tax, Attribute, Tag } from '../models/Catalog.js';
import { Order, PromoCode } from '../models/Order.js';
import { Transaction, WithdrawalRequest, ReturnRequest } from '../models/Finance.js';
import { refundOrder } from './orders.js';
import { Slider, Offer, Setting, Page, Faq, Review, AuditLog, City, FeaturedSection, Media, Language, ApiKey } from '../models/Misc.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { slugify, paginate, notify, walletAdjust } from '../utils/helpers.js';

const router = Router();
router.use(protect, authorize('admin'));

async function audit(req, action, resource, resourceId, detail) {
  try {
    await AuditLog.create({ actor: req.user._id, action, resource, resourceId: String(resourceId || ''), detail });
  } catch { /* non-fatal */ }
}

// ---- Dashboard ----
router.get(
  '/dashboard',
  asyncH(async (req, res) => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [customers, partners, riders, products, totalOrders, todayOrders, salesAgg, statusAgg, pendingKyc, pendingWithdrawals, recentOrders] =
      await Promise.all([
        User.countDocuments({ role: 'customer' }),
        User.countDocuments({ role: 'partner' }),
        User.countDocuments({ role: 'rider' }),
        Product.countDocuments(),
        Order.countDocuments(),
        Order.countDocuments({ createdAt: { $gte: todayStart } }),
        Order.aggregate([
          { $match: { status: { $nin: ['cancelled', 'refunded'] } } },
          { $group: { _id: null, sales: { $sum: '$grandTotal' }, commission: { $sum: '$commissionAmount' } } },
        ]),
        Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        User.countDocuments({
          $or: [
            { role: 'partner', 'partnerProfile.kycStatus': 'pending' },
            { role: 'rider', 'riderProfile.kycStatus': 'pending' },
          ],
        }),
        WithdrawalRequest.countDocuments({ status: 'pending' }),
        Order.find().sort('-createdAt').limit(8)
          .populate('customer', 'name')
          .populate('partner', 'partnerProfile.storeName name'),
      ]);
    const since = new Date(Date.now() - 13 * 86400000);
    since.setHours(0, 0, 0, 0);
    const daily = await Order.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $nin: ['cancelled', 'refunded'] } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$grandTotal' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    res.json({
      counts: { customers, partners, riders, products, totalOrders, todayOrders, pendingKyc, pendingWithdrawals },
      totalSales: salesAgg[0]?.sales || 0,
      totalCommission: salesAgg[0]?.commission || 0,
      statusBreakdown: Object.fromEntries(statusAgg.map((s) => [s._id, s.count])),
      daily,
      recentOrders,
    });
  })
);

// ---- Users ----
router.get(
  '/users',
  asyncH(async (req, res) => {
    const { page, limit, skip } = paginate(req, 25);
    const q = {};
    if (req.query.role) q.role = req.query.role;
    if (req.query.status) q.status = req.query.status;
    if (req.query.kyc === 'pending') {
      q.$or = [
        { 'partnerProfile.kycStatus': 'pending' },
        { 'riderProfile.kycStatus': 'pending' },
      ];
    }
    if (req.query.search) {
      q.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') },
        { phone: new RegExp(req.query.search, 'i') },
      ];
    }
    const [users, total] = await Promise.all([
      User.find(q).sort('-createdAt').skip(skip).limit(limit),
      User.countDocuments(q),
    ]);
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  })
);

// PUT /api/admin/users/:id — status, kyc, commission
router.put(
  '/users/:id',
  asyncH(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const { status, kycStatus, kycRejectReason, commissionPercent } = req.body;
    if (status && ['active', 'suspended', 'deleted'].includes(status)) user.status = status;
    if (kycStatus && ['approved', 'rejected', 'pending'].includes(kycStatus)) {
      const profile = user.role === 'partner' ? user.partnerProfile : user.role === 'rider' ? user.riderProfile : null;
      if (profile) {
        profile.kycStatus = kycStatus;
        if (kycRejectReason) profile.kycRejectReason = kycRejectReason;
        await notify(
          user._id,
          kycStatus === 'approved' ? 'Account approved 🎉' : `KYC ${kycStatus}`,
          kycStatus === 'approved'
            ? 'Your account has been approved. You can start operating now.'
            : kycRejectReason || `Your KYC was marked ${kycStatus}.`,
          { type: 'account' }
        );
      }
    }
    if (commissionPercent !== undefined && user.partnerProfile) {
      user.partnerProfile.commissionPercent = Number(commissionPercent);
    }
    await user.save();
    await audit(req, 'update_user', 'user', user._id, req.body);
    res.json({ user: user.toSafe() });
  })
);

// ---- Categories ----
router.get('/categories', asyncH(async (req, res) => {
  res.json({ categories: await Category.find().sort('sortOrder') });
}));

router.post(
  '/categories',
  asyncH(async (req, res) => {
    const { name, image, parent, sortOrder, active } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });
    const category = await Category.create({
      name, image, parent: parent || null, sortOrder, active,
      slug: slugify(name) + '-' + Date.now().toString(36),
    });
    await audit(req, 'create', 'category', category._id);
    res.status(201).json({ category });
  })
);

router.put(
  '/categories/:id',
  asyncH(async (req, res) => {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ message: 'Category not found' });
    for (const k of ['name', 'image', 'parent', 'sortOrder', 'active']) {
      if (req.body[k] !== undefined) category[k] = req.body[k];
    }
    await category.save();
    await audit(req, 'update', 'category', category._id, req.body);
    res.json({ category });
  })
);

router.delete(
  '/categories/:id',
  asyncH(async (req, res) => {
    const inUse = await Product.countDocuments({ category: req.params.id });
    if (inUse) return res.status(400).json({ message: `${inUse} product(s) use this category` });
    await Category.findByIdAndDelete(req.params.id);
    await audit(req, 'delete', 'category', req.params.id);
    res.json({ message: 'Category deleted' });
  })
);

// ---- Products (all partners) ----
router.get(
  '/products',
  asyncH(async (req, res) => {
    const { page, limit, skip } = paginate(req, 25);
    const q = {};
    if (req.query.search) q.title = new RegExp(req.query.search, 'i');
    if (req.query.status) q.status = req.query.status;
    if (req.query.partner) q.partner = req.query.partner;
    const [products, total] = await Promise.all([
      Product.find(q).sort('-createdAt').skip(skip).limit(limit)
        .populate('category', 'name')
        .populate('partner', 'name partnerProfile.storeName'),
      Product.countDocuments(q),
    ]);
    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  })
);

router.put(
  '/products/:id',
  asyncH(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    for (const k of ['status', 'featured', 'sortOrder']) {
      if (req.body[k] !== undefined) product[k] = req.body[k];
    }
    await product.save();
    await audit(req, 'update', 'product', product._id, req.body);
    res.json({ product });
  })
);

router.delete(
  '/products/:id',
  asyncH(async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    await audit(req, 'delete', 'product', req.params.id);
    res.json({ message: 'Product deleted' });
  })
);

// ---- Orders ----
router.get(
  '/orders',
  asyncH(async (req, res) => {
    const { page, limit, skip } = paginate(req, 25);
    const q = {};
    if (req.query.status) q.status = req.query.status;
    if (req.query.search) q.orderNumber = new RegExp(req.query.search, 'i');
    const [orders, total] = await Promise.all([
      Order.find(q).sort('-createdAt').skip(skip).limit(limit)
        .populate('customer', 'name email')
        .populate('partner', 'name partnerProfile.storeName')
        .populate('rider', 'name'),
      Order.countDocuments(q),
    ]);
    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  })
);

// ---- Promo codes (platform) ----
router.get('/promos', asyncH(async (req, res) => {
  res.json({ promos: await PromoCode.find().sort('-createdAt').populate('partner', 'partnerProfile.storeName name') });
}));

router.post(
  '/promos',
  asyncH(async (req, res) => {
    const promo = await PromoCode.create({ ...req.body, partner: req.body.partner || null });
    await audit(req, 'create', 'promo', promo._id);
    res.status(201).json({ promo });
  })
);

router.put(
  '/promos/:id',
  asyncH(async (req, res) => {
    const promo = await PromoCode.findById(req.params.id);
    if (!promo) return res.status(404).json({ message: 'Promo not found' });
    const allowed = ['description', 'type', 'value', 'minOrder', 'maxDiscount', 'usageLimit', 'perUserLimit', 'startsAt', 'endsAt', 'active'];
    for (const k of allowed) if (req.body[k] !== undefined) promo[k] = req.body[k];
    await promo.save();
    res.json({ promo });
  })
);

router.delete('/promos/:id', asyncH(async (req, res) => {
  await PromoCode.findByIdAndDelete(req.params.id);
  res.json({ message: 'Promo deleted' });
}));

// ---- Featured sections ----
router.get(
  '/sections',
  asyncH(async (req, res) => {
    const items = await FeaturedSection.find().sort('sortOrder').populate('products', 'title images price');
    res.json({ items });
  })
);
router.post(
  '/sections',
  asyncH(async (req, res) => {
    const item = await FeaturedSection.create(req.body);
    await audit(req, 'create', 'section', item._id);
    res.status(201).json({ item });
  })
);
router.put(
  '/sections/:id',
  asyncH(async (req, res) => {
    const item = await FeaturedSection.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json({ item });
  })
);
router.delete(
  '/sections/:id',
  asyncH(async (req, res) => {
    await FeaturedSection.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  })
);

// ---- Sliders, Offers, Cities, Taxes, Attributes & Tags ----
for (const [path, Model] of [['sliders', Slider], ['offers', Offer], ['cities', City], ['taxes', Tax], ['attributes', Attribute], ['tags', Tag], ['languages', Language]]) {
  router.get(`/${path}`, asyncH(async (req, res) => {
    res.json({ items: await Model.find().sort('sortOrder -createdAt') });
  }));
  router.post(`/${path}`, asyncH(async (req, res) => {
    const item = await Model.create(req.body);
    await audit(req, 'create', path, item._id);
    res.status(201).json({ item });
  }));
  router.put(`/${path}/:id`, asyncH(async (req, res) => {
    const item = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json({ item });
  }));
  router.delete(`/${path}/:id`, asyncH(async (req, res) => {
    await Model.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  }));
}

// ---- Media library (all uploads) ----
router.get(
  '/media',
  asyncH(async (req, res) => {
    const { page, limit, skip } = paginate(req, 60);
    const [items, total] = await Promise.all([
      Media.find().sort('-createdAt').skip(skip).limit(limit).populate('uploader', 'name role'),
      Media.countDocuments(),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  })
);
router.delete(
  '/media/:id',
  asyncH(async (req, res) => {
    await Media.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  })
);

// ---- Reports (v1 Sales_inventory.php + Payment_statistics.php) ----
router.get(
  '/reports/sales-inventory',
  asyncH(async (req, res) => {
    const match = { status: { $nin: ['cancelled', 'refunded'] } };
    if (req.query.from || req.query.to) {
      match.createdAt = {};
      if (req.query.from) match.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) match.createdAt.$lte = new Date(new Date(req.query.to).getTime() + 86399999);
    }
    if (req.query.partner) match.partner = req.query.partner;
    const rows = await Order.aggregate([
      { $match: match },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          title: { $first: '$items.title' },
          unitsSold: { $sum: '$items.qty' },
          revenue: { $sum: '$items.lineTotal' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: 'products', localField: '_id', foreignField: '_id', as: 'product',
          pipeline: [{ $project: { stock: 1, lowStockAlert: 1, status: 1, partner: 1 } }],
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    ]);
    res.json({ rows });
  })
);

router.get(
  '/reports/payment-stats',
  asyncH(async (req, res) => {
    const match = {};
    if (req.query.from || req.query.to) {
      match.createdAt = {};
      if (req.query.from) match.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) match.createdAt.$lte = new Date(new Date(req.query.to).getTime() + 86399999);
    }
    const [byMethod, byStatus] = await Promise.all([
      Order.aggregate([
        { $match: { ...match, status: { $nin: ['cancelled', 'refunded'] } } },
        { $group: { _id: '$paymentMethod', orders: { $sum: 1 }, total: { $sum: '$grandTotal' } } },
        { $sort: { total: -1 } },
      ]),
      Order.aggregate([
        { $match: match },
        { $group: { _id: '$status', orders: { $sum: 1 }, total: { $sum: '$grandTotal' } } },
      ]),
    ]);
    res.json({ byMethod, byStatus });
  })
);

// ---- Bulk price update (v1 Bulk_actual_price.php) ----
router.post(
  '/products/bulk-price',
  asyncH(async (req, res) => {
    const { mode, value, partnerId, category } = req.body; // mode: 'percent' | 'flat'
    const delta = Number(value);
    if (!['percent', 'flat'].includes(mode) || !Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ message: 'mode (percent|flat) and a non-zero value are required' });
    }
    const q = {};
    if (partnerId) q.partner = partnerId;
    if (category) q.category = category;
    const update = mode === 'percent'
      ? [{ $set: { price: { $round: [{ $multiply: ['$price', 1 + delta / 100] }, 2] } } }]
      : { $inc: { price: delta } };
    const { modifiedCount } = await Product.updateMany(q, update);
    await audit(req, 'bulk_price', 'product', '', { mode, value: delta, partnerId, category, modifiedCount });
    res.json({ modifiedCount });
  })
);

// ---- System users (v1 System_users.php): manage the admin accounts ----
router.get(
  '/system-users',
  asyncH(async (req, res) => {
    const users = await User.find({ role: 'admin' }).sort('name');
    res.json({ users: users.map((u) => u.toSafe()) });
  })
);

router.post(
  '/system-users',
  asyncH(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'name, email and password are required' });
    if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already in use' });
    const user = await User.create({ name, email, password, role: 'admin' });
    await audit(req, 'create_admin', 'user', user._id);
    res.status(201).json({ user: user.toSafe() });
  })
);

router.put(
  '/system-users/:id',
  asyncH(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!user) return res.status(404).json({ message: 'Admin not found' });

    const { name, email, password, status } = req.body;
    if (email && email !== user.email) {
      if (await User.findOne({ email })) return res.status(400).json({ message: 'Email already in use' });
      user.email = email;
    }
    if (name) user.name = name;
    if (password) user.password = password; // re-hashed by the User pre-save hook
    if (status && ['active', 'suspended'].includes(status)) {
      // Don't let the last active admin lock everyone out of the console.
      if (status === 'suspended' && (await activeAdminCount()) <= 1) {
        return res.status(400).json({ message: 'Cannot suspend the last active admin' });
      }
      user.status = status;
    }
    await user.save();
    await audit(req, 'update_admin', 'user', user._id);
    res.json({ user: user.toSafe() });
  })
);

router.delete(
  '/system-users/:id',
  asyncH(async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    const user = await User.findOne({ _id: req.params.id, role: 'admin' });
    if (!user) return res.status(404).json({ message: 'Admin not found' });
    if ((await activeAdminCount()) <= 1) {
      return res.status(400).json({ message: 'Cannot delete the last active admin' });
    }
    await user.deleteOne();
    await audit(req, 'delete_admin', 'user', req.params.id);
    res.json({ message: 'Admin removed' });
  })
);

const activeAdminCount = () => User.countDocuments({ role: 'admin', status: 'active' });

// ---- Fund transfers (v1 Fund_transfer.php): manual wallet credit/debit ----
router.get(
  '/fund-transfers',
  asyncH(async (req, res) => {
    const items = await Transaction.find({ source: 'fund_transfer' })
      .sort('-createdAt').limit(100).populate('user', 'name email role');
    res.json({ items });
  })
);
router.post(
  '/fund-transfers',
  asyncH(async (req, res) => {
    const { userId, amount, note } = req.body;
    const value = Number(amount);
    if (!userId || !value) return res.status(400).json({ message: 'userId and a non-zero amount are required' });
    const target = await User.findById(userId).select('name role');
    if (!target) return res.status(404).json({ message: 'User not found' });
    const balance = await walletAdjust(userId, value, 'fund_transfer', {
      note: note || `Fund transfer by admin`,
    });
    await notify(userId, value > 0 ? 'Funds added to your wallet' : 'Funds deducted from your wallet',
      `₹${Math.abs(value)} ${value > 0 ? 'credited' : 'debited'}${note ? ` — ${note}` : ''}`);
    await audit(req, 'fund_transfer', 'user', userId, { amount: value, note });
    res.status(201).json({ balance });
  })
);

// ---- Rider COD cash collection (v1 get_rider_cash_collection) ----
router.post(
  '/riders/:id/collect-cash',
  asyncH(async (req, res) => {
    const rider = await User.findOne({ _id: req.params.id, role: 'rider' });
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    const held = rider.riderProfile?.codHeld || 0;
    const amount = req.body.amount != null ? Number(req.body.amount) : held;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Nothing to collect' });
    if (amount > held) return res.status(400).json({ message: `Rider only holds ₹${held} in COD cash` });
    rider.riderProfile.codHeld = Math.round((held - amount) * 100) / 100;
    await rider.save();
    await Transaction.create({
      user: rider._id, type: 'debit', amount, source: 'cod_collection',
      note: req.body.note || 'COD cash deposited to admin',
    });
    await notify(rider._id, 'Cash collection recorded', `₹${amount} COD cash marked as deposited.`);
    await audit(req, 'collect_cash', 'user', rider._id, { amount });
    res.json({ codHeld: rider.riderProfile.codHeld });
  })
);

// ---- Return requests (v1 Return_request.php) ----
router.get(
  '/returns',
  asyncH(async (req, res) => {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const items = await ReturnRequest.find(q).sort('-createdAt').limit(100)
      .populate('customer', 'name email')
      .populate('order', 'orderNumber grandTotal status paymentMethod');
    res.json({ items });
  })
);
router.put(
  '/returns/:id',
  asyncH(async (req, res) => {
    const { action, adminNote } = req.body; // action: 'approve' | 'reject'
    const request = await ReturnRequest.findById(req.params.id).populate('order');
    if (!request) return res.status(404).json({ message: 'Not found' });
    if (request.status !== 'pending') return res.status(400).json({ message: `Already ${request.status}` });
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'action must be approve or reject' });
    request.status = action === 'approve' ? 'approved' : 'rejected';
    request.adminNote = adminNote;
    request.processedBy = req.user._id;
    request.processedAt = new Date();
    if (action === 'approve') {
      const order = request.order;
      await refundOrder(order);
      // refundOrder only credits prepaid orders — on a COD return the customer
      // handed cash to the rider, so refund their wallet here.
      if (order.paymentMethod === 'cod') {
        await walletAdjust(order.customer, order.grandTotal, 'order_refund', {
          order: order._id,
          note: `Return refund for order ${order.orderNumber} (was COD)`,
        });
      }
      order.status = 'refunded';
      order.statusHistory.push({ status: 'refunded', by: req.user._id, at: new Date() });
      await order.save();
      await notify(request.customer, 'Return approved ✓',
        `Your return for order ${order.orderNumber} was approved — ₹${order.grandTotal} refunded to your wallet.`);
    } else {
      await notify(request.customer, 'Return request declined',
        `Your return request was declined${adminNote ? `: ${adminNote}` : '.'}`);
    }
    await request.save();
    await audit(req, `return_${action}`, 'return', request._id, { adminNote });
    res.json({ request });
  })
);

// ---- Withdrawals ----
router.get(
  '/withdrawals',
  asyncH(async (req, res) => {
    const q = {};
    if (req.query.status) q.status = req.query.status;
    const withdrawals = await WithdrawalRequest.find(q).sort('-createdAt').limit(100)
      .populate('user', 'name email role walletBalance');
    res.json({ withdrawals });
  })
);

// PUT /api/admin/withdrawals/:id { action: 'approve'|'reject', adminNote }
router.put(
  '/withdrawals/:id',
  asyncH(async (req, res) => {
    const wr = await WithdrawalRequest.findById(req.params.id).populate('user');
    if (!wr) return res.status(404).json({ message: 'Request not found' });
    if (wr.status !== 'pending') return res.status(400).json({ message: 'Already processed' });
    const { action, adminNote } = req.body;
    if (action === 'approve') {
      if (wr.user.walletBalance < wr.amount) {
        return res.status(400).json({ message: 'User balance is below requested amount' });
      }
      await walletAdjust(wr.user._id, -wr.amount, 'withdrawal', {
        note: `Withdrawal approved${adminNote ? ': ' + adminNote : ''}`,
      });
      wr.status = 'approved';
    } else if (action === 'reject') {
      wr.status = 'rejected';
    } else {
      return res.status(400).json({ message: 'action must be approve or reject' });
    }
    wr.adminNote = adminNote;
    wr.processedAt = new Date();
    wr.processedBy = req.user._id;
    await wr.save();
    await notify(wr.user._id, `Withdrawal ${wr.status}`, `Your withdrawal of ${wr.amount} was ${wr.status}.${adminNote ? ' ' + adminNote : ''}`, { type: 'wallet' });
    await audit(req, action + '_withdrawal', 'withdrawal', wr._id);
    res.json({ withdrawal: wr });
  })
);

// ---- Transactions ----
router.get(
  '/transactions',
  asyncH(async (req, res) => {
    const { page, limit, skip } = paginate(req, 30);
    const q = {};
    if (req.query.user) q.user = req.query.user;
    if (req.query.source) q.source = req.query.source;
    const [transactions, total] = await Promise.all([
      Transaction.find(q).sort('-createdAt').skip(skip).limit(limit).populate('user', 'name email role'),
      Transaction.countDocuments(q),
    ]);
    res.json({ transactions, total, page, pages: Math.ceil(total / limit) });
  })
);

// ---- Reviews moderation ----
router.get(
  '/reviews',
  asyncH(async (req, res) => {
    const reviews = await Review.find().sort('-createdAt').limit(100)
      .populate('user', 'name')
      .populate('product', 'title')
      .populate('partner', 'partnerProfile.storeName name');
    res.json({ reviews });
  })
);

router.put(
  '/reviews/:id',
  asyncH(async (req, res) => {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { hidden: !!req.body.hidden },
      { new: true }
    );
    res.json({ review });
  })
);

// ---- Settings ----
router.get('/settings', asyncH(async (req, res) => {
  const settings = await Setting.find();
  res.json({ settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
}));

router.put(
  '/settings',
  asyncH(async (req, res) => {
    for (const [key, value] of Object.entries(req.body)) {
      await Setting.findOneAndUpdate({ key }, { value }, { upsert: true });
    }
    await audit(req, 'update', 'settings', '', req.body);
    const settings = await Setting.find();
    res.json({ settings: Object.fromEntries(settings.map((s) => [s.key, s.value])) });
  })
);

// ---- Pages & FAQs ----
router.get('/pages', asyncH(async (req, res) => res.json({ pages: await Page.find() })));
router.put(
  '/pages/:slug',
  asyncH(async (req, res) => {
    const page = await Page.findOneAndUpdate(
      { slug: req.params.slug },
      { title: req.body.title, content: req.body.content, slug: req.params.slug },
      { upsert: true, new: true }
    );
    res.json({ page });
  })
);

router.get('/faqs', asyncH(async (req, res) => res.json({ faqs: await Faq.find().sort('sortOrder') })));
router.post('/faqs', asyncH(async (req, res) => res.status(201).json({ faq: await Faq.create(req.body) })));
router.put('/faqs/:id', asyncH(async (req, res) => res.json({ faq: await Faq.findByIdAndUpdate(req.params.id, req.body, { new: true }) })));
router.delete('/faqs/:id', asyncH(async (req, res) => { await Faq.findByIdAndDelete(req.params.id); res.json({ message: 'Deleted' }); }));

// ---- Database backup (v1 Database_bakup.php) ----
// v1 let the admin pick tables and download a SQL dump. Mongo equivalent:
// pick collections, download a gzipped JSON archive { collection: [docs] }.
// Streamed per-document so a large DB never sits in memory.
router.get('/backup/collections', asyncH(async (req, res) => {
  const db = mongoose.connection.db;
  const infos = await db.listCollections().toArray();
  const collections = await Promise.all(
    infos.map(async ({ name }) => ({ name, count: await db.collection(name).estimatedDocumentCount() }))
  );
  collections.sort((a, b) => a.name.localeCompare(b.name));
  res.json({ collections });
}));

router.get('/backup', asyncH(async (req, res) => {
  const db = mongoose.connection.db;
  const existing = (await db.listCollections().toArray()).map((c) => c.name);
  const requested = String(req.query.collections || '').split(',').map((s) => s.trim()).filter(Boolean);
  // Whitelist against real collection names — never interpolate client input.
  const names = requested.length ? existing.filter((n) => requested.includes(n)) : existing;
  if (!names.length) return res.status(400).json({ message: 'No matching collections' });

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Content-Disposition', `attachment; filename="cravecart-backup_${stamp}.json.gz"`);
  const gzip = zlib.createGzip();
  gzip.pipe(res);
  const write = (chunk) => new Promise((ok) => (gzip.write(chunk) ? ok() : gzip.once('drain', ok)));

  await write('{\n');
  for (let i = 0; i < names.length; i++) {
    await write(`${JSON.stringify(names[i])}: [`);
    let first = true;
    for await (const doc of db.collection(names[i]).find()) {
      await write((first ? '' : ',') + '\n' + JSON.stringify(doc));
      first = false;
    }
    await write('\n]' + (i < names.length - 1 ? ',' : '') + '\n');
  }
  await write('}\n');
  gzip.end();
  await audit(req, 'backup', 'database', '', { collections: names });
}));

// ---- Client API keys (v1 Client_api_keys.php) ----
router.get('/api-keys', asyncH(async (req, res) => {
  res.json({ keys: await ApiKey.find().sort('-createdAt') });
}));

router.post('/api-keys', asyncH(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ message: 'name is required' });
  // 40-char hex secret, same shape as v1's random_string('sha1', 40)
  const key = await ApiKey.create({ name, secret: crypto.randomBytes(20).toString('hex') });
  await audit(req, 'create', 'api_key', key._id, { name });
  res.status(201).json({ key });
}));

router.put('/api-keys/:id', asyncH(async (req, res) => {
  const key = await ApiKey.findById(req.params.id);
  if (!key) return res.status(404).json({ message: 'API key not found' });
  // v1 behavior: name/status editable, the secret never changes
  if (req.body.name !== undefined) key.name = String(req.body.name).trim();
  if (req.body.active !== undefined) key.active = !!req.body.active;
  await key.save();
  await audit(req, 'update', 'api_key', key._id, { name: key.name, active: key.active });
  res.json({ key });
}));

router.delete('/api-keys/:id', asyncH(async (req, res) => {
  const key = await ApiKey.findByIdAndDelete(req.params.id);
  if (!key) return res.status(404).json({ message: 'API key not found' });
  await audit(req, 'delete', 'api_key', req.params.id);
  res.json({ message: 'Deleted' });
}));

// v1 parity: the console showed a ready-made JWT signed with the key's secret
// (30-minute expiry) that external clients can copy to test their integration.
router.get('/api-keys/:id/token', asyncH(async (req, res) => {
  const key = await ApiKey.findById(req.params.id);
  if (!key) return res.status(404).json({ message: 'API key not found' });
  if (!key.active) return res.status(400).json({ message: 'Key is disabled' });
  const token = jwt.sign({ iss: 'cravecart' }, key.secret, { expiresIn: '30m' });
  res.json({ token, expiresIn: 1800 });
}));

// ---- Audit log ----
router.get('/audit', asyncH(async (req, res) => {
  res.json({ logs: await AuditLog.find().sort('-createdAt').limit(100).populate('actor', 'name email') });
}));

// ---- Broadcast notification ----
router.post(
  '/broadcast',
  asyncH(async (req, res) => {
    const { title, body, role } = req.body;
    if (!title) return res.status(400).json({ message: 'title required' });
    const q = { status: 'active' };
    if (role && role !== 'all') q.role = role;
    const users = await User.find(q).select('_id');
    await Promise.all(users.map((u) => notify(u._id, title, body, { type: 'broadcast' })));
    await audit(req, 'broadcast', 'notification', '', { title, role });
    res.json({ message: `Sent to ${users.length} user(s)` });
  })
);

export default router;
