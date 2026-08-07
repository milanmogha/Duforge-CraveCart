import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, enum: ['Home', 'Work', 'Other'], default: 'Home' },
    line1: { type: String, required: true },
    line2: String,
    city: { type: String, required: true },
    area: String,
    pincode: String,
    lat: Number,
    lng: Number,
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const partnerProfileSchema = new mongoose.Schema(
  {
    storeName: String,
    slug: String,
    description: String,
    logo: String,
    banner: String,
    address: String,
    city: String,
    lat: Number,
    lng: Number,
    cuisineTags: [String],
    openTime: { type: String, default: '09:00' },
    closeTime: { type: String, default: '22:00' },
    isOpen: { type: Boolean, default: true },
    deliveryCharge: { type: Number, default: 30 },
    freeDeliveryAbove: { type: Number, default: 500 },
    minOrder: { type: Number, default: 0 },
    commissionPercent: { type: Number, default: 10 },
    bankName: String,
    bankAccount: String,
    bankIfsc: String,
    kycStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    kycRejectReason: String,
    documents: [String],
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const riderProfileSchema = new mongoose.Schema(
  {
    vehicleType: { type: String, enum: ['bike', 'scooter', 'bicycle', 'car'], default: 'bike' },
    vehicleNumber: String,
    licenseNumber: String,
    city: String,
    documents: [String],
    bankName: String,
    bankAccount: String,
    bankIfsc: String,
    kycStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    kycRejectReason: String,
    isOnline: { type: Boolean, default: false },
    currentLat: Number,
    currentLng: Number,
    locationUpdatedAt: Date,
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    codHeld: { type: Number, default: 0 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    phoneVerified: { type: Boolean, default: false },
    password: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['customer', 'partner', 'rider', 'admin'],
      default: 'customer',
    },
    avatar: String,
    language: { type: String, default: 'en' },
    status: { type: String, enum: ['active', 'suspended', 'deleted'], default: 'active' },
    walletBalance: { type: Number, default: 0 },
    referralCode: String,
    referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    fcmToken: String,
    fcmTokens: [String], // multi-device push targets (v1 update_fcm equivalent)
    resetCode: { type: String, select: false },
    resetCodeExpires: { type: Date, select: false },
    addresses: [addressSchema],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    partnerProfile: partnerProfileSchema,
    riderProfile: riderProfileSchema,
    lastLoginAt: Date,
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.toSafe = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', userSchema);
