import { Router } from 'express';
import { Category, Product, Tag } from '../models/Catalog.js';
import { Slider, Offer, Setting, Review, City, FeaturedSection, Language } from '../models/Misc.js';
import { PromoCode } from '../models/Order.js';
import User from '../models/User.js';
import { asyncH } from '../middleware/error.js';
import { paginate, notify } from '../utils/helpers.js';
import { TableBooking } from '../models/DineIn.js';

const router = Router();

const PARTNER_PUBLIC_FIELDS =
  'name partnerProfile.storeName partnerProfile.slug partnerProfile.logo partnerProfile.banner partnerProfile.description partnerProfile.city partnerProfile.address partnerProfile.cuisineTags partnerProfile.openTime partnerProfile.closeTime partnerProfile.isOpen partnerProfile.deliveryCharge partnerProfile.freeDeliveryAbove partnerProfile.minOrder partnerProfile.ratingAvg partnerProfile.ratingCount';

// GET /api/catalog/home — everything the storefront home needs
router.get(
  '/home',
  asyncH(async (req, res) => {
    const [sliders, offers, categories, featured, popular, partners, sections, settings] = await Promise.all([
      Slider.find({ active: true }).sort('sortOrder'),
      Offer.find({ active: true }).sort('-createdAt').limit(6),
      Category.find({ active: true, parent: null }).sort('sortOrder'),
      Product.find({ status: 'active', featured: true }).limit(12).populate('category', 'name slug'),
      Product.find({ status: 'active' }).sort('-soldCount').limit(12).populate('category', 'name slug'),
      User.find({ role: 'partner', status: 'active', 'partnerProfile.kycStatus': 'approved' })
        .select(PARTNER_PUBLIC_FIELDS)
        .limit(12),
      FeaturedSection.find({ active: true }).sort('sortOrder').populate({
        path: 'products',
        match: { status: 'active' },
        populate: { path: 'category', select: 'name slug' },
      }),
      Setting.find({ key: { $in: [
        'currency', 'appName', 'supportEmail', 'supportPhone',
        // v1 Web_setting.php parity — public branding + client hints
        'webLogo', 'webFavicon', 'metaDescription', 'heroImage',
        'maxCartItems', 'minCartAmount', 'minAppVersion',
        // signup clients need to know whether to run the phone-OTP step
        'authenticationMethod',
      ] } }),
    ]);
    res.json({
      sliders,
      offers,
      categories,
      featured,
      popular,
      partners,
      sections,
      settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    });
  })
);

// GET /api/catalog/categories
router.get(
  '/categories',
  asyncH(async (req, res) => {
    const categories = await Category.find({ active: true }).sort('sortOrder');
    res.json({ categories });
  })
);

// ---- Languages (v1: Language.php packs) ----
// GET /api/catalog/languages — active languages for the picker
router.get(
  '/languages',
  asyncH(async (req, res) => {
    const languages = await Language.find({ active: true })
      .sort('sortOrder').select('code name nativeName rtl');
    res.json({ languages });
  })
);

// GET /api/catalog/languages/:code — full string pack for one language
router.get(
  '/languages/:code',
  asyncH(async (req, res) => {
    const language = await Language.findOne({ code: req.params.code.toLowerCase(), active: true });
    if (!language) return res.status(404).json({ message: 'Language not found' });
    res.json({ language });
  })
);

// GET /api/catalog/tags — managed tag vocabulary (for filter chips / suggestions)
router.get(
  '/tags',
  asyncH(async (req, res) => {
    const tags = await Tag.find().sort('name').select('name slug');
    res.json({ tags });
  })
);

