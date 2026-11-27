import { Router } from 'express';
import { protect, requireUserType } from '../middlewares/auth.middleware.js';
import { loadCurrentUser } from '../middlewares/currentUser.middleware.js';
import { csrfGuard, requireJson } from '../middlewares/csrf.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { updateNgoProfileBody } from '../validators/ngo.validators.js';
import * as ngo from '../controllers/ngo.controller.js';
import { USER_TYPES } from '../constants/index.js';

// NGO feature routes, mounted at /api/ngo. Owner: Ketul.
const router = Router();

// Every /api/ngo route requires a logged-in, active NGO user (re-checked against the DB),
// and state-changing requests must carry the CSRF header. Same chain as the donor routes.
router.use(protect, requireUserType(USER_TYPES.NGO), loadCurrentUser, csrfGuard);

// ---- Profile ----
router.get('/profile', ngo.getProfile);
router.patch('/profile', requireJson, validate({ body: updateNgoProfileBody }), ngo.updateProfile);

export default router;
