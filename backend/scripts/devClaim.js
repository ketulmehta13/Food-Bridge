// Development only: claim a donation as the dev NGO "ngoA", exactly the way the real
// NGO claim will (transitionDonation + logClaimAction), so the CLAIMED state can be tested.
// Usage: npm run dev:claim -- <donationId>      (run `npm run dev:users` first)
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { transitionDonation, logClaimAction } from '../src/services/donationStatus.service.js';
import { ApiError } from '../src/utils/ApiError.js';
import { DONATION_STATUS, CLAIM_ACTIONS, USER_TYPES } from '../src/constants/index.js';

const NGO_EMAIL = 'ngoa@foodbridge.dev';

const main = async () => {
  if (env.IS_PROD) throw new Error('Refusing to run dev:claim with NODE_ENV=production');
  const donationId = process.argv[2];
  if (!donationId || !mongoose.isValidObjectId(donationId)) {
    throw new Error('Usage: npm run dev:claim -- <donationId>  (a 24-character id)');
  }
  if (!env.MONGO_URI) throw new Error('MONGO_URI is not set in backend/.env');

  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });

  const ngo = await User.findOne({ email: NGO_EMAIL, userType: USER_TYPES.NGO }).select('_id').lean();
  if (!ngo) throw new Error(`${NGO_EMAIL} not found. Run "npm run dev:users" first.`);

  const donation = await transitionDonation({
    donationId,
    from: [DONATION_STATUS.AVAILABLE],
    to: DONATION_STATUS.CLAIMED,
    set: { claimedBy: ngo._id, claimedAt: new Date() },
  });
  await logClaimAction({
    donation: donation._id,
    ngo: ngo._id,
    actor: ngo._id,
    action: CLAIM_ACTIONS.CLAIMED,
  });

  console.log(`Donation ${donation._id} is now ${donation.status}, claimed by ngoA.`);
};

main()
  .catch((err) => {
    const prefix = err instanceof ApiError ? `${err.statusCode} ` : '';
    console.error(`dev:claim failed: ${prefix}${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
