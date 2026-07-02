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
- When characterizing a PDF, also freeze environment-sensitive rendering quirks instead of asserting idealized strings — run the generator and lock what it actually emits. Examples found while covering the claim evidence package: `Intl.NumberFormat('en-AU', { currency: 'AUD' })` renders `$` (not `A$`) in this Node/ICU build, and the lot-summary status column truncates via `slice(0, 10)` (`in_progress` → `in_progres`). Freezing these means a later "cleanup" can't silently change the output without a failing test. (PR #308)

## Backend error contracts

- `AppError.badRequest(message, details)` takes `details` as its second argument, not an error-code override. Route code like `AppError.badRequest('...', { code: 'LOT_CONFORMED' })` returns wire `error.code === 'VALIDATION_ERROR'` and stores the domain marker at `error.details.code`. Tests and clients should assert/read `error.details.code` unless the route deliberately changes the AppError contract. (PR #278)

## Backend extraction patterns

- When extracting orchestration out of an access-sensitive route, keep the role/permission **policy** in the route module and pass the check into the extracted service as an `authorize(projectId)` callback. Invoke it at the same point the inline code did (inside the same try/catch as any file-cleanup), so the multi-tenant trust boundary stays in one reviewable place while the orchestration moves out. This was used for test-result certificate intake (`requireTestProjectRole(...)` passed as `authorize`); reuse it for extraction-confirmation and other access-sensitive refactors. (PR #310)

## Refactoring & shared maps

- Refactor maps and candidate lists (e.g. in `.gstack` or planning docs) go stale fast during a multi-agent wave. Before coding a flagged item, verify it against `origin/master` and recently merged PRs; if it is already resolved, stop and report instead of duplicating the work.

## Worktrees & local test setup

- After `npm install` in a fresh worktree, run `git status` before staging. The install can pollute `backend/package.json` **and** `package-lock.json` with a bogus `"siteproof": "file:../../<sibling-worktree>"` dependency (a `file:` ref to a neighbouring worktree). Revert it with `git checkout HEAD -- backend/package.json backend/package-lock.json` — never let install pollution into a PR. (PR #310)
- Backend worktrees may need a generated Prisma client. `prisma generate` can fail in a worktree here, and a fresh `npm install` can leave a *stub* `.prisma/client` that looks generated (`index.d.ts` present) but throws `@prisma/client did not initialize yet` at load. Don't trust file presence — run one test. If you copy the generated client from another checkout, first confirm `prisma/schema.prisma` is byte-identical and the Prisma package version matches, and state that in the PR. (PR #310)
- **Never point tests at the production `DATABASE_URL`.** `backend/.env` here targets the Railway production database, and `assertSafeTestDatabaseUrl()` (`src/test/databaseSafety.ts`) refuses non-local hosts / DB names without a `test`/`e2e`/`shadow`/`ci` marker. For DB-backed suites use a disposable **local** Postgres passed via the shell env (vitest does not load `.env`); for pure unit tests leave `DATABASE_URL` unset; otherwise rely on CI. (PR #310)

## Frontend tests

- Playwright suites can false-fail when `reuseExistingServer` latches onto a dev server left running on `:5174` by an earlier suite (`frontend/playwright.config.ts`). If a whole set of otherwise-unrelated tests fails, restart the server and rerun cleanly before assuming a regression.
- Do not use disposable inbox APIs such as `1secmail.com` during QA on Jay's machine. AVG flags those domains from the Codex process. Use a user-supplied mailbox/manual verification path or a trusted test mailbox instead, and record that external email links were sent but require manual inbox confirmation.
- For production email-flow QA through Resend, do not use fake TLDs such as `.invalid` for recipients. Use Resend's safe test recipient pattern (`delivered+label@resend.dev`) for automated non-human invite addresses, and use Jay's supplied mailbox only where manual inbox verification is required.
- Source-text readiness guards (`frontend/e2e/productionReadiness.spec.ts`, run via `npm run test:readiness`) pin exact import lines and markup patterns in large files like `LotDetailPage.tsx`. After moving icons or components, check those guards and update them deliberately in the same PR.
- ITP offline cache (`frontend/src/pages/lots/lib/itpOfflineMapping.ts`) persists only `isHoldPoint` (boolean), not the full `pointType` union — so a **witness point round-trips through the offline cache as a standard point** unless the cache schema changes. `itpOfflineMapping.test.ts` freezes this current behavior; the upcoming `useItpInstance` hook PRs will catch it if it ever changes. (PR #309)
- Never verify a test suite through a pipe like `npm run test:readiness 2>&1 | tail`. In bash the chain's exit status is the LAST pipe stage (`tail` = 0), so a failing Playwright/vitest run looks green and `&&` continues. Capture honestly: `cmd > log 2>&1; echo $?`, `${PIPESTATUS[0]}`, or `set -o pipefail`. A sanity tell: compare the passed-count against the suite's known total (e.g. readiness "84 passed" when master has 85 = one failure was masked). (frontend coverage-floor PR)
- npm installs of NEW packages can hang indefinitely on this machine: AVG Web/Mail Shield intercepts TLS and node rejects its cert (`unable to verify the first certificate`), while npm silently retries. `npm ci` works only because the cache is warm. Fix without weakening TLS: export the AVG root cert from the Windows store (`Get-ChildItem Cert:\LocalMachine\Root | Where-Object Subject -match 'AVG|Avast'`) to a PEM and run with `NODE_EXTRA_CA_CERTS=<pem>`; Node >= 22.15 can use `--use-system-ca` instead (this box is on 22.14). Never use `--strict-ssl=false` here without integrity cross-checks against an already-trusted lockfile. (frontend coverage-floor PR)
- Do not run multiple Playwright commands in parallel from the same worktree while the frontend web server runs `npm run copy:pdf-assets`. The asset copy clears `frontend/public/pdfjs/cmaps`, so parallel webServer startup can fail with `ENOTEMPTY`. Run browser slices sequentially or make `copy-pdf-assets` concurrency-safe first. (Stage127 role browser loop)
- When Jay asks to reduce menu/card overload, that is a QUANTITY and STRUCTURE change ONLY — never introduce a second visual hierarchy (small chips, demoted links, mixed card sizes). The design system is ONE uniform full-width card style per screen; demote by position/order or by folding behind a hub, never by size. A "secondary links" pattern that survives from an old mockup still counts as a violation if it breaks the uniform grid on the real screen. (subbie /p home, PR #1324 correction)
- Subbie-shell card anatomy per Jay (2026-07-03): icon + label + optional status chip + chevron. NO description/subtitle text under the label — varying text lengths break card-height uniformity. Uniformity of the card grid outranks explanatory copy; if a card needs explaining, the label is wrong.
- Never stage a subagent build by directory (`git add frontend/src/shell`): agents legitimately touch shared files outside the domain dir (queryKeys.ts, index.css). Before committing, diff `git status --short` tracked modifications against the agent's reported file list and stage the union — or `git add -u` after confirming every modification belongs to the change. Missed `frontend/src/lib/queryKeys.ts` this way (CI type-fail on PR feat/subbie-work-lots-only; local checks passed because the working tree had it).
