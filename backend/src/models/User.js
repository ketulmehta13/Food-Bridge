import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  ROLES,
  USER_TYPES,
  VERIFICATION_STATUS,
  DONOR_CATEGORIES,
} from '../constants/index.js';

// Shared User model for donors, NGOs and admins. Owner: Ketul.
// Donor-specific fields live in donorProfile, NGO-specific ones in ngoProfile.

const SALT_ROUNDS = 12;

// "Required only for NGO users" / "only for donor users".
const isNgo = function () {
  return this.role === ROLES.USER && this.userType === USER_TYPES.NGO;
};
const isDonor = function () {
  return this.role === ROLES.USER && this.userType === USER_TYPES.DONOR;
};

// GeoJSON Point: coordinates are [longitude, latitude].
const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: ([lng, lat] = []) =>
          lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
        message: 'Coordinates must be [longitude, latitude]',
      },
    },
  },
  { _id: false }
);

// A file uploaded to Cloudinary (e.g. NGO registration certificate).
const documentSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true }, // needed to delete from Cloudinary
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    // ---- Common to everyone ----
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 100 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by queries unless asked for with .select('+password')
    },
    phone: { type: String, trim: true, match: [/^\+?[0-9]{10,15}$/, 'Invalid phone number'] },

    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    userType: {
      type: String,
      enum: Object.values(USER_TYPES),
      required: [
        function () {
          return this.role === ROLES.USER;
        },
        'userType is required',
      ],
    },

    // Admin approval. Admin accounts are always treated as verified.
    verificationStatus: {
      type: String,
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.PENDING,
    },
    rejectionReason: { type: String, trim: true },
    verifiedAt: Date,

    address: {
      line1: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      pincode: { type: String, trim: true },
    },
    location: { type: pointSchema, required: [isNgo, 'Location is required for NGOs'] },

    // ---- Donor only (fields can be extended by Jay as needed) ----
    donorProfile: {
      businessName: { type: String, trim: true },
      donorCategory: {
        type: String,
        enum: Object.values(DONOR_CATEGORIES),
        required: [isDonor, 'Donor category is required'],
      },
    },

    // ---- NGO only ----
    ngoProfile: {
      orgName: { type: String, trim: true, required: [isNgo, 'Organisation name is required'] },
      registrationNumber: {
        type: String,
        trim: true,
        required: [isNgo, 'Registration number is required'],
      },
      contactPerson: { type: String, trim: true },
      serviceRadiusKm: { type: Number, min: 1, max: 100, default: 10 },
      capacityMealsPerDay: { type: Number, min: 0 },
      documents: { type: [documentSchema], default: undefined },
    },

    // ---- Account state ----
    isActive: { type: Boolean, default: true }, // admin can deactivate
    refreshTokenHash: { type: String, select: false }, // hash of the current refresh token
    lastLoginAt: Date,
  },
  { timestamps: true }
);

// ---- Indexes ----
userSchema.index({ location: '2dsphere' }); // nearby searches
userSchema.index({ userType: 1, verificationStatus: 1 }); // admin verification queues

// ---- Hooks ----

// Hash the password whenever it is set or changed.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
});

// Admins never need verification; clear profile data that doesn't apply.
userSchema.pre('validate', function () {
  if (this.role === ROLES.ADMIN) {
    this.verificationStatus = VERIFICATION_STATUS.VERIFIED;
    this.userType = undefined;
  }
  if (this.userType !== USER_TYPES.NGO) this.ngoProfile = undefined;
  if (this.userType !== USER_TYPES.DONOR) this.donorProfile = undefined;
});

// ---- Instance methods ----

// Check a plain-text password against the stored hash.
// The user must be loaded with .select('+password').
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

// The data put inside the access token. protect() exposes it as req.user.
userSchema.methods.toTokenPayload = function () {
  return {
    id: this._id.toString(),
    role: this.role,
    userType: this.userType,
    verificationStatus: this.verificationStatus,
  };
};

// Strip secrets whenever a user is sent as JSON.
userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.refreshTokenHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
