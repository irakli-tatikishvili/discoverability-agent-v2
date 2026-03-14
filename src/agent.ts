/**
 * SimilarWeb onboarding agent with LangSmith tracing.
 * Uses native OpenAI SDK + LangSmith wrapOpenAI for tracing.
 */

import OpenAI from 'openai';
import { wrapOpenAI } from 'langsmith/wrappers/openai';
import { SYSTEM_PROMPT, buildUserPrompt, type UserContext } from './prompts.js';

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required. Set it in .env');
  }
  const client = new OpenAI({ apiKey });
  // Wrap for LangSmith tracing when LANGCHAIN_TRACING_V2=true
  return wrapOpenAI(client, {
    name: 'similarweb-agent',
    project_name: process.env.LANGCHAIN_PROJECT ?? 'similarweb-agent',
  });
}

type MessagePair = { role: 'user' | 'assistant'; content: string };

/**
 * Invoke the agent with a user message and context.
 * Accepts optional conversationHistory for multi-turn dialogue.
 * Returns the raw model response (expected to be JSON).
 */
export async function invokeAgent(
  ctx: Partial<UserContext> & { user_message: string },
  conversationHistory?: MessagePair[],
): Promise<string> {
  const client = getClient();
  const userPrompt = buildUserPrompt(ctx);

  const historyMessages: MessagePair[] = (conversationHistory ?? []).slice(-12);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...historyMessages,
    { role: 'user', content: userPrompt },
  ];

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.3,
    messages,
  });

  const content = completion.choices[0]?.message?.content ?? '';
  return content.trim();
}
