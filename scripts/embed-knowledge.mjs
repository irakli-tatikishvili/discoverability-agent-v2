/**
 * Embeds knowledge YAML into a TS module at build time.
 * Ensures knowledge is bundled and works on Netlify without filesystem access.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const knowledgeDir = path.join(root, 'knowledge');
const pagesDir = path.join(knowledgeDir, 'pages');

const categoriesFile = path.join(knowledgeDir, 'categories.yaml');
const goalToPagesFile = path.join(knowledgeDir, 'goal-to-pages.yaml');

const categoriesData = yaml.parse(fs.readFileSync(categoriesFile, 'utf-8'));
const categories = categoriesData.categories || [];

const goalToPagesData = yaml.parse(fs.readFileSync(goalToPagesFile, 'utf-8'));
const goalToPages = goalToPagesData.primaryFocus || {};

const pageFiles = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
const pages = pageFiles.map((f) => {
  const content = fs.readFileSync(path.join(pagesDir, f), 'utf-8');
  return yaml.parse(content);
}).filter((p) => p && p.id);

const outPath = path.join(root, 'src', 'knowledge', 'embedded-data.ts');
const out = `/**
 * Auto-generated at build time. Do not edit.
 * Embeds knowledge so it works on Netlify without filesystem.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const EMBEDDED_PAGES = ${JSON.stringify(pages, null, 0)};
export const EMBEDDED_CATEGORIES = ${JSON.stringify(categories, null, 0)};
export const EMBEDDED_GOAL_TO_PAGES = ${JSON.stringify(goalToPages, null, 0)};
`;

fs.writeFileSync(outPath, out, 'utf-8');
console.log(`Embedded ${pages.length} pages, ${categories.length} categories to ${outPath}`);
