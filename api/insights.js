import express from 'express';
import { flaskAxios, axiosErrorInfo } from '../application/flaskClient.js';

const insightsRouter = express.Router();

// Proxy latest insights for a user to avoid cross-origin issues in the browser.
insightsRouter.get('/user/:id/latest', async (req, res) => {
  const { id } = req.params;
  try {
    const r = await flaskAxios.get(`/insights/${encodeURIComponent(id)}/latest`, { timeout: 15000 });
    return res.status(r.status).json(r.data);
  } catch (err) {
    console.error('Error proxying /insights:', axiosErrorInfo(err));
    if (err.response) {
      return res.status(err.response.status).json({ error: 'Upstream error', details: err.response.data });
    }
    return res.status(502).json({ error: 'Upstream fetch failed', details: err.message });
  }
});

export default insightsRouter;
