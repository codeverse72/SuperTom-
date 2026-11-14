import { Router } from 'express';
import { UserController } from './userController.js';
import { requireAuth } from '../../middleware/auth.js';

export const userRouter = Router();

userRouter.get('/me', requireAuth, UserController.getMe);
userRouter.get('/balance', requireAuth, UserController.getBalance);
userRouter.post('/language', requireAuth, UserController.updateLanguage);

