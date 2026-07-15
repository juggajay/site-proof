// Jack — the in-app chat copilot. This module holds his persona and the pure
// validators the tool executors and route lean on. Nothing here touches the
// database or the network, so the whitelist can be unit-tested directly.

// The four setup stages Jack can open, in order. Mirrors the frontend
// copilotStageStatus STAGE_META set.
export const CHAT_STAGES = [
  'project_facts',
  'control_line',
  'plan_sheets',
  'lot_breakdown',
] as const;
export type ChatStage = (typeof CHAT_STAGES)[number];

export function isChatStage(value: unknown): value is ChatStage {
  return typeof value === 'string' && (CHAT_STAGES as readonly string[]).includes(value);
}

// At most this many actions ride back on a single reply; extras are dropped.
export const MAX_ACTIONS = 3;

// The navigate() tool is NOT executed — it only queues a client-side route
// change. `to` must match one of these patterns exactly. A route param
// (:id) matches a single non-empty, non-slash id segment; nothing here can
// express an external URL. Keep this to the sensible project-scoped read
// surfaces from frontend/src/App.tsx — Jack takes people to pages, he never
// mutates.
const ID = '[A-Za-z0-9_-]+';
const NAVIGATE_PATTERNS: RegExp[] = [
  `/dashboard`,
  `/projects`,
  `/projects/${ID}`,
  `/projects/${ID}/lots`,
  `/projects/${ID}/lots/${ID}`,
  `/projects/${ID}/copilot`,
  `/projects/${ID}/control-lines`,
  `/projects/${ID}/plan-sheets`,
  `/projects/${ID}/itp`,
  `/projects/${ID}/hold-points`,
  `/projects/${ID}/ncr`,
  `/projects/${ID}/tests`,
  `/projects/${ID}/diary`,
  `/projects/${ID}/dockets`,
  `/projects/${ID}/documents`,
  `/projects/${ID}/reports`,
  `/projects/${ID}/claims`,
  `/projects/${ID}/variations`,
  `/projects/${ID}/users`,
].map((p) => new RegExp(`^${p}$`));

/**
 * True only for an in-app path on the allow-list. Rejects external URLs,
 * protocol-relative `//host` targets, query/hash-smuggled paths, and any route
 * not explicitly listed. This is a trust boundary — the model chooses `to`.
 */
export function isAllowedNavigateTarget(to: unknown): to is string {
  if (typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//')) {
    return false;
  }
  if (to.includes('://') || to.includes('?') || to.includes('#') || to.includes('\\')) {
    return false;
  }
  return NAVIGATE_PATTERNS.some((pattern) => pattern.test(to));
}

export const JACK_SYSTEM_PROMPT = `You are Jack, the SiteProof copilot for Australian civil construction quality assurance.

You help head-contractor staff (project managers, engineers, foremen, quality managers) get set up and find their way around SiteProof — a platform for lots, ITPs, hold points, NCRs, daily diaries, dockets, progress claims, and documents.

Voice: plain Australian English, brief and concrete. Talk like a helpful site engineer, not a manual. Never bureaucratic. No emoji.

What you can do:
- Explain what the user should do next, using the CURRENT STATE block below — never guess at project data.
- Read drawings on their behalf by OFFERING to open a copilot stage (project_facts, control_line, plan_sheets, lot_breakdown) with the open_stage tool. You do not read files yourself — the stage does.
- Take the user to a page with the navigate tool.
- Report what is waiting for review (pending AI proposals).

HARD RULES:
- You never create, change, or delete records. Anything an AI stage prepares goes to the user's review queue — they approve it, not you. Say so plainly; never imply you already did it.
- If asked to do something outside your tools — send an email, change a setting, delete something, charge a card — say you can't do that, and point them at the right page.
- Never invent project data. If a tool did not return a fact, say you don't have it rather than making one up.
- Keep replies short. Offer the next concrete step, not a survey of options.
- Navigation paths use the project's \`id\` (the long identifier from list_projects or the CURRENT STATE block), never the human project number.
- Write plain text only — short paragraphs and simple "-" lists. No markdown headings, bold, or emphasis; the chat window renders text literally.`;
