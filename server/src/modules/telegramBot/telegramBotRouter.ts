import { Router } from 'express';
import { TelegramBotController } from './telegramBotController.js';

export const telegramBotRouter = Router();

telegramBotRouter.post('/webhook', TelegramBotController.handleWebhook);
telegramBotRouter.post('/set-webhook', TelegramBotController.setWebhook);
telegramBotRouter.get('/set-webhook', TelegramBotController.setWebhook);

