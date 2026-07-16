// The server-side tool-use loop for Clancy. Calls the Anthropic messages API
// (tool-use variant) with the same raw-HTTP + fetchWithTimeout pattern the
// vision extractors use, executes any tool_use blocks against the injected
// executor, and loops up to maxIterations before forcing a final text reply.
// The executor and fetch are injected/mocked in tests — no network in unit
// tests.

import { AppError } from '../../../lib/AppError.js';
import { fetchWithTimeout } from '../../../lib/fetchWithTimeout.js';
import { logWarn } from '../../../lib/serverLogger.js';
import { AI_EXTRACTION_TIMEOUT_MS } from '../../testResults/certificateExtraction.js';
import { MAX_ACTIONS } from './prompt.js';
import type { ChatAction, ToolExecutor } from './tools.js';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatTurnResult {
  message: string;
  actions: ChatAction[];
}

interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicResponse {
  stop_reason?: string;
  content?: AnthropicBlock[];
}

// Loosely-typed message content: a plain string (client turns) or a list of
// Anthropic content blocks (assistant tool_use turns and user tool_result turns
// we build during the loop).
type ApiMessage = { role: 'user' | 'assistant'; content: unknown };

interface RunChatModelLoopParams {
  model: string;
  system: string;
  messages: ChatMessage[];
  tools: readonly unknown[];
  executeTool: ToolExecutor;
  maxIterations?: number;
}

async function callAnthropic(
  model: string,
  system: string,
  messages: ApiMessage[],
  tools: readonly unknown[],
  forceText: boolean,
): Promise<AnthropicResponse> {
  const response = await fetchWithTimeout(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system,
        tools,
        // On the final iteration we forbid further tool use so the model
        // must produce a text reply instead of looping forever.
        ...(forceText ? { tool_choice: { type: 'none' } } : {}),
        messages,
      }),
    },
    AI_EXTRACTION_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new AppError(502, 'The AI assistant could not be reached.', 'AI_REQUEST_FAILED');
  }
  return (await response.json()) as AnthropicResponse;
}

function joinText(content: AnthropicBlock[] | undefined): string {
  return (content ?? [])
    .filter((block) => block.type === 'text' && block.text)
    .map((block) => block.text)
    .join('')
    .trim();
}

/**
 * Drive the tool-use loop and return Clancy's final text plus any queued client
 * actions (capped at MAX_ACTIONS). At most `maxIterations` model calls; the
 * last one forbids tools so a reply is always produced.
 */
export async function runChatModelLoop(params: RunChatModelLoopParams): Promise<ChatTurnResult> {
  const { model, system, tools, executeTool } = params;
  const maxIterations = params.maxIterations ?? 5;
  const convo: ApiMessage[] = params.messages.map((m) => ({ role: m.role, content: m.content }));
  const actions: ChatAction[] = [];

  for (let i = 0; i < maxIterations; i++) {
    const isLast = i === maxIterations - 1;
    let response: AnthropicResponse;
    try {
      response = await callAnthropic(model, system, convo, tools, isLast);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logWarn('Clancy chat model call failed', error);
      throw new AppError(502, 'The AI assistant could not be reached.', 'AI_REQUEST_FAILED');
    }

    const toolUses = (response.content ?? []).filter((block) => block.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0 || isLast) {
      return { message: joinText(response.content), actions };
    }

    // Echo the assistant turn (raw blocks) then answer every tool_use in one
    // user turn — splitting them trains the model to stop parallelising.
    convo.push({ role: 'assistant', content: response.content });
    const toolResults: unknown[] = [];
    for (const toolUse of toolUses) {
      const { result, action } = await executeTool(toolUse.name ?? '', toolUse.input);
      if (action) {
        if (actions.length < MAX_ACTIONS) {
          actions.push(action);
        } else {
          logWarn(`Clancy dropped an action past the ${MAX_ACTIONS}-action cap`);
        }
      }
      toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: result });
    }
    convo.push({ role: 'user', content: toolResults });
  }

  // Unreachable: the isLast branch above always returns.
  return { message: '', actions };
}
