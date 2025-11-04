import axios from 'axios';
import https from 'https';

// axios instance for Flask parser
export const flaskAxios = axios.create({
  baseURL: 'https://lazyledger-parser.onrender.com',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: true }),
  maxContentLength: 50 * 1024 * 1024,
  maxBodyLength: 50 * 1024 * 1024
});

export function axiosErrorInfo(err) {
  return {
    message: err.message,
    code: err.code,
    errno: err.errno,
    syscall: err.syscall,
    config: err.config && {
      url: err.config.url,
      method: err.config.method,
      baseURL: err.config.baseURL,
      timeout: err.config.timeout,
      headers: err.config.headers
    },
    responseStatus: err.response?.status,
    responseData: err.response?.data,
    request: (() => {
      try {
        if (!err.request) return undefined;
        if (err.request.getHeaders) return { headers: err.request.getHeaders() };
        return { _raw: String(err.request).slice(0, 200) };
      } catch (e) { return { error: 'failed to serialize request' }; }
    })()
  };
}

export async function postToFlaskWithRetry(path, payload, { maxRetries = 4, baseDelay = 500, headers = {}, timeout } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await flaskAxios.post(path, payload, { headers, timeout });
      return res;
    } catch (err) {
      // consider connection resets explicitly retryable
      let isNetwork = !!err.code && !err.response;
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') isNetwork = true;
      const status = err.response?.status;

      // helpful debug: log proxy envs (if present) on first failure
      if (attempt === 0) {
        console.info('Outbound proxy envs:', {
          HTTP_PROXY: process.env.HTTP_PROXY || process.env.http_proxy,
          HTTPS_PROXY: process.env.HTTPS_PROXY || process.env.https_proxy,
          NO_PROXY: process.env.NO_PROXY || process.env.no_proxy
        });
      }

      console.error('Flask request error (attempt=' + attempt + '):', axiosErrorInfo(err));

      // retry on network errors or common gateway throttles
      if (isNetwork || [429, 502, 503, 504].includes(status)) {
        if (attempt < maxRetries) {
          // exponential backoff with small jitter
          const base = Math.pow(2, attempt) * baseDelay;
          const jitter = Math.floor(base * (0.4 + Math.random() * 0.8));
          const wait = Math.max(100, Math.floor(base + jitter));
          console.info(`Retrying Flask request attempt=${attempt + 1} after ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
      }
      throw err;
    }
  }
}
