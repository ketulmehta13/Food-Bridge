import mongoose from 'mongoose';
import {
  DONATION_STATUS,
  FOOD_TYPES,
  FOOD_CATEGORIES,
  DONATION_LIMITS,
} from '../constants/index.js';
import { pointSchema } from './schemas/point.schema.js';

// A food donation posted by a donor. Owner: Jay.
// The NGO side reads it and updates the claim/pickup fields through
// services/donationStatus.service.js only.

const HOUR_MS = 60 * 60 * 1000;

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 100 },
    quantity: { type: Number, required: true, min: [0.01, 'Quantity must be positive'], max: 10000 },
    unit: { type: String, required: true, trim: true, minlength: 1, maxlength: 20 },
  },
  { _id: false }
);

// A file stored on Cloudinary. publicId is needed to delete it later.
const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, maxlength: 500 },
    publicId: { type: String, required: true, maxlength: 200 },
  },
  { _id: false }
);

// Every checklist item must be confirmed (true) before food can be posted.
const mustBeTrue = { validator: (v) => v === true, message: 'All safety checks must be confirmed' };
const checkField = { type: Boolean, required: true, validate: mustBeTrue };

const donationSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    items: {
      type: [itemSchema],
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= DONATION_LIMITS.MAX_ITEMS,
        message: `A donation needs 1 to ${DONATION_LIMITS.MAX_ITEMS} items`,
      },
    },
    totalServings: {
      type: Number,
      required: true,
      min: 1,
      max: 10000,
      validate: { validator: Number.isInteger, message: 'totalServings must be a whole number' },
    },
    estimatedWeightKg: {
      type: Number,
      required: true,
      min: [0.01, 'Weight must be positive'],
      max: 2000,
    },
    foodType: { type: String, enum: Object.values(FOOD_TYPES), required: true },
    category: { type: String, enum: Object.values(FOOD_CATEGORIES), required: true },

    preparedAt: { type: Date, required: true },
    bestBefore: { type: Date, required: true },
    pickupWindow: {
      start: { type: Date, required: true },
      end: { type: Date, required: true },
    },

    location: { type: pointSchema, required: true },
    address: {
      line1: { type: String, trim: true, maxlength: 200 },
      city: { type: String, trim: true, maxlength: 100 },
      state: { type: String, trim: true, maxlength: 100 },
      pincode: { type: String, trim: true, match: [/^\d{6}$/, 'Pincode must be 6 digits'] },
    },
    contactPhone: { type: String, trim: true, match: [/^\+?[0-9]{10,15}$/, 'Invalid phone number'] },

    photos: {
      type: [imageSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= DONATION_LIMITS.MAX_PHOTOS,
        message: `A donation can have at most ${DONATION_LIMITS.MAX_PHOTOS} photos`,
      },
    },
    safetyChecklist: {
      preparedHygienically: checkField,
      storedAtSafeTemperature: checkField,
      packedAndCovered: checkField,
      notSpoiled: checkField,
    },
    allergenInfo: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 500 },

    // ---- Lifecycle (changed only through the status service) ----
    status: {
      type: String,
      enum: Object.values(DONATION_STATUS),
      default: DONATION_STATUS.AVAILABLE,
    },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    claimedAt: Date,

    pickupOtpHash: { type: String, select: false },
    otpGeneratedAt: Date,
    otpAttempts: { type: Number, default: 0, min: 0 },

    pickedUpAt: Date,
    distributedAt: Date,
    distributionPhoto: { type: imageSchema, default: undefined },

    cancelReason: { type: String, trim: true, maxlength: 500 },
    cancelledAt: Date,
    expiredAt: Date,
  },
  { timestamps: true }
);

// ---- Indexes ----
donationSchema.index({ location: '2dsphere', status: 1 }); // nearby feed
donationSchema.index({ status: 1, bestBefore: 1 }); // expiry job
donationSchema.index({ donor: 1, createdAt: -1 }); // "my donations"
donationSchema.index({ claimedBy: 1, status: 1 }); // NGO "my claims"

// ---- Invariant time rules ----
// Rules relative to "now" (e.g. bestBefore > now + 30 min) are checked by the
// validators/services when posting or editing, not here, so later saves
// (status changes) never fail just because time has passed.
donationSchema.pre('validate', function () {
  const { preparedAt, bestBefore, pickupWindow } = this;
  const start = pickupWindow?.start;
  const end = pickupWindow?.end;

  if (start && end && start >= end) {
    this.invalidate('pickupWindow.start', 'Pickup window start must be before its end');
  }
  if (end && bestBefore && end > bestBefore) {
    this.invalidate('pickupWindow.end', 'Pickup window must end by the best-before time');
  }
  if (preparedAt && bestBefore) {
    if (bestBefore <= preparedAt) {
      this.invalidate('bestBefore', 'Best-before must be after the prepared time');
    } else if (bestBefore - preparedAt > DONATION_LIMITS.MAX_SHELF_LIFE_HOURS * HOUR_MS) {
      this.invalidate(
        'bestBefore',
        `Best-before must be within ${DONATION_LIMITS.MAX_SHELF_LIFE_HOURS} hours of preparation`
      );
    }
  }
});

// Never expose OTP data in JSON responses.
donationSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.pickupOtpHash;
    delete ret.otpAttempts;
    delete ret.__v;
    return ret;
  },
});

export const Donation = mongoose.model('Donation', donationSchema);
