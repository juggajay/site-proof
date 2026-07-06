# UX audit Batch 1 — data honesty — COMPLETE 2026-07-07

From the 4-agent UX sweep (48 findings; batches 2-3 pending Jay).

- [x] PR 1 #1342 merged `62d7f30d` — test register loads ALL pages
      (was silently capped at newest 20) + ?test= deep link wired
- [x] PR 2 #1343 merged `cce69ed8` — "Apply to N assigned lots" after
      template edit via existing propagate endpoint; semantics verified
      (edits 409 once work recorded → propagate can't destroy completions)
- [x] PR 3 #1344 merged `3208a59a` — offline FAIL was 400-ing on sync and
      silently dead-lettered (backend requires ncrDescription on fail) —
      NCR fields now persisted+sent; new queued ncr_create op with photo
      relink; offline worker net green
- [x] PR 4 #1345 merged `785ac083` — foreman shell confirm-before-pass on
      photo-required items (Add photo primary / Pass without photo
      explicit)
- [x] PR 5 #1346 merged `58017bfe` — extractErrorMessage on the 2 raw
      toasts, shortcuts help trimmed to the 4 real ones, empty-state
      create CTAs (NCR register, DocumentGrid)

Deferred out of batch: SubbieItpRunScreen has the same photo-guard gap
(flagged in #1345 body); UX batches 2 (daily grind) and 3 (judgment
calls) awaiting Jay.

# UI consistency batch — 2026-07-05

Orchestrator plan (decisions locked with Jay 2026-07-05). Opus subagents
implement; one PR per slice; sequential (no parallel writes to one checkout).

## Locked decisions

1. **Foreman /m cards adopt the subbie HubTile anatomy** — icon + label +
   optional chip + chevron. NO description text under labels. Counts move
   into chips; non-count prose moves into destination screens.
2. **My Company card — FINAL (2026-07-05, supersedes the "company block")**:
   plain uniform HubTile — building icon + company name as title + chevron.
   No kicker, no chips, either state. Fallback title "My Company" when the
   bootstrap has no company. Hero's setup state remains the setup signal.
3. **Subbie lot hub Inspection card: drop IN PROGRESS pill** — keep only
   YOU CAN COMPLETE / VIEW ONLY; pixel-equal card heights at 390px.
4. **Office sidebar: prune + group, all office roles** (owner, admin, PM,
   QM): sections QUALITY (Lots, ITPs, Hold Points, Test Results, NCRs) /
   COMMERCIAL (Progress Claims, Costs, Docket Approvals) / RECORDS
   (Documents, Reports, Subcontractors) / ADMIN (Project Settings).
   - Daily Diary removed from ALL office roles' nav (records stay readable
     via Reports → Diary). Diary menu item stays for field roles only —
     verify exact role set against backend diary-create permissions.
   - Docket Approvals off quality_manager (can't see amounts — known
     finding); also off site_engineer per review doc.
   - Nav-subtractive only: no new items, routes stay reachable by URL.

## PR 1 — shell card consistency + company block — DONE
PR #1326 squash-merged `80d0ab9d` (2026-07-05). HubTile lifted to
`shell/components/`; foreman descriptions stripped (kept in aria-labels);
IN PROGRESS moved to lot-hub header; My Company block inline in subbie
HomeScreen (445 lines). Visual QA light+dark passed on local stack.

- [x] All build items, tests, CI, visual QA, merge

## PR 2 — office sidebar prune + group — DONE
PR #1327 merged by Jay (`173030b2`). Sidebar.tsx + MobileNav.tsx grouped
(office roles only) + pruned; verified live on production (owner login):
QUALITY/COMMERCIAL/RECORDS/ADMIN sections, no Daily Diary.

- [x] All items; prod-verified

## PR 3 — subbie hub inspection pill — DONE (rode into #1326's squash)
The pill-fix push beat the merge; both fixes confirmed on master by
content inspection + empty cherry-pick.

- [x] Both fixes live

## PR 4 — My Company tile = company name only — DONE
PR #1328 squash-merged `02073a1a`. Supersedes the "company block": plain
HubTile titled with company name, no chips, fallback "My Company"; net
−119 lines. QA'd light+dark on local stack.

