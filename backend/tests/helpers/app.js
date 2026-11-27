import express from 'express';
import cookieParser from 'cookie-parser';
import { ApiResponse } from '../../src/utils/ApiResponse.js';
import { errorHandler } from '../../src/middlewares/error.middleware.js';

/**
 * Minimal Express app for testing middlewares in isolation.
 * Every request hits the given middlewares, then a final handler that echoes req.user and body.
 */
export const makeApp = (...middlewares) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.all('/test', ...middlewares, (req, res) =>
    ApiResponse.send(res, 200, { user: req.user ?? null, body: req.body ?? null })
  );
  app.use(errorHandler);
  return app;
};
