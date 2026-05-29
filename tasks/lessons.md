# Lessons

## Production-adjacent Claude prompts

- Always include explicit credential safety rules for work involving production, Railway, Supabase, DBs, storage, auth tokens, or browser sessions.
- Tell execution agents to prefer existing safe read-only access paths, and to ask before using Supabase service-role credentials, Railway DB access, production JWTs, or browser-session tokens.
- Never allow prompts that could result in secrets, tokens, keys, or connection strings being printed, saved, logged, committed, or copied into reports.
- For possible real user or company data, require `manual review`; only recommend deletion when the item is clearly test data, clearly unreachable, and backed by evidence.
- Audit recommendation options should include `no action` so valid rows are not forced into cleanup or manual-review categories.
- Report-only means no cleanup and no mutation: no delete, upload, move, rename, overwrite, migration, or production write of any kind.
- If Claude already has approved Railway/Supabase dashboard access for a task, let Claude run approved read-only UI checks directly; still forbid extracting, copying, printing, or saving credentials/connection strings.
- After giving instructions to Claude A or Claude B, do not issue another instruction set for either Claude until Jay returns output from the latest assigned job or explicitly cancels/redirects it.
- Do not treat "Claude" as interchangeable with a Codex subagent. If Jay asks for Claude to do work, wait for Claude output or say that only Codex subagents are available in this environment unless Jay explicitly approves using one.

## PDF generation & characterization tests

- PDF characterization: `pdfGenerator.ts` is now a barrel over `frontend/src/lib/pdf/*`. Extend `frontend/src/lib/pdf/__tests__/pdfGenerator.characterization.test.ts` and reuse its `JsPdfRecorder` mock (don't create a new test file or mock). In PDF tests assert only timezone-stable output (headers, labels, metric values, `formatDateKey` filenames); avoid locale-formatted date string assertions (they differ UTC vs Sydney). (PR #275)

## Backend error contracts

- `AppError.badRequest(message, details)` takes `details` as its second argument, not an error-code override. Route code like `AppError.badRequest('...', { code: 'LOT_CONFORMED' })` returns wire `error.code === 'VALIDATION_ERROR'` and stores the domain marker at `error.details.code`. Tests and clients should assert/read `error.details.code` unless the route deliberately changes the AppError contract. (PR #278)
