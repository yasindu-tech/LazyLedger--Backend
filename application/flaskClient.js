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

export async function postToFlaskWithRetry(path, payload, { maxRetries = 2, baseDelay = 500 } = {}) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await flaskAxios.post(path, payload);
      return res;
    } catch (err) {
      const isNetwork = !!err.code && !err.response;
      const status = err.response?.status;
      console.error('Flask request error:', axiosErrorInfo(err));

      if (isNetwork || [429, 502, 503, 504].includes(status)) {
        if (attempt < maxRetries) {
          const wait = Math.pow(2, attempt) * baseDelay;
          console.info(`Retrying Flask request attempt=${attempt + 1} after ${wait}ms`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
      }
      throw err;
    }
  }
}
