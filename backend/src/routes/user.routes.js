import { Router } from 'express';
import { getMe } from '../controllers/user.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

// User account routes, mounted at /api/users. Owner: Ketul.
const router = Router();

router.use(protect); // every /api/users route needs a logged-in user

router.get('/me', getMe);

export default router;
