/**
 * Copies knowledge YAML files into dist/knowledge so the loader can find them
 * via __dirname when running locally or on Netlify (bundled).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const src = path.join(root, 'knowledge');
const dest = path.join(root, 'dist', 'knowledge');

if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

// Copy pages directory
const pagesSrc = path.join(src, 'pages');
const pagesDest = path.join(dest, 'pages');
if (fs.existsSync(pagesSrc)) {
  if (!fs.existsSync(pagesDest)) fs.mkdirSync(pagesDest, { recursive: true });
  for (const f of fs.readdirSync(pagesSrc)) {
    fs.copyFileSync(path.join(pagesSrc, f), path.join(pagesDest, f));
  }
}

// Copy categories.yaml and goal-to-pages.yaml
for (const f of ['categories.yaml', 'goal-to-pages.yaml']) {
  const s = path.join(src, f);
  const d = path.join(dest, f);
  if (fs.existsSync(s)) fs.copyFileSync(s, d);
}

console.log('Copied knowledge files to dist/knowledge');
