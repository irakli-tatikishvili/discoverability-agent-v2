/**
 * Knowledge Base Loader
 *
 * Loads page definitions from YAML files and provides indexed access.
 * Supports searching by keywords, use cases, and categories.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'yaml';
import { PageDefinition, CategoryDefinition, RelatedPage } from './types.js';

// =============================================================================
// Knowledge Base Class
// =============================================================================

export class KnowledgeBase {
  private pages: Map<string, PageDefinition> = new Map();
  private categories: Map<string, CategoryDefinition> = new Map();

  // Indexes for fast lookup
  private keywordIndex: Map<string, Set<string>> = new Map(); // keyword -> page IDs
  private categoryIndex: Map<string, Set<string>> = new Map(); // category -> page IDs
  private useCaseIndex: Map<string, string[]> = new Map(); // normalized use case -> page IDs

  constructor() {}

  /**
   * Load all page definitions from YAML files
   */
  async load(pagesDir: string, categoriesFile: string): Promise<void> {
    await this.loadCategories(categoriesFile);
    await this.loadPages(pagesDir);
    this.buildIndexes();
    console.log(`Knowledge base loaded: ${this.pages.size} pages, ${this.categories.size} categories`);
  }

  private async loadCategories(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = yaml.parse(content);
      for (const category of data.categories) {
        this.categories.set(category.id, category);
      }
    } catch (error) {
      console.error(`Error loading categories from ${filePath}:`, error);
    }
  }

  private async loadPages(dir: string): Promise<void> {
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
      for (const file of files) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const page = yaml.parse(content) as PageDefinition;
        if (page.id) {
          this.pages.set(page.id, page);
        }
      }
    } catch (error) {
      console.error(`Error loading pages from ${dir}:`, error);
    }
  }

  private buildIndexes(): void {
    for (const [pageId, page] of this.pages) {
      for (const keyword of page.keywords || []) {
        const normalized = this.normalizeText(keyword);
        if (!this.keywordIndex.has(normalized)) this.keywordIndex.set(normalized, new Set());
        this.keywordIndex.get(normalized)!.add(pageId);
      }
      const categoryId = page.category;
      if (!this.categoryIndex.has(categoryId)) this.categoryIndex.set(categoryId, new Set());
      this.categoryIndex.get(categoryId)!.add(pageId);
      for (const useCase of page.useCases || []) {
        const normalized = this.normalizeText(useCase);
        if (!this.useCaseIndex.has(normalized)) this.useCaseIndex.set(normalized, []);
        this.useCaseIndex.get(normalized)!.push(pageId);
      }
    }
  }

  private normalizeText(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  }

  getPage(id: string): PageDefinition | undefined {
    return this.pages.get(id);
  }

  getAllPages(): PageDefinition[] {
    return Array.from(this.pages.values());
  }

  getPagesByCategory(categoryId: string): PageDefinition[] {
    const pageIds = this.categoryIndex.get(categoryId);
    if (!pageIds) return [];
    return Array.from(pageIds).map(id => this.pages.get(id)!).filter(Boolean);
  }

  getCategory(id: string): CategoryDefinition | undefined {
    return this.categories.get(id);
  }

  getAllCategories(): CategoryDefinition[] {
    return Array.from(this.categories.values());
  }

  searchByKeyword(keyword: string): PageDefinition[] {
    const normalized = this.normalizeText(keyword);
    const results = new Set<string>();
    const exactMatch = this.keywordIndex.get(normalized);
    if (exactMatch) exactMatch.forEach(id => results.add(id));
    for (const [indexedKeyword, pageIds] of this.keywordIndex) {
      if (indexedKeyword.includes(normalized) || normalized.includes(indexedKeyword)) {
        pageIds.forEach(id => results.add(id));
      }
    }
    return Array.from(results).map(id => this.pages.get(id)!).filter(Boolean);
  }

  searchByUseCase(query: string): Array<{ page: PageDefinition; score: number }> {
    const normalizedQuery = this.normalizeText(query);
    const queryWords = normalizedQuery.split(/\s+/).filter(w => w.length > 2);
    const scores = new Map<string, number>();

    for (const [pageId, page] of this.pages) {
      let score = 0;
      for (const useCase of page.useCases || []) {
        const normalizedUseCase = this.normalizeText(useCase);
        const useCaseWords = normalizedUseCase.split(/\s+/);
        for (const word of queryWords) {
          if (useCaseWords.some(uw => uw.includes(word) || word.includes(uw))) score += 1;
        }
        if (normalizedUseCase.includes(normalizedQuery)) score += 5;
      }
      for (const value of page.valueProposition || []) {
        const normalizedValue = this.normalizeText(value);
        for (const word of queryWords) {
          if (normalizedValue.includes(word)) score += 0.5;
        }
      }
      for (const keyword of page.keywords || []) {
        const normalizedKeyword = this.normalizeText(keyword);
        for (const word of queryWords) {
          if (normalizedKeyword.includes(word) || word.includes(normalizedKeyword)) score += 0.5;
        }
      }
      if (score > 0) scores.set(pageId, score);
    }

    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => ({ page: this.pages.get(id)!, score }))
      .filter(r => r.page);
  }

  findPageByPath(urlPath: string): PageDefinition | undefined {
    for (const page of this.pages.values()) {
      const pattern = page.path.replace(/\{[^}]+\}/g, '[^/]+').replace(/\//g, '\\/');
      if (new RegExp(`^${pattern}$`).test(urlPath)) return page;
    }
    return undefined;
  }

  getRelatedPages(pageId: string): Array<{ page: PageDefinition; reason: string }> {
    const page = this.pages.get(pageId);
    if (!page || !page.relatedPages) return [];

    return page.relatedPages
      .map((rel: RelatedPage) => {
        const relatedPage = this.pages.get(rel.id);
        if (!relatedPage) return null;
        const reason = rel.reason ?? rel.description ?? '';
        return { page: relatedPage, reason };
      })
      .filter((r: { page: PageDefinition; reason: string } | null): r is { page: PageDefinition; reason: string } => r !== null);
  }

  getAccessiblePages(claims: string[]): PageDefinition[] {
    return Array.from(this.pages.values()).filter(p =>
      (p.requiredClaims ?? []).every((claim: string) => claims.includes(claim))
    );
  }

  findTermDefinition(term: string): { term: string; definition: string; pageId: string } | undefined {
    const normalizedTerm = this.normalizeText(term);
    for (const [pageId, page] of this.pages) {
      for (const entry of page.glossary || []) {
        if (this.normalizeText(entry.term) === normalizedTerm) return { ...entry, pageId };
      }
    }
    return undefined;
  }

  getAllGlossaryTerms(): Array<{ term: string; definition: string; pageId: string }> {
    const terms: Array<{ term: string; definition: string; pageId: string }> = [];
    for (const [pageId, page] of this.pages) {
      for (const entry of page.glossary || []) terms.push({ ...entry, pageId });
    }
    return terms;
  }

  searchFAQs(query: string): Array<{ question: string; answer: string; pageId: string }> {
    const normalizedQuery = this.normalizeText(query);
    const results: Array<{ question: string; answer: string; pageId: string; score: number }> = [];
    for (const [pageId, page] of this.pages) {
      for (const faq of page.faqs || []) {
        const normalizedQuestion = this.normalizeText(faq.question);
        const queryWords = normalizedQuery.split(/\s+/);
        const questionWords = normalizedQuestion.split(/\s+/);
        const overlap = queryWords.filter(w => questionWords.includes(w)).length;
        if (overlap > 0) results.push({ ...faq, pageId, score: overlap });
      }
    }
    return results.sort((a, b) => b.score - a.score).map(({ question, answer, pageId }) => ({ question, answer, pageId }));
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let instance: KnowledgeBase | null = null;

/** Resolve knowledge paths. Tries multiple locations for Netlify (bundled) vs local. */
function resolveKnowledgePaths(): { pagesDir: string; categoriesFile: string } {
  const cwd = process.cwd();
  const attempts: Array<{ pagesDir: string; categoriesFile: string }> = [];
  try {
    const dirname = path.dirname(fileURLToPath(import.meta.url));
    attempts.push(
      { pagesDir: path.join(dirname, 'pages'), categoriesFile: path.join(dirname, 'categories.yaml') },
    );
    attempts.push(
      { pagesDir: path.join(cwd, 'knowledge', 'pages'), categoriesFile: path.join(cwd, 'knowledge', 'categories.yaml') },
    );
    const projectRoot = path.join(dirname, '..', '..');
    attempts.push(
      { pagesDir: path.join(projectRoot, 'knowledge', 'pages'), categoriesFile: path.join(projectRoot, 'knowledge', 'categories.yaml') },
    );
    attempts.push(
      { pagesDir: path.join(dirname, '..', 'knowledge', 'pages'), categoriesFile: path.join(dirname, '..', 'knowledge', 'categories.yaml') },
    );
    attempts.push(
      { pagesDir: path.join(dirname, 'pages'), categoriesFile: path.join(dirname, 'categories.yaml') },
    );
  } catch {
    // ignore
  }
  for (const { pagesDir, categoriesFile } of attempts) {
    try {
      if (fs.existsSync(pagesDir) && fs.existsSync(categoriesFile)) return { pagesDir, categoriesFile };
    } catch {
      // continue
    }
  }
  return attempts[0];
}

export async function getKnowledgeBase(): Promise<KnowledgeBase> {
  if (!instance) {
    instance = new KnowledgeBase();
    const { pagesDir, categoriesFile } = resolveKnowledgePaths();
    await instance.load(pagesDir, categoriesFile);
  }
  return instance;
}

export function resetKnowledgeBase(): void {
  instance = null;
}
