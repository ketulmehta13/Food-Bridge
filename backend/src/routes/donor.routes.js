import { Router } from 'express';
import { protect, requireUserType } from '../middlewares/auth.middleware.js';
import { loadCurrentUser } from '../middlewares/currentUser.middleware.js';
import { csrfGuard } from '../middlewares/csrf.middleware.js';
import { USER_TYPES } from '../constants/index.js';

// Donor feature routes, mounted at /api/donor. Owner: Jay.
const router = Router();

// Every /api/donor route requires a logged-in, active DONOR user (re-checked against the DB),
// and state-changing requests must carry the CSRF header.
router.use(protect, requireUserType(USER_TYPES.DONOR), loadCurrentUser, csrfGuard);

// Add donor routes below, e.g.:
// router.post('/donations', requireVerified, validate({ body: createDonationSchema }), createDonation);
// router.get('/donations', getMyDonations);

export default router;
