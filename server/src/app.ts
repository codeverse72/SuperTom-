import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRouter } from './modules/auth/authRouter.js';
import { userRouter } from './modules/users/userRouter.js';
import { miningRouter } from './modules/mining/miningRouter.js';
import { storeRouter } from './modules/store/storeRouter.js';
import { spinRouter } from './modules/spin/spinRouter.js';
import { missionRouter } from './modules/missions/missionRouter.js';
import { referralRouter } from './modules/referrals/referralRouter.js';
import { payoutRouter } from './modules/payouts/payoutRouter.js';
import { adminRouter } from './modules/admin/adminRouter.js';
import { swaggerDocument } from './docs/swagger.js';
import { sendSuccess } from './utils/apiResponse.js';

export function createApp(): Express {
  const app = express();

  // 1. Security & Basic Middlewares
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows Swagger UI to render inline assets
    })
  );

  app.use(
    cors({
      origin: env.FRONTEND_URL === '*' ? true : env.FRONTEND_URL.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Init-Data'],
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  if (env.NODE_ENV !== 'test') {
    app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  }

  // 2. Health Check Endpoint (Render & Uptime Monitoring)
  const healthHandler = (_req: Request, res: Response) => {
    sendSuccess(res, {
      status: 'healthy',
      service: 'supertom-backend',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  // 3. Swagger OpenAPI Documentation
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // 4. Mount API v1 Modular Routes
  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/user', userRouter);
  apiV1.use('/mining', miningRouter);
  apiV1.use('/store', storeRouter);
  apiV1.use('/spin', spinRouter);
  apiV1.use('/missions', missionRouter);
  apiV1.use('/referrals', referralRouter);
  apiV1.use('/payouts', payoutRouter);
  apiV1.use('/admin', adminRouter);

  app.use('/api/v1', apiV1);

  // 5. 404 Handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // 6. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

