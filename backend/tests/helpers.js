import request from 'supertest';
import { createApp } from '../src/app.js';
import User from '../src/models/User.js';
import { Category, Product } from '../src/models/Catalog.js';
import { Setting } from '../src/models/Misc.js';

export const app = createApp();
export const api = () => request(app);

/** Log in and return the bearer token, failing loudly if the login didn't work. */
export async function login(email, password, panel) {
  const res = await request(app).post('/api/auth/login').send({ email, password, panel });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${res.text}`);
  return res.body.token;
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

/**
 * Users are created through the model (not the register endpoint) so tests can mint a
 * partner/rider/admin directly and skip the KYC + OTP paths unless that's what's under test.
 */
export async function makeUser(overrides = {}) {
  const role = overrides.role || 'customer';
  const rand = Math.random().toString(36).slice(2, 8);
  const doc = {
    name: overrides.name || `${role}-${rand}`,
    email: overrides.email || `${role}-${rand}@test.dapigo`,
    password: overrides.password || 'pass1234',
    phone: overrides.phone || `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    role,
    ...overrides,
  };
  if (role === 'partner') {
    doc.partnerProfile = {
      storeName: `Store ${rand}`,
      slug: `store-${rand}`,
      kycStatus: 'approved',
      isOpen: true,
      ...(overrides.partnerProfile || {}),
    };
  }
  if (role === 'rider') {
    doc.riderProfile = {
      vehicleType: 'bike',
      kycStatus: 'approved',
      isOnline: true,
      ...(overrides.riderProfile || {}),
    };
  }
  const user = await User.create(doc);
  user._plainPassword = doc.password;
  return user;
}

export async function makeProduct(partner, overrides = {}) {
  const category =
    overrides.category ||
    (await Category.findOne({ name: 'Test Category' })) ||
    (await Category.create({ name: 'Test Category', slug: 'test-category', active: true }));
  return Product.create({
    title: overrides.title || 'Test Product',
    slug: overrides.slug || `test-product-${Math.random().toString(36).slice(2, 8)}`,
    category: category._id || category,
    partner: partner._id,
    price: overrides.price ?? 100,
    stock: overrides.stock ?? 50,
    status: 'active',
    ...overrides,
  });
}

export const setSetting = (key, value) =>
  Setting.findOneAndUpdate({ key }, { key, value }, { upsert: true, new: true });

/** Register a customer through the real endpoint, then log in — used by auth tests. */
export async function registerCustomer(body) {
  const res = await request(app).post('/api/auth/register').send(body);
  return res;
}

/** Put one product in a customer's cart and return the cart response. */
export async function addToCart(token, productId, qty = 1) {
  return request(app).post('/api/cart').set(auth(token)).send({ productId, qty });
}
