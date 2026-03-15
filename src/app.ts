/**
 * Express app for SimilarWeb onboarding agent.
 * Exported for use in server.ts (local) and Netlify Functions (serverless).
 */
import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { invokeAgent } from './agent.js';
import { getKnowledgeBase } from './knowledge/loader.js';
import { getFallbackSuggestedPages } from './knowledge/goal-to-pages.js';

const _appDir = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(_appDir, '..', 'public')));

interface QuizState {
  primaryFocus: string;
  subFocuses: string[];
}

interface Session {
  quiz: QuizState;
  history: string[];
  userName: string;
  visitedPages: string[];
  turnCount: number;
  conversationHistory: Array<{ user: string; assistant: string }>;
}

const sessions = new Map<string, Session>();

/** Normalize suggestedPages to always be a string array of page IDs. */
function normalizeSuggestedPages(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((p) => (typeof p === 'object' && p && 'id' in p ? String((p as { id: string }).id) : String(p))).filter(Boolean);
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.pages)) return normalizeSuggestedPages(obj.pages);
    if (Array.isArray(obj.ids)) return normalizeSuggestedPages(obj.ids);
    const vals = Object.values(obj).flat();
    return Array.isArray(vals) ? normalizeSuggestedPages(vals) : [];
  }
  if (typeof raw === 'string') {
    return raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// -- Health check (no KB load - helps debug 502s) --
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// -- Debug endpoint (remove after fixing Netlify) --

app.get('/api/debug-paths', (_req, res) => {
  const cwd = process.cwd();
  const lambdaRoot = process.env.LAMBDA_TASK_ROOT || '(not set)';
  const paths: Record<string, string> = {
    cwd,
    LAMBDA_TASK_ROOT: lambdaRoot,
    distKnowledge: path.join(cwd, 'dist', 'knowledge'),
    knowledge: path.join(cwd, 'knowledge'),
    distKnowledgePages: path.join(cwd, 'dist', 'knowledge', 'pages'),
    knowledgePages: path.join(cwd, 'knowledge', 'pages'),
    categoriesYaml: path.join(cwd, 'dist', 'knowledge', 'categories.yaml'),
  };
  if (lambdaRoot !== '(not set)') {
    paths.distKnowledgeLambda = path.join(lambdaRoot, 'dist', 'knowledge', 'pages');
    paths.knowledgeLambda = path.join(lambdaRoot, 'knowledge', 'pages');
  }
  const exists: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(paths)) {
    if (k === 'LAMBDA_TASK_ROOT') continue;
    exists[k] = fs.existsSync(v);
  }
  res.json({ paths, exists });
});

// -- Health check (no KB load; use to verify function is reachable) --
app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

// -- Health check (lightweight, no KB load) --
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// -- Health check (lightweight, no KB load) --
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// -- Knowledge Base endpoints --

app.get('/api/pages', async (_req, res) => {
  try {
    const kb = await getKnowledgeBase();
    const pages = kb.getAllPages().map(p => ({
      id: p.id,
      name: p.name,
      path: p.path,
      category: p.category,
      featureLocation: p.featureLocation,
      pageType: p.pageType,
      description: p.description,
    }));
    const categories = kb.getAllCategories();
    res.json({ pages, categories });
  } catch (err) {
    console.error('Pages error:', err);
    res.status(500).json({ error: 'Failed to load pages' });
  }
});

/** Get quiz-aware suggested page IDs for intro/chips. Used when chat opens before any message is sent. */
app.get('/api/suggested-pages-for-quiz', (req, res) => {
  try {
    const primaryFocus = (req.query.primaryFocus as string) || '';
    const subFocusesRaw = (req.query.subFocuses as string) || '';
    const subFocuses = subFocusesRaw ? subFocusesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const quiz = { primaryFocus, subFocuses };
    const pageIds = getFallbackSuggestedPages(quiz, []);
    res.json({ pageIds });
  } catch (err) {
    console.error('Suggested pages for quiz error:', err);
    res.status(500).json({ error: 'Failed to get suggested pages' });
  }
});

app.get('/api/pages/:id', async (req, res) => {
  try {
    const kb = await getKnowledgeBase();
    const page = kb.getPage(req.params.id);
    if (!page) { res.status(404).json({ error: 'Page not found' }); return; }
    const related = kb.getRelatedPages(req.params.id);
    const categoryPages = kb.getPagesByCategory(page.category)
      .filter(p => p.id !== page.id)
      .map(p => ({ id: p.id, name: p.name, description: p.description }));
    res.json({ ...page, relatedPagesResolved: related.map(r => ({ id: r.page.id, name: r.page.name, reason: r.reason })), categoryPages });
  } catch (err) {
    console.error('Page detail error:', err);
    res.status(500).json({ error: 'Failed to load page' });
  }
});

