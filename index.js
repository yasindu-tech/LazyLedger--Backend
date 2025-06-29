import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import recordsRouter from './api/records.js';
import transactionsRouter from './api/transactions.js';
import webhookRouter from './api/webhook.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: 'https://lazy-ledger-frontend.vercel.app', 
    credentials: true, 
}));

// Use raw body for webhooks (before JSON parsing)
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRouter);

// Use JSON parsing for other routes
app.use(express.json()); 

app.use('/api/raw-records', recordsRouter);
app.use('/api/transactions', transactionsRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});


 