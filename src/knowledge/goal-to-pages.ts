/**
 * Goal-to-Pages mapping for quiz-aware fallback suggestions.
 * Used when the LLM returns empty suggestedPages.
 * Uses embedded data when available (Netlify), else loads from YAML.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'yaml';
import { EMBEDDED_GOAL_TO_PAGES } from './embedded-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let cached: GoalToPagesConfig | null = null;

interface GoalToPagesConfig {
  primaryFocus: Record<
    string,
    {
      default: string[];
      subFocuses?: Record<string, string[]>;
    }
  >;
}

function resolveGoalToPagesPath(): string {
  const cwd = process.cwd();
  const lambdaRoot = process.env.LAMBDA_TASK_ROOT || cwd;
  const attempts = [
    path.join(lambdaRoot, 'dist', 'knowledge', 'goal-to-pages.yaml'),
    path.join(lambdaRoot, 'knowledge', 'goal-to-pages.yaml'),
    path.join(cwd, 'dist', 'knowledge', 'goal-to-pages.yaml'),
    path.join(cwd, 'knowledge', 'goal-to-pages.yaml'),
    path.join(__dirname, '..', '..', 'knowledge', 'goal-to-pages.yaml'),
    path.join(__dirname, 'goal-to-pages.yaml'),
  ];
  for (const p of attempts) {
    if (fs.existsSync(p)) return p;
  }
  return attempts[0];
}

function loadConfig(): GoalToPagesConfig {
  if (cached) return cached;
  if (EMBEDDED_GOAL_TO_PAGES && Object.keys(EMBEDDED_GOAL_TO_PAGES).length > 0) {
    cached = { primaryFocus: EMBEDDED_GOAL_TO_PAGES as GoalToPagesConfig['primaryFocus'] };
    return cached!;
  }
  const filePath = resolveGoalToPagesPath();
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    cached = yaml.parse(content) as GoalToPagesConfig;
    return cached!;
  } catch {
    cached = {
      primaryFocus: {
        'analyze-competitors-market': {
          default: ['traffic-engagement', 'website-performance', 'marketing-channels'],
        },
        'improve-seo-ppc': {
          default: ['search-overview', 'keyword-generator', 'backlinks-overview'],
        },
        'genai-visibility': {
          default: ['gen-ai-intelligence', 'search-overview', 'website-content'],
        },
      },
    };
    return cached;
  }
}

export interface QuizState {
  primaryFocus: string;
  subFocuses: string[];
}

/**
 * Get fallback suggested page IDs based on quiz goals, excluding already-visited pages.
 */
export function getFallbackSuggestedPages(quiz: QuizState, excludePageIds: string[]): string[] {
  const config = loadConfig();
  const primary = config.primaryFocus[quiz?.primaryFocus];
  if (!primary) {
    return ['traffic-engagement', 'website-performance'];
  }

  let candidates: string[] = [];
  if (quiz.subFocuses?.length && primary.subFocuses) {
    for (const sf of quiz.subFocuses) {
      const pages = primary.subFocuses[sf];
      if (pages) {
        candidates = [...candidates, ...pages];
        break;
      }
    }
  }
  if (candidates.length === 0) {
    candidates = primary.default;
  }

  const exclude = new Set(excludePageIds || []);
  const filtered = candidates.filter((id) => !exclude.has(id));
  if (filtered.length >= 2) return filtered.slice(0, 3);
  if (filtered.length === 1) return filtered;
  return candidates.slice(0, 2);
}
