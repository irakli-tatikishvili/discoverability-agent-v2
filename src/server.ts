/**
 * Local development server. Imports the Express app and starts listening.
 */
import app from './app.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
app.listen(PORT, () => {
  console.log(`SimilarWeb Onboarding Agent running at http://localhost:${PORT}`);
});
