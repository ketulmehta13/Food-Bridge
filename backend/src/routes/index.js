import { Router } from 'express';
import mongoose from 'mongoose';
import { ApiResponse } from '../utils/ApiResponse.js';
import ngoRoutes from './ngo.routes.js';
import donorRoutes from './donor.routes.js';

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

// Feature routers. Add new endpoints inside each feature's own routes file,
// not here, so this file rarely changes (avoids merge conflicts).
router.use('/ngo', ngoRoutes); //     -> /api/ngo/*    (Ketul)
router.use('/donor', donorRoutes); // -> /api/donor/*  (Jay)

// Still to be mounted when built:
// router.use('/auth', authRoutes);   // -> /api/auth/*   (Ketul)
// router.use('/users', userRoutes);  // -> /api/users/*  (Ketul)
// router.use('/admin', adminRoutes); // -> /api/admin/*

export default router;
