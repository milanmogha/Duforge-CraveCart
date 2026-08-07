import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    image: String,
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  sku: String,
  stock: { type: Number, default: 100 },
});

const addonSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
});

// v1 parity: named taxes (admin-global or partner-owned), structured attributes
// with value lists, and a managed tag vocabulary. Products keep taxPercent as a
// fallback for custom rates; when `tax` is set the live Tax percentage wins.
const taxSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    percentage: { type: Number, required: true, min: 0 },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = global
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const attributeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    values: [String],
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const tagSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);
tagSchema.pre('validate', function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }
  next();
});

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true },
    description: String,
    images: [String],
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    price: { type: Number, required: true },
    salePrice: Number,
    taxPercent: { type: Number, default: 0 },
    tax: { type: mongoose.Schema.Types.ObjectId, ref: 'Tax', default: null },
    isPriceInclusiveTax: { type: Boolean, default: false },
    variants: [variantSchema],
    addons: [addonSchema],
    tags: [String],
    attributes: [{ key: String, value: String }],
    stock: { type: Number, default: 100 },
    lowStockAlert: { type: Number, default: 5 },
    minQty: { type: Number, default: 1 },
    maxQty: { type: Number, default: 20 },
    isVeg: { type: Boolean, default: false },
    availableFrom: String,
    availableTo: String,
    status: { type: String, enum: ['active', 'draft', 'out_of_stock'], default: 'active' },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const Category = mongoose.model('Category', categorySchema);
export const Product = mongoose.model('Product', productSchema);
export const Tax = mongoose.model('Tax', taxSchema);
export const Attribute = mongoose.model('Attribute', attributeSchema);
export const Tag = mongoose.model('Tag', tagSchema);
