import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: String,
  addonIds: [String],
  qty: { type: Number, default: 1, min: 1 },
  note: String,
});

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  title: String,
  image: String,
  variantId: String,
  variantName: String,
  addons: [{ name: String, price: Number }],
  unitPrice: Number,
  taxPercent: { type: Number, default: 0 },
  qty: Number,
  lineTotal: Number,
  note: String,
});

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'assigned',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
  'refunded',
];

// who may move an order into each status
export const STATUS_TRANSITIONS = {
  confirmed: { from: ['pending'], roles: ['partner', 'admin'] },
  preparing: { from: ['confirmed'], roles: ['partner', 'admin'] },
  ready: { from: ['preparing'], roles: ['partner', 'admin'] },
  assigned: { from: ['confirmed', 'preparing', 'ready'], roles: ['rider', 'partner', 'admin'] },
  picked_up: { from: ['ready', 'assigned'], roles: ['rider', 'admin'] },
  out_for_delivery: { from: ['picked_up'], roles: ['rider', 'admin'] },
  delivered: { from: ['out_for_delivery', 'picked_up'], roles: ['rider', 'admin'] },
  completed: { from: ['delivered'], roles: ['customer', 'admin'] },
  cancelled: {
    from: ['pending', 'confirmed', 'preparing'],
    roles: ['customer', 'partner', 'admin'],
  },
  refunded: { from: ['cancelled', 'delivered', 'completed'], roles: ['admin'] },
};

// Atomic auto-increment counter (avoids the countDocuments() race that produced
// duplicate order numbers when orders were created concurrently / in a loop).
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model('Counter', counterSchema);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, unique: true },
    // Shared across the orders produced by a single checkout (one per partner group).
    // Lets promo per-user limits count checkouts rather than individual split orders.
    checkoutGroup: { type: mongoose.Schema.Types.ObjectId, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    items: [orderItemSchema],
    itemsTotal: Number,
    taxTotal: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    tip: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    promoCode: String,
    grandTotal: Number,
    paymentMethod: { type: String, enum: ['cod', 'wallet', 'stripe', 'razorpay', 'paypal', 'paytm', 'flutterwave', 'midtrans', 'phonepe'], default: 'cod' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'refunded'], default: 'pending' },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending' },
    statusHistory: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
      },
    ],
    deliveryAddress: {
      label: String,
      line1: String,
      line2: String,
      city: String,
      area: String,
      pincode: String,
      lat: Number,
      lng: Number,
    },
    selfPickup: { type: Boolean, default: false },
    // v1 parity (Point_of_sale.php / dine-in): walk-in and table sales rung up
    // in the partner console — no delivery leg.
    orderType: { type: String, enum: ['delivery', 'pos', 'dine_in'], default: 'delivery' },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningTable', default: null },
    waiter: { type: mongoose.Schema.Types.ObjectId, ref: 'Waiter', default: null },
    customerNote: String,
    cancelReason: String,
    scheduledFor: Date,
    deliveredAt: Date,
    settled: { type: Boolean, default: false },
    commissionAmount: { type: Number, default: 0 },
    partnerEarning: { type: Number, default: 0 },
    riderEarning: { type: Number, default: 0 },
    rated: { type: Boolean, default: false },
    // v1 delete_order: hides a finished order from the customer's history without
    // destroying the record the partner/rider/admin ledgers still depend on.
    hiddenForCustomer: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const c = await Counter.findByIdAndUpdate(
      'order',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.orderNumber = `DPG${10000 + c.seq}`;
  }
  next();
});

// Hot query paths across the order/partner/rider/admin lists.
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ partner: 1, createdAt: -1 });
orderSchema.index({ rider: 1, status: 1 });
orderSchema.index({ status: 1, rider: 1 });

const promoCodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: String,
    type: { type: String, enum: ['percent', 'flat'], default: 'percent' },
    value: { type: Number, required: true },
    minOrder: { type: Number, default: 0 },
    maxDiscount: Number,
    usageLimit: { type: Number, default: 0 },
    perUserLimit: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    startsAt: Date,
    endsAt: Date,
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Cart = mongoose.model('Cart', cartSchema);
export const Order = mongoose.model('Order', orderSchema);
export const PromoCode = mongoose.model('PromoCode', promoCodeSchema);
