/**
 * Goal-to-Pages mapping for quiz-aware fallback suggestions.
 * Used when the LLM returns empty suggestedPages.
 * Data-driven: edit knowledge/goal-to-pages.yaml to change mappings.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'yaml';

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

function loadConfig(): GoalToPagesConfig {
  if (cached) return cached;
  // Use __dirname so it works from src/ (tsx) and dist/ (node)
  const filePath = path.join(__dirname, '..', '..', 'knowledge', 'goal-to-pages.yaml');
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
