import { Router } from 'express';
import { Product, Category, Tax, Attribute, Tag } from '../models/Catalog.js';
import { Order, PromoCode } from '../models/Order.js';
import { Media } from '../models/Misc.js';
import { protect, authorize } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';
import { slugify, paginate } from '../utils/helpers.js';

const router = Router();
router.use(protect, authorize('partner'));

// GET /api/partner/dashboard
router.get(
  '/dashboard',
  asyncH(async (req, res) => {
    const pid = req.user._id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [totalOrders, activeOrders, todayOrders, productCount, revenueAgg, recentOrders] =
      await Promise.all([
        Order.countDocuments({ partner: pid }),
        Order.countDocuments({
          partner: pid,
          status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'assigned', 'picked_up', 'out_for_delivery'] },
        }),
        Order.countDocuments({ partner: pid, createdAt: { $gte: todayStart } }),
        Product.countDocuments({ partner: pid }),
        Order.aggregate([
          { $match: { partner: pid, settled: true } },
          { $group: { _id: null, earning: { $sum: '$partnerEarning' }, sales: { $sum: '$itemsTotal' } } },
        ]),
        Order.find({ partner: pid }).sort('-createdAt').limit(8).populate('customer', 'name'),
      ]);
    // last 7 days sales
    const since = new Date(Date.now() - 6 * 86400000);
    since.setHours(0, 0, 0, 0);
    const daily = await Order.aggregate([
      { $match: { partner: pid, createdAt: { $gte: since }, status: { $nin: ['cancelled', 'refunded'] } } },
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
      totalOrders,
      activeOrders,
      todayOrders,
      productCount,
      totalEarning: revenueAgg[0]?.earning || 0,
      totalSales: revenueAgg[0]?.sales || 0,
      walletBalance: req.user.walletBalance,
      kycStatus: req.user.partnerProfile?.kycStatus,
      rating: {
        avg: req.user.partnerProfile?.ratingAvg || 0,
        count: req.user.partnerProfile?.ratingCount || 0,
      },
      recentOrders,
      daily,
    });
  })
);

// ---- Store profile ----
router.put(
  '/store',
  asyncH(async (req, res) => {
    const allowed = [
      'storeName', 'description', 'logo', 'banner', 'address', 'city', 'lat', 'lng',
      'cuisineTags', 'openTime', 'closeTime', 'isOpen', 'deliveryCharge',
      'freeDeliveryAbove', 'minOrder', 'bankName', 'bankAccount', 'bankIfsc',
    ];
    if (!req.user.partnerProfile) req.user.partnerProfile = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) req.user.partnerProfile[k] = req.body[k];
    }
    await req.user.save();
    res.json({ user: req.user.toSafe() });
  })
);

// ---- Products CRUD ----
router.get(
  '/products',
  asyncH(async (req, res) => {
    const { page, limit, skip } = paginate(req, 50);
    const q = { partner: req.user._id };
    if (req.query.search) q.title = new RegExp(req.query.search, 'i');
    if (req.query.status) q.status = req.query.status;
    const [products, total] = await Promise.all([
      Product.find(q).sort('-createdAt').skip(skip).limit(limit).populate('category', 'name'),
      Product.countDocuments(q),
    ]);
    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  })
);

const PRODUCT_FIELDS = [
  'title', 'description', 'images', 'category', 'price', 'salePrice', 'taxPercent',
  'tax', 'isPriceInclusiveTax',
  'variants', 'addons', 'tags', 'attributes', 'stock', 'lowStockAlert', 'minQty',
  'maxQty', 'isVeg', 'availableFrom', 'availableTo', 'status', 'featured',
];

router.post(
  '/products',
  asyncH(async (req, res) => {
    if (req.user.partnerProfile?.kycStatus !== 'approved') {
      return res.status(403).json({ message: 'Your store must be approved before adding products' });
    }
    const data = { partner: req.user._id };
    for (const k of PRODUCT_FIELDS) if (req.body[k] !== undefined) data[k] = req.body[k];
    if (!data.title || !data.category || data.price == null) {
      return res.status(400).json({ message: 'title, category and price are required' });
    }
    data.slug = slugify(data.title) + '-' + Date.now().toString(36);
    const product = await Product.create(data);
    res.status(201).json({ product });
  })
);

router.put(
  '/products/:id',
  asyncH(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, partner: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    for (const k of PRODUCT_FIELDS) if (req.body[k] !== undefined) product[k] = req.body[k];
    await product.save();
    res.json({ product });
  })
);

