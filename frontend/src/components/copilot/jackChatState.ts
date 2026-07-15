import { useSyncExternalStore } from 'react';

import { apiFetch, ApiError } from '@/lib/api';

export type JackRole = 'user' | 'assistant';

export type JackAction =
  | { type: 'navigate'; to: string }
  | { type: 'open_stage'; stage: string; projectId: string };

export interface JackMessage {
  id: string;
  role: JackRole;
  content: string;
  ts: number;
  /** Present on assistant messages that failed; `retryOf` is the user text to resend. */
  error?: boolean;
  retryOf?: string;
  actions?: JackAction[];
}

interface JackState {
  open: boolean;
  messages: JackMessage[];
  inFlight: boolean;
  /** An unread Jack reply arrived while the panel was closed. */
  unseen: boolean;
}

/** Wire response shape — LOCKED contract with the copilot chat backend. */
interface ChatResponse {
  message: string;
  actions?: JackAction[];
}

// ponytail: one module-level store, not context — the widget is a singleton and
// the transcript is deliberately per-session (resets on reload).
let state: JackState = { open: false, messages: [], inFlight: false, unseen: false };
const listeners = new Set<() => void>();

function setState(patch: Partial<JackState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useJackStore(): JackState {
  return useSyncExternalStore(subscribe, () => state);
}

/** Test-only: reset module state between cases. */
export function resetJackStore() {
  state = { open: false, messages: [], inFlight: false, unseen: false };
  listeners.forEach((l) => l());
}

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `jack-${Date.now()}-${idSeq}`;
}

export function openJack() {
  setState({ open: true, unseen: false });
}

export function closeJack() {
  setState({ open: false });
}

export function toggleJack() {
  if (state.open) closeJack();
  else openJack();
}

const MAX_TRANSCRIPT = 20;

function trim(messages: JackMessage[]): JackMessage[] {
  return messages.length > MAX_TRANSCRIPT ? messages.slice(-MAX_TRANSCRIPT) : messages;
}

const RATE_LIMIT_COPY = 'Give me a second — a bit much on at once. Tap retry in a moment.';
const UNAVAILABLE_COPY = "I can't reach my brain right now. Give it another go in a minute.";

/**
 * Append the user's message, call the copilot backend, and append Jack's reply
 * (or an error bubble with a retry affordance). Sends the last ≤20 turns with
 * the user message last, per the locked wire contract.
 */
export async function sendJack(content: string, projectId?: string): Promise<void> {
  const text = content.trim();
  if (!text || state.inFlight) return;

  const userMessage: JackMessage = { id: nextId(), role: 'user', content: text, ts: Date.now() };
  // Drop any prior error bubble — the retry supersedes it.
  const base = state.messages.filter((m) => !m.error);
  const messages = trim([...base, userMessage]);
  setState({ messages, inFlight: true, open: true, unseen: false });

  const payload = {
    ...(projectId ? { projectId } : {}),
    messages: messages
      .filter((m) => !m.error)
      .slice(-MAX_TRANSCRIPT)
      .map((m) => ({ role: m.role, content: m.content })),
  };

  try {
    const res = await apiFetch<ChatResponse>('/api/copilot/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    appendAssistant({
      id: nextId(),
      role: 'assistant',
      content: res.message,
      ts: Date.now(),
      actions: res.actions,
    });
  } catch (err) {
    const rateLimited = err instanceof ApiError && err.status === 429;
    appendAssistant({
      id: nextId(),
      role: 'assistant',
      content: rateLimited ? RATE_LIMIT_COPY : UNAVAILABLE_COPY,
      ts: Date.now(),
      error: true,
      retryOf: text,
    });
  }
}

function appendAssistant(message: JackMessage) {
  setState({
    messages: trim([...state.messages, message]),
    inFlight: false,
    unseen: !state.open,
  });
}
