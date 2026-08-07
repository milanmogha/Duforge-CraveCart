import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['credit', 'debit'], required: true },
    amount: { type: Number, required: true },
    balanceAfter: Number,
    source: {
      type: String,
      enum: [
        'order_payment',
        'order_earning',
        'order_refund',
        'wallet_topup',
        'withdrawal',
        'fund_transfer',
        'commission',
        'tip',
        'referral_bonus',
        'cod_collection',
      ],
      required: true,
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    note: String,
  },
  { timestamps: true }
);

const withdrawalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    note: String,
    adminNote: String,
    processedAt: Date,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// A gateway payment attempt. Checkout params are frozen here at intent-creation time
// so the confirm step can't be tampered with from the client.
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gateway: { type: String, enum: ['stripe', 'razorpay', 'paypal', 'paytm', 'flutterwave', 'midtrans', 'phonepe'], required: true },
    purpose: { type: String, enum: ['order', 'topup'], default: 'order' },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['created', 'paid', 'fulfilling', 'failed', 'consumed'],
      default: 'created',
    },
    checkoutParams: {
      addressId: String,
      promoCode: String,
      tip: Number,
      note: String,
      selfPickup: Boolean,
      scheduledFor: Date,
    },
    stripeSessionId: String,
    razorpayOrderId: String,
    // generic per-gateway order/reference id (PayPal order id, Paytm orderId,
    // Flutterwave tx_ref)
    gatewayOrderId: String,
    gatewayPaymentId: String,
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    error: String,
  },
  { timestamps: true }
);
paymentSchema.index({ stripeSessionId: 1 });
paymentSchema.index({ razorpayOrderId: 1 });
paymentSchema.index({ gatewayOrderId: 1 });

// v1 parity (admin Return_request.php): customer asks to return a delivered
// order; admin approves (full refund via the existing refund path) or rejects.
const returnRequestSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminNote: String,
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    processedAt: Date,
  },
  { timestamps: true }
);

export const Transaction = mongoose.model('Transaction', transactionSchema);
export const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
