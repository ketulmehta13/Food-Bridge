import { Router } from 'express';
import { protect, requireUserType } from '../middlewares/auth.middleware.js';
import { USER_TYPES } from '../constants/index.js';

// Donor feature routes, mounted at /api/donor. Owner: Jay.
const router = Router();

// Every /api/donor route requires a logged-in DONOR user.
router.use(protect, requireUserType(USER_TYPES.DONOR));

// Add donor routes below, e.g.:
// router.post('/donations', requireVerified, validate({ body: createDonationSchema }), createDonation);
// router.get('/donations', getMyDonations);

export default router;
