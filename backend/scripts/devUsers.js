// Development only: create/refresh 4 test users and print a 12-hour access token for each.
// Usage: npm run dev:users   (needs MONGO_URI and JWT_ACCESS_SECRET in backend/.env)
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { toPoint } from '../src/utils/geo.js';
import {
  USER_TYPES,
  VERIFICATION_STATUS,
  DONOR_CATEGORIES,
} from '../src/constants/index.js';

const PASSWORD = 'Password@123';
const TOKEN_TTL = '12h';

const DEV_USERS = [
  {
    key: 'donorA',
    name: 'Donor A',
    email: 'donorA@foodbridge.dev',
    userType: USER_TYPES.DONOR,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    donorProfile: { businessName: 'Donor A Kitchen', donorCategory: DONOR_CATEGORIES.RESTAURANT },
  },
  {
    key: 'donorB',
    name: 'Donor B',
    email: 'donorB@foodbridge.dev',
    userType: USER_TYPES.DONOR,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    donorProfile: { businessName: 'Donor B Caterers', donorCategory: DONOR_CATEGORIES.CATERER },
  },
  {
    key: 'donorPending',
    name: 'Donor Pending',
    email: 'donorPending@foodbridge.dev',
    userType: USER_TYPES.DONOR,
    verificationStatus: VERIFICATION_STATUS.PENDING,
    donorProfile: { donorCategory: DONOR_CATEGORIES.HOUSEHOLD },
  },
  {
    key: 'ngoA',
    name: 'NGO A',
    email: 'ngoA@foodbridge.dev',
    userType: USER_TYPES.NGO,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    location: toPoint(23.0225, 72.5714), // Ahmedabad
    address: { city: 'Ahmedabad', state: 'Gujarat' },
    ngoProfile: { orgName: 'NGO A Foundation', registrationNumber: 'DEV-NGO-0001' },
  },
];

const main = async () => {
  if (env.IS_PROD) throw new Error('Refusing to run dev:users with NODE_ENV=production');
  if (!env.MONGO_URI) throw new Error('MONGO_URI is not set in backend/.env');
  if (!env.JWT_ACCESS_SECRET) throw new Error('JWT_ACCESS_SECRET is not set in backend/.env');

  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  const tokens = [];
  for (const { key, ...data } of DEV_USERS) {
    // load-then-save (not findOneAndUpdate) so the password hashing hook runs
    const user = (await User.findOne({ email: data.email.toLowerCase() })) ?? new User();
    user.set({ ...data, password: PASSWORD, isActive: true });
    await user.save();

    const token = jwt.sign(user.toTokenPayload(), env.JWT_ACCESS_SECRET, { expiresIn: TOKEN_TTL });
    tokens.push({ key, email: user.email, status: user.verificationStatus, token });
  }

  console.log(`\nDev users ready (password: ${PASSWORD}). Tokens are valid for ${TOKEN_TTL}.\n`);
  for (const t of tokens) {
    console.log(`${t.key}  <${t.email}>  [${t.status}]\n${t.token}\n`);
  }
};

main()
  .catch((err) => {
    console.error(`dev:users failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
