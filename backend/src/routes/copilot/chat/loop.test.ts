import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_EXTRACTION_TIMEOUT_MS } from '../../testResults/certificateExtraction.js';
import { runChatModelLoop, type ChatMessage } from './loop.js';
import type { ToolOutcome } from './tools.js';

vi.mock('../../../lib/fetchWithTimeout.js', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from '../../../lib/fetchWithTimeout.js';

function anthropicResponse(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response;
}

const messages: ChatMessage[] = [{ role: 'user', content: 'hi jack' }];
const noopExecutor = async (): Promise<ToolOutcome> => ({ result: 'ok' });

function lastRequestBody(): Record<string, unknown> {
  const calls = vi.mocked(fetchWithTimeout).mock.calls;
  const init = calls[calls.length - 1][1] as RequestInit;
  return JSON.parse(init.body as string);
}

function requestBodyAt(index: number): Record<string, unknown> {
  const init = vi.mocked(fetchWithTimeout).mock.calls[index][1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe('runChatModelLoop', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-key';
    vi.mocked(fetchWithTimeout).mockReset();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('returns a text-only reply without any tool calls', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      anthropicResponse({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'G’day — what do you need?' }],
      }),
    );

    const result = await runChatModelLoop({
      model: 'claude-test',
      system: 'sys',
      messages,
      tools: [],
      executeTool: noopExecutor,
    });

    expect(result).toEqual({ message: 'G’day — what do you need?', actions: [] });
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    const [url, , timeout] = vi.mocked(fetchWithTimeout).mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(timeout).toBe(AI_EXTRACTION_TIMEOUT_MS);
  });

  it('executes a tool round-trip and feeds the result back', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(
        anthropicResponse({
          stop_reason: 'tool_use',
          content: [
            { type: 'text', text: 'checking' },
            { type: 'tool_use', id: 't1', name: 'list_projects', input: {} },
          ],
        }),
      )
      .mockResolvedValueOnce(
        anthropicResponse({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'You have 2 projects.' }],
        }),
      );

    const executeTool = vi.fn(async () => ({ result: '{"projects":[]}' }));
    const result = await runChatModelLoop({
      model: 'claude-test',
      system: 'sys',
      messages,
      tools: [],
      executeTool,
    });

    expect(result.message).toBe('You have 2 projects.');
    expect(result.actions).toEqual([]);
    expect(executeTool).toHaveBeenCalledWith('list_projects', {});
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);

    // Second request must carry the assistant turn + the tool_result.
    const secondBody = requestBodyAt(1);
    const convo = secondBody.messages as Array<{ role: string; content: unknown }>;
    const toolResultTurn = convo[convo.length - 1];
    expect(toolResultTurn.role).toBe('user');
    expect(toolResultTurn.content).toEqual([
      { type: 'tool_result', tool_use_id: 't1', content: '{"projects":[]}' },
    ]);
  });

  it('queues a navigate action and drops the tool text into actions', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(
        anthropicResponse({
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 'n1', name: 'navigate', input: { to: '/dashboard' } }],
        }),
      )
      .mockResolvedValueOnce(
        anthropicResponse({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Taking you to the dashboard.' }],
        }),
      );

    const executeTool = vi.fn(async () => ({
      result: 'Navigation queued.',
      action: { type: 'navigate' as const, to: '/dashboard' },
    }));
    const result = await runChatModelLoop({
      model: 'claude-test',
      system: 'sys',
      messages,
      tools: [],
      executeTool,
    });

    expect(result.actions).toEqual([{ type: 'navigate', to: '/dashboard' }]);
    expect(result.message).toBe('Taking you to the dashboard.');
  });

  it('caps queued actions at three and drops the rest', async () => {
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(
        anthropicResponse({
          stop_reason: 'tool_use',
          content: [
            { type: 'tool_use', id: 'a', name: 'navigate', input: {} },
            { type: 'tool_use', id: 'b', name: 'navigate', input: {} },
            { type: 'tool_use', id: 'c', name: 'navigate', input: {} },
            { type: 'tool_use', id: 'd', name: 'navigate', input: {} },
          ],
        }),
      )
      .mockResolvedValueOnce(
        anthropicResponse({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'done' }] }),
      );

    const executeTool = vi.fn(async () => ({
      result: 'Navigation queued.',
      action: { type: 'navigate' as const, to: '/dashboard' },
    }));
    const result = await runChatModelLoop({
      model: 'claude-test',
      system: 'sys',
      messages,
      tools: [],
      executeTool,
    });

    expect(result.actions).toHaveLength(3);
  });

  it('forces a text reply once it hits the iteration cap', async () => {
    // Model never stops asking for tools; the loop must still terminate.
    vi.mocked(fetchWithTimeout).mockResolvedValue(
      anthropicResponse({
        stop_reason: 'tool_use',
        content: [
          { type: 'text', text: 'final' },
          { type: 'tool_use', id: 'x', name: 'list_projects', input: {} },
        ],
      }),
    );

    const executeTool = vi.fn(async () => ({ result: 'ok' }));
    const result = await runChatModelLoop({
      model: 'claude-test',
      system: 'sys',
      messages,
      tools: [],
      executeTool,
      maxIterations: 5,
    });

    expect(result.message).toBe('final');
    expect(fetchWithTimeout).toHaveBeenCalledTimes(5);
    // Last call forbids further tool use.
    expect(lastRequestBody().tool_choice).toEqual({ type: 'none' });
    // Only the four non-final iterations execute tools.
    expect(executeTool).toHaveBeenCalledTimes(4);
  });

  it('maps a non-ok Anthropic response to a 502 AI_REQUEST_FAILED', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as unknown as Response);

    await expect(
      runChatModelLoop({
        model: 'claude-test',
        system: 'sys',
        messages,
        tools: [],
        executeTool: noopExecutor,
      }),
    ).rejects.toMatchObject({ statusCode: 502, code: 'AI_REQUEST_FAILED' });
  });
});
