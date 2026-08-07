import { Router } from 'express';
import { Cart } from '../models/Order.js';
import { Product } from '../models/Catalog.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import { asyncH } from '../middleware/error.js';

const router = Router();

/**
 * Resolve a cart into priced line items grouped by partner.
 * Returns { groups: [{ partner, items, itemsTotal, taxTotal, deliveryCharge }], invalid: [] }
 */
export async function priceCart(cart) {
  const groups = new Map();
  const invalid = [];
  for (const item of cart.items) {
    const product = await Product.findById(item.product).populate('tax', 'percentage active');
    if (!product || product.status !== 'active') {
      invalid.push({ item, reason: 'Product unavailable' });
      continue;
    }
    // Live tax entity wins over the product's own taxPercent; inclusive-priced
    // products carry their tax inside the price, so nothing is added on top.
    const taxPercent = product.tax?.active ? product.tax.percentage : product.taxPercent;
    const effectiveTaxPercent = product.isPriceInclusiveTax ? 0 : taxPercent;
    let unitPrice = product.salePrice ?? product.price;
    let variantName = null;
    // stock that actually governs this line — variant stock when a variant is chosen
    let availableStock = product.stock;
    if (item.variantId) {
      const v = product.variants.id(item.variantId);
      if (!v) {
        invalid.push({ item, reason: 'Variant unavailable' });
        continue;
      }
      unitPrice = v.price;
      variantName = v.name;
      availableStock = v.stock;
    }
    const addons = [];
    for (const aid of item.addonIds || []) {
      const a = product.addons.id(aid);
      if (a) {
        addons.push({ name: a.name, price: a.price });
        unitPrice += a.price;
      }
    }
    const lineTotal = Math.round(unitPrice * item.qty * 100) / 100;
    const pid = String(product.partner);
    if (!groups.has(pid)) groups.set(pid, { partnerId: pid, items: [], itemsTotal: 0, taxTotal: 0 });
    const g = groups.get(pid);
    g.items.push({
      cartItemId: item._id,
      product: product._id,
      title: product.title,
      image: product.images[0] || null,
      variantId: item.variantId || null,
      variantName,
      addons,
      unitPrice,
      taxPercent: effectiveTaxPercent,
      qty: item.qty,
      lineTotal,
      note: item.note,
      stock: availableStock,
    });
    g.itemsTotal = Math.round((g.itemsTotal + lineTotal) * 100) / 100;
    g.taxTotal = Math.round((g.taxTotal + (lineTotal * effectiveTaxPercent) / 100) * 100) / 100;
  }

  const result = [];
  for (const g of groups.values()) {
    const partner = await User.findById(g.partnerId).select('name partnerProfile');
    const p = partner?.partnerProfile || {};
    const deliveryCharge =
      g.itemsTotal >= (p.freeDeliveryAbove ?? Infinity) ? 0 : p.deliveryCharge ?? 30;
    result.push({
      partner: {
        _id: g.partnerId,
        storeName: p.storeName || partner?.name,
        isOpen: p.isOpen,
        minOrder: p.minOrder || 0,
      },
      items: g.items,
      itemsTotal: g.itemsTotal,
      taxTotal: g.taxTotal,
      deliveryCharge,
    });
  }
  return { groups: result, invalid };
}

async function getCart(userId) {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
}

// GET /api/cart
router.get(
  '/',
  protect,
  asyncH(async (req, res) => {
    const cart = await getCart(req.user._id);
    const priced = await priceCart(cart);
    res.json({ cart, ...priced });
  })
);

// POST /api/cart  { productId, variantId?, addonIds?, qty, note? }
router.post(
  '/',
  protect,
  asyncH(async (req, res) => {
    const { productId, variantId, addonIds = [], qty = 1, note } = req.body;
    const product = await Product.findById(productId);
    if (!product || product.status !== 'active') {
      return res.status(400).json({ message: 'Product unavailable' });
    }
    const cart = await getCart(req.user._id);
    const same = cart.items.find(
      (i) =>
        String(i.product) === String(productId) &&
        String(i.variantId || '') === String(variantId || '') &&
        JSON.stringify([...(i.addonIds || [])].sort()) === JSON.stringify([...addonIds].sort())
    );
    if (same) same.qty = Math.min(product.maxQty, same.qty + qty);
    else cart.items.push({ product: productId, variantId, addonIds, qty, note });
    await cart.save();
    const priced = await priceCart(cart);
    res.status(201).json({ cart, ...priced });
  })
);

// PUT /api/cart/:itemId  { qty }
router.put(
  '/:itemId',
  protect,
  asyncH(async (req, res) => {
    const cart = await getCart(req.user._id);
    const item = cart.items.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Cart item not found' });
    let qty = Number(req.body.qty);
    if (!Number.isFinite(qty) || qty <= 0) {
      item.deleteOne();
    } else {
      // cap at the product's maxQty so the qty can't be set arbitrarily high
      const product = await Product.findById(item.product).select('maxQty');
      if (product?.maxQty) qty = Math.min(qty, product.maxQty);
      item.qty = Math.floor(qty);
    }
    await cart.save();
    const priced = await priceCart(cart);
    res.json({ cart, ...priced });
  })
);

// DELETE /api/cart/:itemId
router.delete(
  '/:itemId',
  protect,
  asyncH(async (req, res) => {
    const cart = await getCart(req.user._id);
    const item = cart.items.id(req.params.itemId);
    if (item) item.deleteOne();
    await cart.save();
    const priced = await priceCart(cart);
    res.json({ cart, ...priced });
  })
);

// DELETE /api/cart — clear
router.delete(
  '/',
  protect,
  asyncH(async (req, res) => {
    const cart = await getCart(req.user._id);
    cart.items = [];
    await cart.save();
    res.json({ cart, groups: [], invalid: [] });
  })
);

export default router;
