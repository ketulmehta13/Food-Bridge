import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { apiLimiter } from './middlewares/rateLimit.middleware.js';
import { notFound, errorHandler } from './middlewares/error.middleware.js';

const app = express();

// Needed for correct client IPs (rate limiting, secure cookies) behind proxies.
// In production: browser -> Vercel (forwards /api) -> Render -> app, so set TRUST_PROXY=2.
if (env.IS_PROD) app.set('trust proxy', env.TRUST_PROXY);

// Security + parsing
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging in development
if (env.NODE_ENV === 'development') app.use(morgan('dev'));

// API routes
app.use('/api', apiLimiter, routes);

// 404 + centralised error handling (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;
