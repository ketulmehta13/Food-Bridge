import { Router } from 'express';
import { protect, requireUserType, requireVerified } from '../middlewares/auth.middleware.js';
import { loadCurrentUser } from '../middlewares/currentUser.middleware.js';
import { csrfGuard, requireJson } from '../middlewares/csrf.middleware.js';
import { createDonationLimiter } from '../middlewares/donorLimits.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { idParam } from '../validators/common.validators.js';
import { createDonationBody, listMyDonationsQuery } from '../validators/donor.validators.js';
import * as donor from '../controllers/donor.controller.js';
import { USER_TYPES } from '../constants/index.js';

// Donor feature routes, mounted at /api/donor. Owner: Jay.
const router = Router();

// Every /api/donor route requires a logged-in, active DONOR user (re-checked against the DB),
// and state-changing requests must carry the CSRF header.
router.use(protect, requireUserType(USER_TYPES.DONOR), loadCurrentUser, csrfGuard);

// ---- Donations ----
router.post(
  '/donations',
  requireVerified,
  createDonationLimiter,
  requireJson,
  validate({ body: createDonationBody }),
  donor.createDonation
);
router.get('/donations', validate({ query: listMyDonationsQuery }), donor.listMyDonations);
router.get('/donations/:id', validate({ params: idParam }), donor.getMyDonation);

export default router;