// -- Chat endpoint (now context-aware) --

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, quiz, userName, currentPageId } = req.body as {
      message: string;
      sessionId: string;
      quiz?: QuizState;
      userName?: string;
      currentPageId?: string;
    };

    if (!message) { res.status(400).json({ error: 'message is required' }); return; }

    let session = sessions.get(sessionId);
    if (!session) {
      session = { quiz: quiz ?? { primaryFocus: '', subFocuses: [] }, history: [], userName: userName ?? '', visitedPages: [], turnCount: 0, conversationHistory: [] };
      sessions.set(sessionId, session);
    }
    if (quiz) session.quiz = quiz;
    if (userName) session.userName = userName;
    session.history.push(message);
    const currentTurn = session.turnCount;
    session.turnCount++;

    let currentUrl = '';
    let currentPageContent = '';
    let sectionPageSummaries = '';

    if (currentPageId) {
      const kb = await getKnowledgeBase();
      const page = kb.getPage(currentPageId);
      if (page) {
        if (!session.visitedPages.includes(currentPageId)) {
          session.visitedPages.push(currentPageId);
        }
        currentUrl = `https://pro.similarweb.com${page.path.replace('{domain}', 'example.com')}`;

        const sections = (page.sections || []).map(s => `- ${s.name}: ${s.description}`).join('\n');
        const metrics = (page.metrics || []).map(m => `- ${m.name}: ${m.description}`).join('\n');
        const filters = (page.filters || []).map(f => `- ${f.name} (${f.type})`).join('\n');
        currentPageContent = [
          `Page: ${page.name} (${page.pageType})`,
          `Location: ${page.featureLocation}`,
          `Description: ${page.description}`,
          sections ? `\nSections:\n${sections}` : '',
          metrics ? `\nMetrics:\n${metrics}` : '',
          filters ? `\nFilters:\n${filters}` : '',
          page.tips?.length ? `\nTips:\n${page.tips.map(t => `- ${t}`).join('\n')}` : '',
        ].filter(Boolean).join('\n');

        const categoryPages = kb.getPagesByCategory(page.category)
          .filter(p => p.id !== page.id)
          .map(p => `- ${p.name}: ${p.description}`)
          .join('\n');
        if (categoryPages) sectionPageSummaries = categoryPages;
      }
    }

    const nameContext = session.userName ? `\nUser's name: ${session.userName}` : '';
    const quizContext = session.quiz.primaryFocus
      ? `\nUser Quiz Results:\n- Primary Focus (L1): ${session.quiz.primaryFocus}\n- Sub-Focuses (L2): ${session.quiz.subFocuses.join(', ') || 'none'}`
      : '';
    const turnsContext = `\nconversationTurns: ${currentTurn}`;

    const navTrail = session.visitedPages.length > 0
      ? session.visitedPages.join(' \u2192 ')
      : '';

    const historyMessages = session.conversationHistory
      .slice(-6)
      .flatMap(p => [
        { role: 'user' as const, content: p.user },
        { role: 'assistant' as const, content: p.assistant },
      ]);

    const response = await invokeAgent(
      {
        user_message: message + nameContext + quizContext + turnsContext,
        current_url: currentUrl,
        current_page_content: currentPageContent,
        api_endpoints: '',
        section_page_summaries: sectionPageSummaries,
        nav_trail: navTrail,
        knowledge_center_results: '',
      },
      historyMessages,
    );

    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      parsed = { responseText: response, suggestedPages: [], quickActions: [], followUpQuestions: [] };
    }
    parsed.suggestedPages = normalizeSuggestedPages(parsed.suggestedPages);
    const intentCategory = parsed.intent?.category ?? 'unknown';
    const isNavigation = intentCategory === 'navigation' || intentCategory === 'recommendation' || intentCategory === 'greeting';
    // Only run fallback when user expects navigation suggestions; respect empty when agent omits on purpose
    if (isNavigation && parsed.suggestedPages.length === 0) {
      parsed.suggestedPages = getFallbackSuggestedPages(session.quiz, session.visitedPages);
    } else if (isNavigation && session.quiz?.primaryFocus && session.quiz.primaryFocus !== 'analyze-competitors-market') {
      const generic = new Set(['traffic-engagement', 'website-performance']);
      const onlyGeneric = parsed.suggestedPages.every((id: string) => generic.has(id));
      if (onlyGeneric) {
        parsed.suggestedPages = getFallbackSuggestedPages(session.quiz, session.visitedPages);
      }
    }

    const assistantContent =
      (parsed.responseText ?? '') +
      (parsed.suggestedPages?.length ? `\n[Suggested pages: ${parsed.suggestedPages.join(', ')}]` : '');
    session.conversationHistory.push({ user: message, assistant: assistantContent });
    session.conversationHistory = session.conversationHistory.slice(-6);

    // Strip internal [Suggested pages: ...] from response before sending to client
    parsed.responseText = (parsed.responseText ?? '').replace(/\n?\[Suggested pages:[^\]]*\]\s*/gi, '').trim();
    res.json(parsed);
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
});

export default app;
