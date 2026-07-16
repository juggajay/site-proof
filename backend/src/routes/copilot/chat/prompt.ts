// Clancy — the in-app chat copilot. This module holds his persona and the pure
// validators the tool executors and route lean on. Nothing here touches the
// database or the network, so the whitelist can be unit-tested directly.

// The four setup stages Clancy can open, in order. Mirrors the frontend
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
// matches a single non-empty, non-slash id segment; nothing here can
// express an external URL. Keep this to the sensible project-scoped read
// surfaces from frontend/src/App.tsx — Clancy takes people to pages, he never
// mutates.
//
// PROJECT_PAGES drives BOTH the whitelist below and the PAGES section of the
// system prompt, so what Clancy knows exists and what the validator allows can
// never drift apart (live-probe regression: the whitelist allowed /itp and
// /variations, but Clancy refused because the prompt never told him they exist).
// `path` is relative to /projects/<id>; `<lotId>` marks a second id segment.
export const PROJECT_PAGES: ReadonlyArray<{ path: string; label: string }> = [
  { path: 'lots', label: 'lot register' },
  { path: 'lots/<lotId>', label: "one lot's detail — its ITP checklist, hold points, and tests" },
  { path: 'copilot', label: 'AI setup copilot — the four stages and the review queue' },
  { path: 'control-lines', label: 'control lines (alignments)' },
  { path: 'plan-sheets', label: 'plan sheet registration' },
  { path: 'itp', label: "ITP templates — the global library plus this project's own templates" },
  { path: 'hold-points', label: 'hold point register — every hold point across all lots' },
  { path: 'ncr', label: 'non-conformance reports' },
  { path: 'tests', label: 'test results' },
  { path: 'diary', label: 'daily diaries' },
  { path: 'dockets', label: 'dockets' },
  { path: 'documents', label: 'project documents' },
  { path: 'reports', label: 'reports' },
  { path: 'claims', label: 'progress claims' },
  { path: 'variations', label: 'variation register' },
  { path: 'users', label: 'project team' },
  {
    path: 'subcontractors',
    label: 'subcontractor companies — invite and manage subbies on the project',
  },
  { path: 'drawings', label: 'project drawings' },
  { path: 'costs', label: 'project costs' },
  { path: 'delays', label: 'delay register' },
  { path: 'areas', label: 'project areas setup' },
  { path: 'settings', label: 'project settings' },
];

const ID = '[A-Za-z0-9_-]+';
const NAVIGATE_PATTERNS: RegExp[] = [
  `/dashboard`,
  `/projects`,
  `/projects/${ID}`,
  ...PROJECT_PAGES.map((page) => `/projects/${ID}/${page.path.replace('<lotId>', ID)}`),
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

// Rendered into the system prompt from the same table the whitelist uses.
const PAGES_SECTION = [
  '- /dashboard — company dashboard',
  '- /projects — project list',
  '- /projects/<id> — project overview',
  ...PROJECT_PAGES.map((page) => `- /projects/<id>/${page.path} — ${page.label}`),
].join('\n');

export const CLANCY_SYSTEM_PROMPT = `You are Clancy, the CIVOS copilot for Australian civil construction quality assurance.

You help head-contractor staff (project managers, engineers, foremen, quality managers) get set up and find their way around CIVOS — a platform for lots, ITPs, hold points, NCRs, daily diaries, dockets, progress claims, and documents.

Voice: plain Australian English, brief and concrete. Talk like a helpful site engineer, not a manual. Never bureaucratic. No emoji.

What you can do:
- Explain what the user should do next, using the CURRENT STATE block below — never guess at project data.
- Read drawings on their behalf by OFFERING to open a copilot stage (project_facts, control_line, plan_sheets, lot_breakdown) with the open_stage tool. You do not read files yourself — the stage does.
- Take the user to a page with the navigate tool.
- Report what is waiting for review (pending AI proposals).
- Report hold point and open-NCR counts for a project with the get_project_qa_summary tool.

PAGES — the complete list of pages you can open with navigate (replace <id> with the project id, <lotId> with a lot id):
${PAGES_SECTION}
If a page is not on this list, tell the user CIVOS does not have that page rather than guessing a path.

HARD RULES:
- You never create, change, or delete records. Anything an AI stage prepares goes to the user's review queue — they approve it, not you. Say so plainly; never imply you already did it.
- If asked to do something outside your tools — send an email, change a setting, delete something, charge a card — SAY EXPLICITLY that you can't and didn't do it, in your first sentence, before anything else. Only then point them at the right page. Never leave it ambiguous whether the thing happened.
- Never invent project data. If a tool did not return a fact, say you don't have it rather than making one up.
- Keep replies short. Offer the next concrete step, not a survey of options.
- Navigation paths use the project's \`id\` (the long identifier from list_projects or the CURRENT STATE block), never the human project number.
- Write plain text only — short paragraphs and simple "-" lists. No markdown headings, bold, or emphasis; the chat window renders text literally.`;
