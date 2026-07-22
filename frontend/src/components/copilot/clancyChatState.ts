import { useSyncExternalStore } from 'react';

import { apiFetch, ApiError } from '@/lib/api';

export type ClancyRole = 'user' | 'assistant';

export type ClancyAction =
  | { type: 'navigate'; to: string }
  | { type: 'open_stage'; stage: string; projectId: string };

export interface ClancyMessage {
  id: string;
  role: ClancyRole;
  content: string;
  ts: number;
  /** Present on assistant messages that failed; `retryOf` is the user text to resend. */
  error?: boolean;
  retryOf?: string;
  actions?: ClancyAction[];
}

interface ClancyState {
  open: boolean;
  messages: ClancyMessage[];
  inFlight: boolean;
  /** An unread Clancy reply arrived while the panel was closed. */
  unseen: boolean;
  /**
   * A prompt queued from a contextual "Ask Clancy" affordance. The widget
   * consumes it through its normal send path (so tool actions/navigation still
   * work) and clears it. Null when nothing is queued.
   */
  pendingPrompt: string | null;
  /**
   * Id of the newest assistant message whose navigate action has been
   * executed. Lives in the STORE, not a widget ref: the widget remounts on
   * layout changes while this module-level transcript survives, and a
   * ref-based guard resets on remount — replaying the last navigation every
   * time the user changes route (live bug: Dashboard clicks boomeranged back
   * to the lot register Clancy had navigated to).
   */
  handledNavMessageId: string | null;
}

/** Wire response shape — LOCKED contract with the copilot chat backend. */
interface ChatResponse {
  message: string;
  actions?: ClancyAction[];
}

// ponytail: one module-level store, not context — the widget is a singleton and
// the transcript is deliberately per-session (resets on reload).
let state: ClancyState = {
  open: false,
  messages: [],
  inFlight: false,
  unseen: false,
  pendingPrompt: null,
  handledNavMessageId: null,
};
const listeners = new Set<() => void>();

function setState(patch: Partial<ClancyState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useClancyStore(): ClancyState {
  return useSyncExternalStore(subscribe, () => state);
}

/** Test-only: read module state without a hook. */
export function getClancyStateForTest(): ClancyState {
  return state;
}

/** Test-only: reset module state between cases. */
export function resetClancyStore() {
  state = {
    open: false,
    messages: [],
    inFlight: false,
    unseen: false,
    pendingPrompt: null,
    handledNavMessageId: null,
  };
  listeners.forEach((l) => l());
}

/** Mark an assistant message's navigate action as executed (remount-proof). */
export function markNavHandled(messageId: string) {
  setState({ handledNavMessageId: messageId });
}

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `clancy-${Date.now()}-${idSeq}`;
}

export function openClancy() {
  setState({ open: true, unseen: false });
}

export function closeClancy() {
  setState({ open: false });
}

export function toggleClancy() {
  if (state.open) closeClancy();
  else openClancy();
}

/**
 * Queue a prompt from a contextual entry point and open the drawer. The widget
 * consumes `pendingPrompt` via its normal send path (which carries the URL's
 * projectId) and clears it, so a queued question executes exactly like one typed
 * in the composer.
 */
export function askClancy(question: string) {
  const text = question.trim();
  if (!text) return;
  setState({ pendingPrompt: text, open: true, unseen: false });
}

export function clearPendingPrompt() {
  if (state.pendingPrompt !== null) setState({ pendingPrompt: null });
}

const MAX_TRANSCRIPT = 20;

function trim(messages: ClancyMessage[]): ClancyMessage[] {
  return messages.length > MAX_TRANSCRIPT ? messages.slice(-MAX_TRANSCRIPT) : messages;
}

const RATE_LIMIT_COPY = 'Give me a second — a bit much on at once. Tap retry in a moment.';
const UNAVAILABLE_COPY = "I can't reach my brain right now. Give it another go in a minute.";

/**
 * Append the user's message, call the copilot backend, and append Clancy's reply
 * (or an error bubble with a retry affordance). Sends the last ≤20 turns with
 * the user message last, per the locked wire contract.
 */
export async function sendClancy(content: string, projectId?: string): Promise<void> {
  const text = content.trim();
  if (!text || state.inFlight) return;

  const userMessage: ClancyMessage = { id: nextId(), role: 'user', content: text, ts: Date.now() };
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

function appendAssistant(message: ClancyMessage) {
  setState({
    messages: trim([...state.messages, message]),
    inFlight: false,
    unseen: !state.open,
  });
}
