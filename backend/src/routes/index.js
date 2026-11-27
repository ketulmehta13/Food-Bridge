import { Router } from 'express';
import mongoose from 'mongoose';
import { ApiResponse } from '../utils/ApiResponse.js';

const router = Router();

// Health check: GET /api/health
router.get('/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  ApiResponse.send(
    res,
    200,
    {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbStates[mongoose.connection.readyState] ?? 'unknown',
    },
    'FoodBridge API is running'
  );
});

// Feature routes are mounted here as they are built, e.g.:
// import authRoutes from './auth.routes.js';
// import userRoutes from './user.routes.js';
// import donationRoutes from './donation.routes.js';
// import adminRoutes from './admin.routes.js';
//
// router.use('/auth', authRoutes);           // -> /api/auth/*
// router.use('/users', userRoutes);          // -> /api/users/*
// router.use('/donations', donationRoutes);  // -> /api/donations/*
// router.use('/admin', adminRoutes);         // -> /api/admin/*

export default router;
