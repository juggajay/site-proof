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

## 2026-07-05 — subagent git hygiene destroyed untracked files
An opus build agent ran `git checkout origin/master -- . ; git stash -u`
as pre-branch "cleanup", deleting the owner's untracked files (tasks/
todo.md, docs/research/*, docs/plans/*) into a stash it never restored.
Recovered from the dangling `untracked files on <branch>` fsck commit
(tagged recovery/stash-untracked-2026-07-05).
**Rules:** (1) Agent prompts must explicitly forbid `git stash -u`,
`git clean`, and `git checkout <ref> -- .` — "stage only your files" is
not enough; agents invent destructive hygiene when the tree looks dirty.
(2) When untracked files vanish, check `git stash list` THEN
`git fsck --unreachable` for same-day `untracked files on` commits before
declaring them lost — stash -u leaves a recoverable triple.
(3) Orchestrator: after any agent reports branch churn, run `git status`
and compare untracked files against the session-start snapshot.

## 2026-07-05 — uncommitted work leaks across agent branches in a shared checkout
Dirty working-tree changes (an intentionally-discarded variant) followed a
plain `git checkout -b` onto the next PR branch and shipped in its squash,
silently overriding the just-merged version of the same lines.
**Rules:** (1) Before an agent branches for new work, the tree must be
clean of anything not meant to ship — commit it, or explicitly carry it,
never assume "leftover edits are harmless". (2) Orchestrator: when a merge
output lists an unexpected `create mode`/file, diff master immediately —
that's how this was caught. (3) When two PRs touch the same file in one
day, verify the final master state, not the individual PR diffs.

## 2026-07-09 — schema-coupled PR merged hours before its prod migration
Batch C shipped a new nullable TestResult column: Prisma client is generated
from the schema, so EVERY un-`select`ed read of that model queries the new
column — merging to auto-deploying master without the prod migration applied
puts a countdown on prod breakage (test-result reads would 500 once Railway
deployed). Caught post-merge; migration applied under operator go before the
deploy landed, but the ordering was luck, not process.
**Rules:** (1) A PR that touches `schema.prisma` cannot merge until the prod
migration is applied or explicitly scheduled with the merge — check this at
REVIEW time, not after. (2) Migration-then-code is the safe order (old code
ignores new nullable columns; new code breaks on missing ones). (3) When
dispatching build agents, any "create a migration" instruction must come
with "the orchestrator gates the merge on the migration plan" — agents
can't apply prod migrations, so the coupling is the orchestrator's job.

## 2026-07-10 — subagents ran touched-file tests only; CI caught cross-file breaks twice
Two of five build agents in the review-fix campaign shipped green on their
own targeted test runs, then failed CI on OTHER files' tests: F-07's URL
change broke DocketScreen.test.tsx (exact-URL mock in a consumer it didn't
touch); F-08's added parameter broke useItpInstance.test.ts +
itpCompletionWrite.test.ts (callers pinning the old mock arity). The signal:
changing a shared function/URL shape means the blast radius is its CALLERS'
tests, which targeted runs never execute.
**Rules:** (1) Agent prompts for frontend changes must require the FULL unit
suite (`vitest run`) before pushing, not just touched files — backend suites
are slower but itp/claims/ncrs cross-file suites should run when shared
helpers change. (2) When a change alters any exported function signature,
fetch URL, or mock-visible shape, grep for consumers' tests explicitly.
(3) Orchestrator: name the known parallel-load flakes (ReportsPage,
ClaimsPageSections — pass in isolation) in the prompt so agents don't burn
time chasing them or, worse, "fix" them.

## 2026-07-10 — hardcoded future date in a test became a time bomb on the day it expired
The HP batch delivery test hardcoded scheduledDate '2026-07-10'; the route
validates a minimum working-day notice period from NOW, so the test passed
every day until the calendar caught up, then broke master and every open PR
simultaneously (same test, three unrelated PRs — the tell that master itself
was broken). Fix: compute dates relative to now (+14d clears any
weekend/notice combo).
**Rules:** (1) A test input validated against the current clock must be
computed, never literal. (2) When the SAME test fails on multiple unrelated
PRs, suspect master/date/environment before suspecting any PR — reproduce on
clean master first. (3) `gh pr checks --watch` exits non-zero for SKIPPED
checks (path-gated jobs); parse for state "fail" before treating a PR as red.

## 2026-07-12 — new unique constraint broke 14 DB-backed tests via incidental fixture collisions
PR #1392 added unique(lot_id, itp_checklist_item_id) on hold_points. The
implementing agent ran mocked/targeted tests green, but CI's full DB-backed
suite failed 14 tests in holdpoints.test.ts + publicBatchRoutes.test.ts:
their fixtures created multiple HoldPoints on the same (lot, item) pair —
incidental reuse, not intent. None were caught by targeted runs because
constraint violations only exist against a real schema.
**Rules:** (1) Any PR adding a DB constraint must run the FULL DB-backed
backend suite locally against a test DB WITH the new migration applied,
before pushing. (2) Fix fixtures (distinct keys per created row), never the
constraint or assertions.

## 2026-07-12 — date-rot fixed once must be swept as a class, same PR
The 2026-07-10 lesson fixed ONE hardcoded-date test (backend HP batch). Two
days later the identical class broke master's frontend suite twice over:
RequestReleaseModal.test.tsx and HoldPointsPage.test.tsx both hardcoded
'2026-07-10' against a min={today} date input — silently blocking submit so
onSubmit was "never called". Every frontend PR went red at once.
**Rules:** (1) When fixing a rot-class bug (dates, ports, versions), grep the
whole repo for the class in the SAME PR — `grep -rn "202[0-9]-[0-9][0-9]-[0-9][0-9]"`
on test files, then keep only clock-validated inputs. (2) Fixture dates that
are only displayed don't rot; dates validated against NOW always do.

## 2026-07-12 — Bash cwd persistence committed to the wrong branch (worktree/main split)
An orchestrator committed a fix that silently landed on local master: its
`git checkout <branch>` ran in a leftover agent-worktree cwd (shell cwd
persists between commands), while file edits went to the main checkout via
absolute paths — main was on master, so `git add && git commit` committed
there. Push "succeeded" (pushed the unchanged branch); CI never saw the fix.
**Rules:** (1) Start every git command chain with an explicit `cd <repo>` and
include `git branch --show-current` in the SAME chain as the commit. (2) After
any push, verify the commit actually reached the remote ref
(`git log origin/<branch> -1`), not just that push exited 0 — reflog is the
debugging tool when a commit "vanishes".
