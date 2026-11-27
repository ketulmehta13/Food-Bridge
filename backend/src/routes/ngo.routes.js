import { Router } from 'express';
import { protect, requireUserType } from '../middlewares/auth.middleware.js';
import { USER_TYPES } from '../constants/index.js';

// NGO feature routes, mounted at /api/ngo. Owner: Ketul.
const router = Router();

// Every /api/ngo route requires a logged-in NGO user.
router.use(protect, requireUserType(USER_TYPES.NGO));

// Add NGO routes below, e.g.:
// router.get('/profile', getProfile);
// router.post('/donations/:id/claim', requireVerified, validate({ params: idParam }), claimDonation);

export default router;
