#!/usr/bin/env node
/**
 * SimilarWeb LangSmith Agent – CLI entry point
 *
 * Set LANGCHAIN_TRACING_V2=true and LANGCHAIN_API_KEY for LangSmith tracing.
 */

import 'dotenv/config';
import { createInterface } from 'readline';
import { invokeAgent } from './agent.js';

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function prompt(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log('SimilarWeb Onboarding Agent (LangSmith)\n');
  console.log('Type your question and press Enter. Type "exit" to quit.\n');

  while (true) {
    const userMessage = await prompt('You: ');
    if (!userMessage.trim()) continue;
    if (/^exit|quit|q$/i.test(userMessage.trim())) break;

    try {
      const response = await invokeAgent({
        user_message: userMessage.trim(),
        current_url: '',
        current_page_content: '',
        api_endpoints: '',
        section_page_summaries: '',
        nav_trail: '',
        knowledge_center_results: '',
      });

      console.log('\nAgent:', response);
      console.log();
    } catch (err) {
      console.error('Error:', err instanceof Error ? err.message : err);
      console.log();
    }
  }

  rl.close();
  process.exit(0);
}

main();
