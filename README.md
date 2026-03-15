# SimilarWeb LangSmith Agent

Standalone SimilarWeb onboarding agent using **LangChain** and **LangSmith**. Independent of the main Onboarding agent codebase.

## Setup

1. Clone or copy this project to your machine.
2. Create a `.env` file (copy from `.env.example`):

   ```bash
   cp .env.example .env
   ```

3. Add your keys to `.env`:
   - `OPENAI_API_KEY` – required for the LLM
   - `LANGCHAIN_API_KEY` – optional, for LangSmith tracing

4. Install dependencies:

   ```bash
   npm install
   ```

## Usage

### Interactive chat (CLI)

```bash
npm run chat
```

Then type your question (e.g. "Where can I see which websites send traffic to me?") and press Enter. Type `exit` to quit.

### Build and run

```bash
npm run build
npm start
```

### Development (watch mode)

```bash
npm run dev
```

## Deploy to Railway (recommended – simple, works)

Railway runs your app as a normal Node server – no serverless workarounds.

1. Go to [railway.app](https://railway.app) and sign in (e.g. with GitHub).
2. **New Project** → **Deploy from GitHub repo** → select `discoverability-agent-v2`.
3. Railway will auto-detect Node and use `npm run build` + `npm start`.
4. Add environment variables (Project → Variables):
   - `OPENAI_API_KEY` (required)
   - Optional: `LANGCHAIN_TRACING_V2`, `LANGCHAIN_API_KEY`, `LANGCHAIN_PROJECT`
5. Click **Deploy**. When it finishes, open the generated URL.

Your app will be live at e.g. `https://your-app.up.railway.app`.

---

## Netlify deployment (alternative)

The app is configured for Netlify with:

- **Static assets** from `public/`
- **API routes** (`/api/*`) handled by a serverless function

### Deploy from Git

1. Connect your GitHub repo to Netlify.
2. Build settings (via `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
3. Add environment variables in Netlify: **Site settings → Environment variables**
   - `OPENAI_API_KEY` (required for chat)

### Local preview

```bash
npm install -g netlify-cli
netlify dev
```


## LangSmith tracing

To trace runs in [LangSmith](https://smith.langchain.com/):

1. Set `LANGCHAIN_TRACING_V2=true` in `.env`
2. Set `LANGCHAIN_API_KEY` to your LangSmith API key
3. Optionally set `LANGCHAIN_PROJECT=similarweb-agent` to group runs

## Project structure

```
similarweb-langsmith-agent/
├── .env.example       # Env template (OPENAI_API_KEY, LANGCHAIN_API_KEY)
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts       # CLI entry point
│   ├── prompts.ts     # System prompt + user template
│   └── agent.ts       # LangChain chain
└── README.md
```

## Deploy to Netlify

1. Push your code to GitHub (the repo is already connected).
2. In [Netlify](https://app.netlify.com), click **Add new site** → **Import an existing project**.
3. Connect your GitHub repo `irakli-tatikishvili/discoverability-agent-v2`.
4. Netlify will use the existing `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `public`
   - **Functions:** `netlify/functions`
5. Set environment variables in Netlify (Site settings → Environment variables):
   - `OPENAI_API_KEY` (required)
   - Optional: `LANGCHAIN_TRACING_V2`, `LANGCHAIN_PROJECT`, `LANGCHAIN_API_KEY`
6. Deploy. The app will be live at your Netlify URL.

## Integration

To use the agent programmatically:

```ts
import { invokeAgent } from './agent.js';

const response = await invokeAgent({
  user_message: "Where can I find incoming traffic?",
  current_url: "https://app.similarweb.com/...",
  current_page_content: "...",
  api_endpoints: "...",
  section_page_summaries: "...",
  nav_trail: "website-performance,marketing-channels",
  knowledge_center_results: "...",
});

// response is JSON per the system prompt format
```
