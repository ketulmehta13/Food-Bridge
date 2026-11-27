// Creates sample users for local development. Run with: npm run seed
// Safe to run many times: existing sample users (same email) are replaced.
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { ROLES, USER_TYPES, VERIFICATION_STATUS } from '../src/constants/index.js';

if (env.IS_PROD) {
  console.error('Refusing to seed in production.');
  process.exit(1);
}

const PASSWORD = 'Password@123'; // dev-only password for every sample user

const users = [
  {
    name: 'Admin',
    email: 'admin@foodbridge.dev',
    role: ROLES.ADMIN,
  },
  {
    name: 'Asha (verified NGO)',
    email: 'ngo@foodbridge.dev',
    userType: USER_TYPES.NGO,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    phone: '9876543210',
    address: { line1: 'CG Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380009' },
    location: { type: 'Point', coordinates: [72.5714, 23.0225] },
    ngoProfile: {
      orgName: 'Asha Food Foundation',
      registrationNumber: 'NGO-GJ-0001',
      contactPerson: 'Asha Patel',
      serviceRadiusKm: 10,
      capacityMealsPerDay: 300,
    },
  },
  {
    name: 'Seva (pending NGO)',
    email: 'ngo-pending@foodbridge.dev',
    userType: USER_TYPES.NGO,
    location: { type: 'Point', coordinates: [72.5293, 23.0300] },
    ngoProfile: { orgName: 'Seva Trust', registrationNumber: 'NGO-GJ-0002' },
  },
  {
    name: 'Ravi (verified donor)',
    email: 'donor@foodbridge.dev',
    userType: USER_TYPES.DONOR,
    verificationStatus: VERIFICATION_STATUS.VERIFIED,
    phone: '9123456780',
    address: { line1: 'SG Highway', city: 'Ahmedabad', state: 'Gujarat', pincode: '380054' },
    donorProfile: { businessName: 'Ravi Restaurant', donorCategory: 'RESTAURANT' },
  },
];

const run = async () => {
  await mongoose.connect(env.MONGO_URI);
  await User.syncIndexes(); // make sure the unique + 2dsphere indexes exist

  for (const data of users) {
    await User.deleteOne({ email: data.email });
    await User.create({ ...data, password: PASSWORD }); // create() runs hooks, so the password gets hashed
    console.log(`  created ${data.email}`);
  }

  console.log(`\nDone. All sample users use the password: ${PASSWORD}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('Seeding failed:', err.message);
  await mongoose.disconnect();
  process.exit(1);
});
