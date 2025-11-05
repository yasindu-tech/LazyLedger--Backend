import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { postToFlaskWithRetry, axiosErrorInfo } from './application/flaskClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - allow main frontend and local dev origins
const corsOptions = {
  origin: function (origin, cb) {
    const allowed = [
      'https://lazy-ledger-frontend.vercel.app',
      'http://localhost:3000',
      'http://127.0.0.1:3000'
    ];
    // Allow requests with no origin (curl, mobile apps, etc.)
    if (!origin) return cb(null, true);
    if (allowed.indexOf(origin) !== -1) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id']
};

app.use(cors(corsOptions));
// Handle preflight OPTIONS requests for any path without registering a problematic route
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    // run CORS middleware to set headers, then end the request with 204
    return cors(corsOptions)(req, res, () => res.sendStatus(204));
  }
  return next();
});

// JSON parsing for regular endpoints
app.use(express.json());

// DEBUG endpoint - small probe to validate connectivity to the Flask parser service
app.get('/debug/probe-flask', async (req, res) => {
  try {
    const payload = { raw_text: 'debug probe', date: new Date().toISOString().slice(0, 10) };
    const r = await postToFlaskWithRetry('/parse-text', payload);
    return res.status(200).json({ ok: true, status: r.status, data: r.data });
  } catch (err) {
    console.error('Probe error:', axiosErrorInfo(err));
    return res.status(502).json({ ok: false, error: axiosErrorInfo(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});

// Import routers sequentially and log progress to make startup failures easier to trace
(async () => {
  try {
    console.log('Importing ./api/records.js');
    const recordsMod = await import('./api/records.js');
    console.log('Imported records');
    console.log('Importing ./api/transactions.js');
    const transactionsMod = await import('./api/transactions.js');
    console.log('Imported transactions');
    console.log('Importing ./api/webhook.js');
    const webhookMod = await import('./api/webhook.js');
    console.log('Imported webhook');
    console.log('Importing ./api/health.js');
    const healthMod = await import('./api/health.js');
    console.log('Imported health');

    app.use('/api/raw-records', recordsMod.default);
    app.use('/api/transactions', transactionsMod.default);
    app.use('/api/health', healthMod.default);
    // webhook needs raw body parsing, mount with the raw middleware
    app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookMod.default);

    console.log('API routers mounted (sequential)');
  } catch (err) {
    console.error('Failed to import/mount API routers (sequential):', err);
  }
})();

