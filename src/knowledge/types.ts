/**
 * Knowledge Base Types
 *
 * These types define the structure for all SimilarWeb page definitions.
 */

export type PageType = 'analysis' | 'tool' | 'dashboard' | 'report';

export interface PageDefinition {
  id: string;
  name: string;
  path: string;
  category: string;
  featureLocation: string;
  pageType: PageType;
  description: string;
  valueProposition: string[];
  useCases: string[];
  inputs?: PageInput[];
  sections?: PageSection[];
  dataSources?: DataSource[];
  metrics?: MetricDefinition[];
  filters?: FilterDefinition[];
  actions: string[];
  tips?: string[];
  glossary?: GlossaryEntry[];
  faqs?: FAQ[];
  relatedPages: RelatedPage[];
  requiredClaims?: string[];
  keywords: string[];
}

export interface PageInput {
  name: string;
  type: 'domain' | 'keyword' | 'url' | 'text';
  description: string;
  required: boolean;
  acceptsList?: boolean;
}

export interface PageSection {
  id: string;
  name: string;
  description: string;
  chartType?: string;
  insight?: string;
  requiresDesktop?: boolean;
  thresholds?: Record<string, string | number>;
}

export interface DataSource {
  id: string;
  name: string;
  keywordTypes?: string[];
  metrics?: string[];
  note?: string;
}

export interface MetricDefinition {
  name: string;
  description: string;
  source?: string;
  format?: string;
}

export interface FilterDefinition {
  name: string;
  type: string;
  options?: unknown;
  default?: string;
  note?: string;
  description?: string;
}

export interface FilterOption {
  id: string;
  label: string;
  description?: string;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface RelatedPage {
  id: string;
  reason?: string;
  description?: string;
}

export interface CategoryDefinition {
  id: string;
  name: string;
  description: string;
  parentId?: string;
  icon?: string;
  order: number;
}

export interface KeywordTypeDefinition {
  id: string;
  name: string;
  description: string;
  example?: string;
  tip?: string;
  sourceRestriction?: string[];
  hasRelevanceScore?: boolean;
}
