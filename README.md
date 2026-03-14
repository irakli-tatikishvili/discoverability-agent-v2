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
