/**
 * Netlify serverless function that wraps the Express app.
 * Handles all /api/* routes.
 */
import serverless from 'serverless-http';
import app from '../../dist/app.js';

export const handler = serverless(app);
