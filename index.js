import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { json } from 'express';
import recordsRouter from './api/records.js';

import transactionsRouter from './api/transactions.js';
import webhookRouter from './api/webhook.js';
dotenv.config();


const app = express();
const PORT = 5000;

app.use(cors({
    origin: 'https://lazy-ledger-frontend.vercel.app', 
    credentials: true, 
}));
app.use(json()); 


app.use('/api/raw-records', recordsRouter);

app.use('/api/transactions',transactionsRouter);
app.use('/api/webhook', webhookRouter);

app.listen(PORT,() => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});


 