- [x] Built, tested, QA'd, merged

## PR 5 — HP batch release "one link, one review room" — IN PROGRESS
Jay-approved 2026-07-05 after full flow review. Email today = red header +
per-HP link pairs (≤25×2 buttons), recipient signs per HP with no
progress view; lot-page link is login-only (dead end for external supers).
New design: HoldPointReleaseBatch (additive migration — MANUAL prod apply
at deploy, no auto-migrate) + one hashed batch token → /hp-release/batch/
:token review room (per-HP expandable evidence, one identity+signature,
release selected, progress X of N, per-HP audit preserved) + branded
one-button email. Back-compat: per-HP tokens/links still work.

- [x] DONE: #1329 merged `d2e98297`; migration applied to prod manually;
      Jay live-tested send → email → review room → signed release.

## PR 6 — downloadable files (docs/plans/downloadable-files-improvement-
plan-2026-07-05.md)

- [x] PR A #1330 merged `374597f8` — evidence PDF: release authorisation +
      signature image + branding header + accountability + footers; QA'd
      on real prod data
- [x] PR B #1331 merged `fa29ea60` — typed signature mode (final helper
      text = mode-aware, shipped via #1332's tree; accepted)
- [x] PR C1 #1332 merged `e673b4e3` — shared chrome: aspect-fit logos,
      footers ×8 generators, empty states, CSV released-by columns
- [x] PR C2 #1333 merged `2f65d408` — logo embedded as data URL in HP
      evidence payload (public-page safe); storage was already durable
      Supabase (stale-premise correction)
- [ ] PR D (small, whenever): testCert verifiedBy/At + docket
      approvedBy/submittedBy payload fills (blank PDF blocks)
- [ ] Jay: rename company (placeholder "jayson ryan's Company") in Company
      Settings — it prints on every branded PDF

## Bug batch 2026-07-06 (Jay's live-testing findings) — investigated, fixes planned

Three production bugs, root-caused by read-only investigators. One opus
builder ships three small PRs, sequential, each branched off origin/master.

### Fix 1 — company logo uploads but never displays (backend, 1-liner)
Upload + storage + signed URL all work; the serving route
`GET /api/company/logo/file/:companyId` (backend/src/routes/company.ts
~line 103) omits `Cross-Origin-Resource-Policy: cross-origin`, so helmet's
default `same-origin` CORP makes the browser refuse to render the
cross-origin <img> (Vercel frontend ↔ Railway backend). Every other
byte-serving route sets it (documents/fileHelpers.ts:313,
staticUploads.ts:45, scheduledReports/artifacts.ts:119).
- [x] PR #1334 merged `ae120b44` — CORP header + route-test assertion +
      companySettings query invalidation after logo upload

### Fix 2 — manual-release modal buttons render below the fold (frontend)
Desktop ResponsiveSheet renders the footer as the last item INSIDE the
`max-h-[90vh] overflow-y-auto` DialogContent (ResponsiveSheet.tsx:82), so
when typed-signature mode (~90px taller) tips the form past 90vh the
Cancel / Record Manual Release buttons fall below the fold. Mobile branch
(:66-70) already pins its footer sticky.
- [x] PR #1335 merged `5209073f` — desktop footer pinned sticky (mirrors
      mobile pattern; covers all ResponsiveSheet desktop consumers)

### Fix 3 — Evidence Readiness "management-only items" contradiction (backend)
`buildManagementPrepSnapshot` (backend/src/routes/lots/qualityRoutes.ts:154,159)
sets `managementOnlyItems` = count of ALL release-gated checklist items,
never excluding hold points already released → "16 need release" beside
"16 released". Fix: filter `releaseGatedIds` to HPs NOT in
`TERMINAL_HOLD_POINT_STATUSES` via the in-scope `holdPointByItemId` —
exact pattern already used by `missingRecipientIds` (:138-145).
- [x] PR #1336 merged `22b1efe3` — managementOnlyItems/Ids now exclude
      terminal (released/completed) HPs; released-HP test case added
