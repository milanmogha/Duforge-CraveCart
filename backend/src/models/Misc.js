import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    target: { type: String, enum: ['product', 'partner', 'rider', 'order'], required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String,
    images: [String],
    verifiedPurchase: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    reply: String,
  },
  { timestamps: true }
);

const ticketMessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: String,
    message: { type: String, required: true },
    attachments: [String],
  },
  { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    type: {
      type: String,
      enum: ['order', 'payment', 'refund', 'account', 'other'],
      default: 'other',
    },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    messages: [ticketMessageSchema],
  },
  { timestamps: true }
);

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    body: String,
    type: { type: String, default: 'general' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const sliderSchema = new mongoose.Schema(
  {
    title: String,
    image: { type: String, required: true },
    link: String,
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const offerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    image: String,
    description: String,
    startsAt: Date,
    endsAt: Date,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

const pageSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    content: String,
  },
  { timestamps: true }
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    category: { type: String, default: 'General' },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const citySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    state: String,
    // v1 parity (admin Area.php): serviceable areas within the city. Empty =
    // whole city serviceable; non-empty = addresses must pick one of these.
    areas: [String],
    // v1 `cities.bordering_city_ids` (function_helper get_cities): cities this one
    // will also serve. A customer in a bordering city can order from partners here,
    // which is how v1 handled metros that spill across municipal boundaries.
    borderingCities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'City' }],
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const featuredSectionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: String,
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// v1 parity: Language.php + language packs. `strings` holds the full key→text
// map for a language; the storefront fetches it and falls back to English (or
// the hardcoded default) for missing keys.
const languageSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    nativeName: String,
    rtl: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    strings: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

// v1 parity: client API keys (Client_api_keys.php) — named secrets external
// integrations sign JWTs with. The secret is generated server-side and never
// changes on edit (v1 behavior).
const apiKeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    secret: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// v1 parity: media library — every upload is recorded so consoles can browse
// and reuse files instead of re-uploading (v1 Media.php / get_media).
const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    filename: String,
    mime: String,
    size: Number,
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: String,
    resource: String,
    resourceId: String,
    detail: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

// v1 parity: the `otps` table (one live code per mobile, keyed by phone).
// `purpose` separates signup verification from password reset so a code minted for
// one can't be replayed against the other. `consumedAt` is what registration checks —
// verifying an OTP does not create an account, it just marks the phone provable for
// a short window (v1: verify_user → verify_otp → register_user).
const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    code: { type: String, required: true },
    purpose: { type: String, enum: ['signup', 'reset'], default: 'signup', index: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: Date,
  },
  { timestamps: true }
);
// Let Mongo evict stale codes instead of accumulating them forever. The grace period
// keeps a consumed code around long enough for registration to claim it.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const Review = mongoose.model('Review', reviewSchema);
export const Ticket = mongoose.model('Ticket', ticketSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const Slider = mongoose.model('Slider', sliderSchema);
export const Offer = mongoose.model('Offer', offerSchema);
export const Setting = mongoose.model('Setting', settingSchema);
export const Page = mongoose.model('Page', pageSchema);
export const Faq = mongoose.model('Faq', faqSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const City = mongoose.model('City', citySchema);
export const FeaturedSection = mongoose.model('FeaturedSection', featuredSectionSchema);
export const Media = mongoose.model('Media', mediaSchema);
export const Language = mongoose.model('Language', languageSchema);
export const ApiKey = mongoose.model('ApiKey', apiKeySchema);
export const Otp = mongoose.model('Otp', otpSchema);