// GET /api/catalog/products — filters: search, category, partner, minPrice, maxPrice, minRating, tag, attr, veg, sort
router.get(
  '/products',
  asyncH(async (req, res) => {
    const { search, category, partner, minPrice, maxPrice, minRating, tag, veg, sort } = req.query;
    const { page, limit, skip } = paginate(req);
    const q = { status: 'active' };
    if (search) q.$text = { $search: search };
    if (category) q.category = category;
    if (partner) q.partner = partner;
    if (tag) q.tags = tag;
    // structured attribute filter: ?attr=Size:Large (repeatable)
    const attrs = [].concat(req.query.attr || []);
    if (attrs.length) {
      q.$and = attrs
        .map((a) => String(a).split(':'))
        .filter(([k, v]) => k && v)
        .map(([k, v]) => ({ attributes: { $elemMatch: { key: k, value: v } } }));
      if (!q.$and.length) delete q.$and;
    }
    if (veg === 'true') q.isVeg = true;
    if (minRating) q.ratingAvg = { $gte: Number(minRating) };
    if (minPrice || maxPrice) {
      q.price = {};
      if (minPrice) q.price.$gte = Number(minPrice);
      if (maxPrice) q.price.$lte = Number(maxPrice);
    }
    const sortMap = {
      price_asc: { price: 1 },
      price_desc: { price: -1 },
      popular: { soldCount: -1 },
      rating: { ratingAvg: -1 },
      newest: { createdAt: -1 },
    };
    const [products, total] = await Promise.all([
      Product.find(q)
        .sort(sortMap[sort] || { sortOrder: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('category', 'name slug')
        .populate('partner', 'name partnerProfile.storeName partnerProfile.isOpen'),
      Product.countDocuments(q),
    ]);
    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  })
);

// GET /api/catalog/products/:id
router.get(
  '/products/:id',
  asyncH(async (req, res) => {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('partner', PARTNER_PUBLIC_FIELDS);
    if (!product || product.status === 'draft') {
      return res.status(404).json({ message: 'Product not found' });
    }
    const [reviews, related] = await Promise.all([
      Review.find({ product: product._id, target: 'product', hidden: false })
        .sort('-createdAt')
        .limit(10)
        .populate('user', 'name avatar'),
      Product.find({
        category: product.category._id,
        _id: { $ne: product._id },
        status: 'active',
      }).limit(8),
    ]);
    res.json({ product, reviews, related });
  })
);

// GET /api/catalog/partners — list stores
router.get(
  '/partners',
  asyncH(async (req, res) => {
    const { search, city } = req.query;
    const q = { role: 'partner', status: 'active', 'partnerProfile.kycStatus': 'approved' };
    if (city) q['partnerProfile.city'] = new RegExp(city, 'i');
    if (search) q['partnerProfile.storeName'] = new RegExp(search, 'i');
    const partners = await User.find(q).select(PARTNER_PUBLIC_FIELDS).limit(50);
    res.json({ partners });
  })
);

// GET /api/catalog/partners/:id — storefront
router.get(
  '/partners/:id',
  asyncH(async (req, res) => {
    const partner = await User.findOne({
      _id: req.params.id,
      role: 'partner',
      status: 'active',
    }).select(PARTNER_PUBLIC_FIELDS);
    if (!partner) return res.status(404).json({ message: 'Store not found' });
    const [products, reviews] = await Promise.all([
      Product.find({ partner: partner._id, status: 'active' }).populate('category', 'name'),
      Review.find({ partner: partner._id, target: 'partner', hidden: false })
        .sort('-createdAt')
        .limit(10)
        .populate('user', 'name avatar'),
    ]);
    res.json({ partner, products, reviews });
  })
);

// GET /api/catalog/cities — serviceable cities (v1: get_cities)
router.get(
  '/cities',
  asyncH(async (req, res) => {
    const q = { active: true };
    if (req.query.search) q.name = new RegExp(req.query.search, 'i');
    // v1 get_cities($city_id): the cities that will also serve this one.
    if (req.query.borders) q.borderingCities = req.query.borders;
    const cities = await City.find(q).sort('sortOrder name');
    res.json({ cities });
  })
);

// GET /api/catalog/is-deliverable?city=Name&area=Name (v1: is_city_deliverable + Area.php)
router.get(
  '/is-deliverable',
  asyncH(async (req, res) => {
    const name = (req.query.city || '').trim();
    const area = (req.query.area || '').trim();
    if (!name) return res.status(400).json({ message: 'city is required' });
    const total = await City.countDocuments({ active: true });
    // if no cities are configured, everywhere is deliverable
    if (total === 0) return res.json({ deliverable: true });
    const city = await City.findOne({ name: new RegExp(`^${name}$`, 'i'), active: true });
    if (!city) return res.json({ deliverable: false, city: null, areas: [] });
    // area-level check only applies when the city has areas configured AND one was asked about
    const deliverable = !area || !city.areas?.length
      ? true
      : city.areas.some((a) => a.toLowerCase() === area.toLowerCase());
    res.json({ deliverable, city: city.name, areas: city.areas || [] });
  })
);

// POST /api/catalog/partners/:id/book-table — customer/guest table booking
// (v1 table booking; partner manages it in the dine-in module)
router.post(
  '/partners/:id/book-table',
  asyncH(async (req, res) => {
    const partner = await User.findOne({ _id: req.params.id, role: 'partner' });
    if (!partner) return res.status(404).json({ message: 'Store not found' });
    const { name, phone, partySize = 2, bookedFor, note } = req.body;
    if (!name?.trim() || !phone?.trim()) return res.status(400).json({ message: 'name and phone are required' });
    if (!bookedFor || new Date(bookedFor) < new Date()) {
      return res.status(400).json({ message: 'Pick a future date & time' });
    }
    // link to the logged-in customer when a valid token is sent (optional)
    let customer = null;
    try {
      const header = req.headers.authorization || '';
      if (header.startsWith('Bearer ')) {
        const jwt = (await import('jsonwebtoken')).default;
        const decoded = jwt.verify(header.slice(7), process.env.JWT_SECRET);
        customer = decoded.id;
      }
    } catch { /* guest booking */ }
    const booking = await TableBooking.create({
      partner: partner._id, customer, name: name.trim(), phone: phone.trim(),
      partySize: Math.max(1, Number(partySize) || 2), bookedFor, note,
    });
    await notify(partner._id, 'New table booking 🍽️',
      `${booking.name} (${booking.partySize} guests) — ${new Date(booking.bookedFor).toLocaleString('en-IN')}`);
    res.status(201).json({ booking });
  })
);

// GET /api/catalog/promos — active public promo codes (v1: get_promo_codes)
router.get(
  '/promos',
  asyncH(async (req, res) => {
    const now = new Date();
    const promos = await PromoCode.find({
      active: true,
      $and: [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ],
    })
      .sort('-createdAt')
      .populate('partner', 'partnerProfile.storeName');
    const usable = promos.filter((p) => !p.usageLimit || p.usedCount < p.usageLimit);
    res.json({
      promos: usable.map((p) => ({
        _id: p._id,
        code: p.code,
        description: p.description,
        type: p.type,
        value: p.value,
        minOrder: p.minOrder,
        maxDiscount: p.maxDiscount,
        endsAt: p.endsAt,
        store: p.partner?.partnerProfile?.storeName || null,
      })),
    });
  })
);

// GET /api/catalog/pages/:slug + faqs
router.get(
  '/faqs',
  asyncH(async (req, res) => {
    const { Faq } = await import('../models/Misc.js');
    const faqs = await Faq.find().sort('sortOrder');
    res.json({ faqs });
  })
);

router.get(
  '/pages/:slug',
  asyncH(async (req, res) => {
    const { Page } = await import('../models/Misc.js');
    const page = await Page.findOne({ slug: req.params.slug });
    if (!page) return res.status(404).json({ message: 'Page not found' });
    res.json({ page });
  })
);

// GET /api/catalog/delivery-charges?partner=<id>&subtotal=<n> — v1 get_delivery_charges.
// The cart already returns the charge it will actually bill, and that stays the source of
// truth; this exists so a store page can quote "free delivery over ₹500" before anything
// is in the cart. Same rule as priceCart() — keep them in step.
router.get(
  '/delivery-charges',
  asyncH(async (req, res) => {
    const q = { role: 'partner', status: 'active' };
    if (req.query.partner) q._id = req.query.partner;

    const partners = await User.find(q).select('name partnerProfile.storeName partnerProfile.deliveryCharge partnerProfile.freeDeliveryAbove');
    if (req.query.partner && !partners.length) {
      return res.status(404).json({ message: 'Partner not found' });
    }

    const subtotal = Number(req.query.subtotal);
    const charges = partners.map((p) => {
      const pp = p.partnerProfile || {};
      const charge = pp.deliveryCharge ?? 30;
      const freeAbove = pp.freeDeliveryAbove ?? null;
      return {
        partner: p._id,
        storeName: pp.storeName || p.name,
        deliveryCharge: charge,
        freeDeliveryAbove: freeAbove,
        // Only answerable once we know the basket value.
        payable: Number.isFinite(subtotal)
          ? (freeAbove != null && subtotal >= freeAbove ? 0 : charge)
          : null,
      };
    });

    res.json(req.query.partner ? { charge: charges[0] } : { charges });
  })
);

// GET /api/catalog/exchange-rates — v1 exchange_rate.
//
// v1 proxied exchangeratesapi.io with the access key hardcoded in Api.php. The key is
// read from Settings here instead (`exchangeRatesApiKey`) — a committed third-party
// credential is a liability, and it was someone else's account. Cached for an hour;
// the free tier is metered and rates only move daily.
let ratesCache = null;
router.get(
  '/exchange-rates',
  asyncH(async (req, res) => {
    if (ratesCache && Date.now() - ratesCache.at < 60 * 60 * 1000) {
      return res.json({ ...ratesCache.data, cached: true });
    }
    const s = await Setting.findOne({ key: 'exchangeRatesApiKey' }).lean();
    const key = s?.value || process.env.EXCHANGE_RATES_API_KEY || '';
    if (!key) {
      return res.status(503).json({ message: 'Exchange rates are not configured. Admin: Settings → General.' });
    }
    const r = await fetch(`https://api.exchangeratesapi.io/v1/latest?access_key=${key}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.success === false) {
      return res.status(502).json({ message: data?.error?.info || 'Exchange rate provider failed' });
    }
    ratesCache = { at: Date.now(), data };
    res.json(data);
  })
);

export default router;
