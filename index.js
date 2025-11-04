import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { json } from 'express';
import { postToFlaskWithRetry, axiosErrorInfo } from './application/flaskClient.js';
dotenv.config();


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: 'https://lazy-ledger-frontend.vercel.app', 
    credentials: true, 
}));
app.use(json()); 


// API routers are imported dynamically after the server starts to avoid
// pulling in modules that establish DB connections during startup.

// DEBUG endpoint - small probe to validate connectivity to the Flask parser service
app.get('/debug/probe-flask', async (req, res) => {
    try {
        // small test payload
        const payload = { raw_text: 'debug probe', date: new Date().toISOString().slice(0,10) };
        const r = await postToFlaskWithRetry('/parse-text', payload);
        return res.status(200).json({ ok: true, status: r.status, data: r.data });
    } catch (err) {
        console.error('Probe error:', axiosErrorInfo(err));
        return res.status(502).json({ ok: false, error: axiosErrorInfo(err) });
    }
});

app.listen(PORT,() => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});

// Dynamically import and mount API routers so DB connection issues won't
// prevent the debug endpoint from being reachable. Errors importing routers
// will be logged but won't crash the server.
(async () => {
    try {
        const [{ default: recordsRouter }, { default: transactionsRouter }, { default: webhookRouter }] = await Promise.all([
            import('./api/records.js'),
            import('./api/transactions.js'),
            import('./api/webhook.js')
        ]);

        app.use('/api/raw-records', recordsRouter);
        app.use('/api/transactions', transactionsRouter);
        app.use('/api/webhook', webhookRouter);
        console.log('API routers mounted');
    } catch (err) {
        console.error('Failed to import/mount API routers:', err);
    }
})();


 