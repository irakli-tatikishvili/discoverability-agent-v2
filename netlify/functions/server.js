/**
 * Netlify serverless function that wraps the Express app.
 * Handles all /api/* routes.
 * Parses body in wrapper + request transform (fixes serverless-http body parsing on Netlify).
 */
import serverless from 'serverless-http';
import app from '../../dist/app.js';

const sls = serverless(app, {
  request(req, event) {
    req._netlifyEvent = event;
    if (event._parsedBody && typeof event._parsedBody === 'object') {
      req.body = event._parsedBody;
    }
  },
});

export const handler = async (event, context) => {
  // Parse body BEFORE serverless-http (in case transform doesn't run or body is lost)
  if (event.body != null) {
    console.log('[chat] event.body length:', typeof event.body === 'string' ? event.body.length : 'not-string', 'method:', event.httpMethod);
  } else {
    console.log('[chat] event.body is null/undefined, method:', event.httpMethod);
  }
  if (event.body != null) {
    try {
      let str = event.body;
      if (typeof str !== 'string') str = JSON.stringify(str || '{}');
      else if (event.isBase64Encoded) str = Buffer.from(str, 'base64').toString('utf8');
      event._parsedBody = JSON.parse(str || '{}');
    } catch {
      event._parsedBody = {};
    }
  }
  return sls(event, context);
};