router.delete(
  '/products/:id',
  asyncH(async (req, res) => {
    const product = await Product.findOneAndDelete({ _id: req.params.id, partner: req.user._id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  })
);

// POST /api/partner/products/bulk-price (v1 Bulk_actual_price.php, own products)
router.post(
  '/products/bulk-price',
  asyncH(async (req, res) => {
    const { mode, value, category } = req.body; // mode: 'percent' | 'flat'
    const delta = Number(value);
    if (!['percent', 'flat'].includes(mode) || !Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ message: 'mode (percent|flat) and a non-zero value are required' });
    }
    const q = { partner: req.user._id };
    if (category) q.category = category;
    const update = mode === 'percent'
      ? [{ $set: { price: { $round: [{ $multiply: ['$price', 1 + delta / 100] }, 2] } } }]
      : { $inc: { price: delta } };
    const { modifiedCount } = await Product.updateMany(q, update);
    res.json({ modifiedCount });
  })
);

// ---- Promo codes (partner-scoped) ----
router.get(
  '/promos',
  asyncH(async (req, res) => {
    const promos = await PromoCode.find({ partner: req.user._id }).sort('-createdAt');
    res.json({ promos });
  })
);

router.post(
  '/promos',
  asyncH(async (req, res) => {
    const { code, description, type, value, minOrder, maxDiscount, usageLimit, perUserLimit, startsAt, endsAt } = req.body;
    if (!code || !value) return res.status(400).json({ message: 'code and value are required' });
    const promo = await PromoCode.create({
      code, description, type, value, minOrder, maxDiscount, usageLimit,
      perUserLimit, startsAt, endsAt, partner: req.user._id,
    });
    res.status(201).json({ promo });
  })
);

router.put(
  '/promos/:id',
  asyncH(async (req, res) => {
    const promo = await PromoCode.findOne({ _id: req.params.id, partner: req.user._id });
    if (!promo) return res.status(404).json({ message: 'Promo not found' });
    const allowed = ['description', 'type', 'value', 'minOrder', 'maxDiscount', 'usageLimit', 'perUserLimit', 'startsAt', 'endsAt', 'active'];
    for (const k of allowed) if (req.body[k] !== undefined) promo[k] = req.body[k];
    await promo.save();
    res.json({ promo });
  })
);

router.delete(
  '/promos/:id',
  asyncH(async (req, res) => {
    await PromoCode.findOneAndDelete({ _id: req.params.id, partner: req.user._id });
    res.json({ message: 'Promo deleted' });
  })
);

// categories helper for product form
router.get(
  '/categories',
  asyncH(async (req, res) => {
    const categories = await Category.find({ active: true }).sort('sortOrder');
    res.json({ categories });
  })
);

// ---- Taxes / Attributes (v1 parity: partner-owned rows + read-only globals) ----
// Partners see their own entries plus admin globals (partner: null); they can
// only mutate their own.
for (const [path, Model, fields] of [
  ['taxes', Tax, ['title', 'percentage', 'active']],
  ['attributes', Attribute, ['name', 'values', 'active']],
]) {
  router.get(`/${path}`, asyncH(async (req, res) => {
    const items = await Model.find({ $or: [{ partner: req.user._id }, { partner: null }] }).sort('-createdAt');
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

// ---- Tags (managed vocabulary; product.tags stays a string list) ----
router.get(
  '/tags',
  asyncH(async (req, res) => {
    const items = await Tag.find({ $or: [{ partner: req.user._id }, { partner: null }] }).sort('name');
    res.json({ items });
  })
);
router.post(
  '/tags',
  asyncH(async (req, res) => {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'name is required' });
    const slug = slugify(name);
    const existing = await Tag.findOne({ slug });
    if (existing) return res.json({ item: existing });
    const item = await Tag.create({ name, slug, partner: req.user._id });
    res.status(201).json({ item });
  })
);
router.delete(
  '/tags/:id',
  asyncH(async (req, res) => {
    const item = await Tag.findOneAndDelete({ _id: req.params.id, partner: req.user._id });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  })
);

// ---- Media library (own uploads) ----
router.get(
  '/media',
  asyncH(async (req, res) => {
    const { page, limit, skip } = paginate(req, 60);
    const q = { uploader: req.user._id };
    const [items, total] = await Promise.all([
      Media.find(q).sort('-createdAt').skip(skip).limit(limit),
      Media.countDocuments(q),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  })
);
router.delete(
  '/media/:id',
  asyncH(async (req, res) => {
    const item = await Media.findOneAndDelete({ _id: req.params.id, uploader: req.user._id });
    if (!item) return res.status(404).json({ message: 'Not found' });
    res.json({ message: 'Deleted' });
  })
);

export default router;
