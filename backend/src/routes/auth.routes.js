import { Router } from 'express';
import { register, login, refresh, logout } from '../controllers/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authLimiter } from '../middlewares/rateLimit.middleware.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';

// Auth routes, mounted at /api/auth. Owner: Ketul.
const router = Router();

router.post('/register', authLimiter, validate({ body: registerSchema }), register);
router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/refresh', refresh); // uses the refreshToken cookie
router.post('/logout', logout); // works even if the access token has expired

export default router;
