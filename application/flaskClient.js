import axios from 'axios';
import https from 'https';

// configured axios instance for Flask service
export const flaskAxios = axios.create({
  baseURL: 'https://lazyledger-parser.onrender.com',
  timeout: 30000, // 30s
  headers: { 'Content-Type': 'application/json' },
  httpsAgent: new https.Agent({ keepAlive: true, rejectUnauthorized: true }),
  maxContentLength: 50 * 1024 * 1024,
  maxBodyLength: 50 * 1024 * 1024
});

// helper to format axios errors
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
    requestHeaders: err.request?.getHeaders ? err.request.getHeaders() : err.request?.headers
  };
}

// simple retry with exponential backoff for network/transient errors
export async function postToFlaskWithRetry(path, payload, { maxRetries = 2, baseDelay = 500 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await flaskAxios.post(path, payload);
      return res;
    } catch (err) {
      const isNetwork = !!err.code && !err.response;
      const status = err.response?.status;
      console.error('Flask request error:', axiosErrorInfo(err));

      // retry on network errors or 429/502/503/504 gateway issues
      if (isNetwork || [429, 502, 503, 504].includes(status)) {
        if (attempt < maxRetries) {
          const wait = Math.pow(2, attempt) * baseDelay;
          console.info(`Retrying Flask request attempt=${attempt + 1} after ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
      }
      // otherwise rethrow so caller can handle/fail
      throw err;
    }
  }
}
