
import express from 'express';
import { webhookHandler } from '../application/webhook.js';

const webhookRouter = express.Router();

webhookRouter.post('/clerk', webhookHandler);

export default webhookRouter;