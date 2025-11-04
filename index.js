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
app.options('*', cors(corsOptions));

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

// Dynamically import and mount API routers so DB connection issues won't
// prevent the debug endpoint from being reachable. Errors importing routers
// will be logged but won't crash the server.
(async () => {
  try {
    const [
      { default: recordsRouter },
      { default: transactionsRouter },
      { default: webhookRouter },
      { default: healthRouter }
    ] = await Promise.all([
      import('./api/records.js'),
      import('./api/transactions.js'),
      import('./api/webhook.js'),
      import('./api/health.js')
    ]);

    app.use('/api/raw-records', recordsRouter);
    app.use('/api/transactions', transactionsRouter);
    app.use('/api/health', healthRouter);
    // webhook needs raw body parsing, mount with the raw middleware
    app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRouter);

    console.log('API routers mounted');
  } catch (err) {
    console.error('Failed to import/mount API routers:', err);
  }
})();
import express from 'express';

import cors from 'cors';

import dotenv from 'dotenv';