- [x] Scope extension (Jay: "how do I know what test it's looking for") —
      blocker now NAMES outstanding tests per item:
      `prerequisites.outstandingTestItems` {description, testType, state:
      no_result | awaiting_verification | failing}, detail lists up to 3
      then "and N more"; gate behavior unchanged, presentation only
- [ ] NOT in scope: completed-counts-as-unreleased asymmetry (note only)

## Test workflow simplification 2026-07-06 — APPROVED, in build

Plan: docs/plans/test-workflow-simplification-plan-2026-07-06.md
Root cause: TestResult.itpChecklistItemId checked first by the conformance
gate but never written by anything; all linkage = exact free-text testType
match. Form = 21 flat fields, 1 required, result block re-collected later.

- [x] PR 1 #1337 merged `e038c986` — itpChecklistItemId accepted+validated
      (POST/PATCH/cert confirm; stale link auto-dropped on lot change;
      link-only PATCH keeps verified), `unmatched_result_exists` state
- [x] PR 2 #1338 merged `f3894225` — "Add test result" on test-required
      unsatisfied ITP checklist rows + lot Tests tab header; CreateTestModal
      satisfiesItem banner submits itpChecklistItemId (readiness-card
      affordance moved into PR 3 + itemId added to payload)
- [x] PR 3 #1339 merged `55307547` — modal slim-down (ResponsiveSheet,
      essentials: lot/test-type/location/date-today, lab details behind
      accordion, result block dropped from create), ITP-item picker with
      "Something else" fallback, cert-first button hierarchy, desktop
      "Link to ITP item" row action, readiness-card per-test "Add result"
      (+ itemId in outstandingTests payload)
- Deferred: verification review UI, evidence-pack unlinked tests, status
  pill unification, reports normalization, cert-review item picker
  (confirm/batch-confirm), MOBILE "Link to ITP item" (see plan doc +
  PR #1339 comment)

## Readiness cleanup + force-conform honesty 2026-07-06 (evening) — in build

Jay: (1) readiness panel too cluttered (double enumeration: #1336 prose
list + #1339 button list of the same 12 tests, centered/wrapping);
(2) force-conform says "conformed" but claims still blocked.
Investigated: force-conform (owner/admin, POST /conform {force:true,
reason}) persists NO durable marker — reason goes only to audit log; the
claim gate re-runs computeConformanceResult (CONFORMANCE_STALE,
claims/workflowRoutes.ts:196-208) and can't distinguish override from
regression. Override-Status button can't set conformed at all (validation
excludes it).

- [x] PR A #1340 merged `5a28766c` — count-summary detail (+ per-test
      state in payload), compact capped list (first 3 + Show all N, Add
      for creators only), Claim card no longer re-prints reasons
- [x] PR B #1341 merged `5f56b253` — conformanceOverriddenAt/ById/Reason
      persisted by force branch (cleared on status back-transition);
      claim gate suppresses ITP/test reasons when overridden, keeps
      open-NCR + N/A-hold-point enforcement; "Conformance accepted by
      override" support item. Migration 20260706105034 applied to prod
      manually (status-checked: was the only pending) BEFORE merge, Jay
      approved ("go").
      NOTE: lots force-conformed BEFORE this fix have no override marker —
      re-force-conform them (or clear+reconform) to set it.

## Incident 2026-07-05 (resolved)
Build agent's `git stash -u` deleted untracked files; recovered via
dangling stash commit, tagged recovery/stash-untracked-2026-07-05.
Anti-recurrence rules in tasks/lessons.md + agent standing orders.

## Review

All 2026-07-05 decisions shipped same-day: #1326 (card anatomy + shared
HubTile), #1327 (office sidebar), #1328 (name-only company tile). Pill
fixes folded into #1326. Backend/nav mismatch noted for later: backend
still permits owner/admin/PM diary CREATE (nav-only removal — tighten
backend if wanted). Design lesson recorded: no rich exceptions to the
uniform card anatomy — Jay rejected the approved "company block" on sight.
Remaining workstream (unstarted): slice 1c classic-portal retirement, QM
verify/reject UI (H4), data-honesty fixes.
