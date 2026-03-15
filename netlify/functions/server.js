/**
 * Netlify serverless function that wraps the Express app.
 * Handles all /api/* routes.
 * Injects parsed body via request transform (fixes serverless-http body parsing on Netlify).
 */
import serverless from 'serverless-http';
import app from '../../dist/app.js';

export const handler = serverless(app, {
  request(req, event) {
    const ct = (event.headers?.['content-type'] || event.headers?.['Content-Type'] || '').toLowerCase();
    if (event.body && ct.includes('application/json')) {
      try {
        const raw = event.isBase64Encoded
          ? Buffer.from(event.body, 'base64').toString('utf8')
          : event.body;
        req.body = JSON.parse(typeof raw === 'string' ? raw : '{}');
      } catch {
        req.body = {};
      }
    }
  },
});
