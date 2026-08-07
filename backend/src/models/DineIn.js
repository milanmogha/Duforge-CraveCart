import mongoose from 'mongoose';

// v1 parity: partner dine-in module (Table_booking.php floors/tables,
// Waiter_model, table bookings) — all rows are partner-scoped.

const floorSchema = new mongoose.Schema(
  {
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const diningTableSchema = new mongoose.Schema(
  {
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    floor: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor' },
    title: { type: String, required: true },
    capacity: { type: Number, default: 4 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const waiterSchema = new mongoose.Schema(
  {
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    phone: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const tableBookingSchema = new mongoose.Schema(
  {
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // absent for walk-in/guest bookings
    name: { type: String, required: true },
    phone: { type: String, required: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningTable' }, // assigned by partner
    partySize: { type: Number, default: 2 },
    bookedFor: { type: Date, required: true },
    note: String,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'seated', 'completed', 'cancelled'],
      default: 'pending',
    },
  },
  { timestamps: true }
);
tableBookingSchema.index({ partner: 1, bookedFor: 1 });

export const Floor = mongoose.model('Floor', floorSchema);
export const DiningTable = mongoose.model('DiningTable', diningTableSchema);
export const Waiter = mongoose.model('Waiter', waiterSchema);
export const TableBooking = mongoose.model('TableBooking', tableBookingSchema);
