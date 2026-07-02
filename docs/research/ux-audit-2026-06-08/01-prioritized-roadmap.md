# SiteProof v3 — UI/UX Prioritised Roadmap

**Audited commit:** `origin/master @ 3cc0d37`
**Date:** 2026-06-08
**Companion files:** `00-EXECUTIVE-SUMMARY.md`, `02-design-system-conformance.md`, `03-external-research-pack.md`, `04-findings-detail.md`

All 55 confirmed findings, grouped by post-verification severity. Locations are relative to repo root. Effort is the verifier's S/M/L estimate. "Recommendation" is the one-line fix; full evidence and verifier notes are in `04-findings-detail.md`.

---

## P0 — Launch-blocking (fix before any external eyes)

| id | Title | Dimension | Location | Effort | Recommendation |
|---|---|---|---|---|---|
| `design-system-conformance-01` | Violet primary/ring/chart tokens — the banned #1 AI-slop signal, on every `bg-primary` and the landing hero | design-system | `frontend/src/index.css:6-43`; `frontend/src/components/landing/Hero.tsx:23,34`; `frontend/tailwind.config.js:18-26` | S | Replace `:root`/`.dark` token block with spec §4 zinc-950 values; add `--accent`/`--success`/`--warning`/`--info` (+ `-foreground`); recolour 5 chart vars. One file, app-wide. |

---

## P1 — Fix before the first beta HC

| id | Title | Dimension | Location | Effort | Recommendation |
|---|---|---|---|---|---|
| `forms-02` | Daily docket entry is online-only; built offline layer unused | forms | `frontend/src/pages/subcontractor-portal/DocketEditPage.tsx:138-312`; unused `frontend/src/lib/offline/dockets.ts:19-99`; executor `frontend/src/lib/offline/syncWorker.ts:208-254` | L | Wire create/add-labour/add-plant through the existing offline functions (optimistic-first) + per-docket sync chip. Keep `docket_submit` online-only. |
| `accessibility-03` | Foreman BottomSheet (6 diary sheets) — no dialog role, no focus trap/restore, unlabelled close | accessibility | `frontend/src/components/foreman/sheets/BottomSheet.tsx:24-40` | M | Swap to in-repo Radix Dialog/Sheet, or add `role="dialog"`+`aria-modal`+`aria-labelledby`, focus-in/trap/restore, `aria-label="Close"`. |
| `design-system-conformance-03` | 1,468 raw Tailwind colour utilities across 239 files bypass semantic tokens; blocks global retint/dark-mode | design-system | `frontend/src/pages/lots/constants.ts:41-76`; `frontend/src/pages/ncr/constants.ts:7-13`; `frontend/src/pages/tests/constants.ts:6-18`; +236 | L | After P0 adds tokens: migrate per-domain source-of-truth constants first, then codemod the long tail. Multi-day, not one PR. |

---

## P2 — Should fix before broad rollout

| id | Title | Dimension | Location | Effort | Recommendation |
|---|---|---|---|---|---|
| `accessibility-01` | Border/input token 1.27:1 — every field outline/divider effectively invisible (fails 1.4.11) | accessibility | `frontend/src/index.css:32-33`; `frontend/src/components/ui/input.tsx:11`; `native-select.tsx:12`; `card.tsx` | S | Darken `--border`/`--input` (+ `.dark`) to clear 3:1 (~zinc-400/500, L58-60%). Token-layer fix. |
| `accessibility-02` | White-on-amber/green/red status pills 2.1–3.8:1 (fails 1.4.3) | accessibility | `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:183`; `ForemanBottomNavV2.tsx:192`; `frontend/src/components/ui/button.tsx:17-18` | M | Use -700 shades or the dark-text-on-light-fill (amber-800/amber-100) pattern; one accessible pill helper + Success button. |
| `accessibility-05` | RHF+Zod errors not linked to inputs (no `aria-describedby`/`aria-invalid`) app-wide | accessibility | `frontend/src/pages/ncr/components/CreateNCRModal.tsx:166-198`; only 5 hits in 4 files repo-wide | M | One shared field wrapper sets `aria-invalid` + `aria-describedby` when an error is present; keep `role="alert"`. Fixes every form. |
| `accessibility-06` | Button/Input/NativeSelect override the 2px ring down to 1px, no offset | accessibility | `frontend/src/components/ui/button.tsx:8`; `input.tsx:11`; `native-select.tsx:12` vs `index.css:117-119` | S | Remove the `ring-1` overrides (let global `ring-2 ring-offset-2` apply) or set `ring-2`+offset. |
| `accessibility-08` | Dark-mode violet text fails 4.5:1 (4.19:1); muted-foreground only marginally passes light | accessibility | `frontend/src/index.css:55` (`.dark --primary`), `:24` (`--muted-foreground`); used in ~278 files | M | Lighten `.dark --primary` until violet text clears 4.5:1; darken `--muted-foreground` toward zinc-600. |
| `accessibility-09` | Header dropdowns (project switcher, user menu) — custom divs, no focus move/trap/restore | accessibility | `frontend/src/components/layouts/Header.tsx:191-376` | M | Replace with in-repo Radix `dropdown-menu`, or add focus-in, arrow-key roving, Tab trap, focus-restore. |
| `heuristics-01` | Context-help built for 14 pages, mounted on one; onboarding promises help that's absent | heuristics | `frontend/src/components/ContextHelp.tsx:13-298`; only consumer `LotsPage.tsx:179`; promise `OnboardingTour.tsx:63` | M | Mount `<ContextHelp>` on every page with a `HELP_CONTENT` key; until then edit the tour copy. |
| `heuristics-02` | Dashboard "Team Members" KPI tile permanently renders an em-dash | heuristics | `frontend/src/components/dashboard/DashboardKpiTiles.tsx:78-81` | S | Wire to a real count (`/api/company/members`) or remove the tile. |
| `heuristics-06` | "Raise NCR" styled `destructive` red — danger signal for a routine create | heuristics | `frontend/src/pages/ncr/NCRPage.tsx:121-126,293-305` | S | Use default/primary variant (keep AlertTriangle if a cue is wanted); reserve red for irreversible actions. |
| `field-ergonomics-01` | Two offline/sync systems show the foreman contradictory pending counts; nav hides failed/conflicted | field-ergonomics | `frontend/src/hooks/useOnlineStatus.ts:7-44` vs `frontend/src/lib/useOfflineStatus.ts:26-160`; `OfflineIndicator.tsx` | M | Make the bottom-nav strip consume `useOfflineStatus`; stop counting dead-lettered items as "pending"; surface failed/conflict inline. |
| `field-ergonomics-02` | Floating offline indicator (z-50) overlaps the bottom-nav corner tab | field-ergonomics | `frontend/src/components/OfflineIndicator.tsx:61`; `QuickCaptureButton.tsx:100`; `App.tsx:490` over nav z-30 | S | Explicit z-scale (nav < FAB < indicator); anchor the pill above nav height clear of the FAB column, or fold into the nav strip. |
| `field-ergonomics-03` | Banned violet primary colours every primary field action (capture FAB, ITP progress, sync CTA) | field-ergonomics | `frontend/src/index.css:6-43`; `ForemanBottomNavV2.tsx:175`; `MobileITPChecklistSections.tsx:36`; `OfflineIndicator.tsx:109` | S | Same token swap as `design-system-conformance-01`; propagates to every field surface. (Merged into P0 — see ledger.) |
| `field-ergonomics-04` | Field labels fail 1.4.3 on white (amber hints; white-on-green/red swipe labels) | field-ergonomics | `frontend/src/components/foreman/MobileITPChecklistSections.tsx:190`; `SwipeableCard.tsx:30-31,115,130`; `DocketApprovalsMobileView.tsx:322,327` | S | Darken to amber-700+/green-700/red-700 (clear 4.5:1); keep icon + word. |
| `field-ergonomics-06` | Capture GPS feedback is success-only — denied/pending/unavailable is silent | field-ergonomics | `frontend/src/components/foreman/CaptureModal.tsx:281-286`; `frontend/src/hooks/useGeoLocation.ts:62-77` | S | Show spinner / captured(±Xm) / amber "No GPS — saves without location"; mirror the existing `QuickPhotoCapture` pattern. |
| `field-ergonomics-07` | Core ITP inspection bottom-sheet lacks focus trap/dialog role/restore | field-ergonomics | `frontend/src/components/foreman/sheets/BottomSheet.tsx:11-50` (wraps `MobileITPItemSheet.tsx:71`) | M | Same fix as `accessibility-03` — Radix dialog or full ARIA dialog wiring. (Merged — see ledger.) |
| `field-ergonomics-09` | Swipe approve/reject has no Undo and is undiscoverable / not exposed to AT (mitigated by confirm modal) | field-ergonomics | `frontend/src/components/foreman/SwipeableCard.tsx:82-95`; `DocketApprovalsMobileView.tsx:315-330`; `DocketApprovalsPage.tsx:309-311` | M | Keep the confirm modal; add a one-time swipe hint + time-boxed Undo; keep the explicit buttons visible for AT. |
| `microcopy-02` | Foreman capture shows bare "Failed to save" — hides reason, no recovery | microcopy | `frontend/src/components/foreman/CaptureModal.tsx:180,221` | S | Use `extractErrorMessage(error, fallback)`; distinguish offline (queued, reassure) from true failure (keep the file). |
| `microcopy-04` | "Today" worklist collapses every backend error to "check your connection" | microcopy | `frontend/src/components/foreman/TodayWorklist.tsx:119` | S | Branch: connection wording only for true offline; else `extractErrorMessage(queryError, ...)`. |
| `forms-03` | Diary add/remove handlers swallow ALL failures with only `logError` | forms | `frontend/src/pages/diary/components/ActivitiesTab.tsx:59-61`; `DelaysTab`/`PlantTab`/`PersonnelTab` (+ all remove* handlers) | S | Add an error toast (`extractErrorMessage`) to every add*/remove* catch; keep the typed row on failure. |
| `forms-04` | No numeric keyboard on any diary number field | forms | `frontend/src/pages/diary/components/ActivitiesTab.tsx:170-178`; `DelaysTab`/`PlantTab`/`WeatherTab` | S | Add `inputMode="decimal"` (or `"numeric"`) to quantity/hours/duration/temp/rainfall, matching `RecordPaymentModal`. |
| `forms-05` | Diary inline delete = unlabelled icon button + immediate destructive DELETE, no confirm/undo | forms | `frontend/src/pages/diary/components/ActivitiesTab.tsx:119-136`; `DelaysTab`/`PlantTab`/`PersonnelTab` | M | Add `aria-label`, ≥44px hit area, and a confirm dialog or undo snackbar (desktop path; mobile timeline already confirms). |
| `forms-07` | Labour docket time silently wraps overnight (finish<start +24h), wrong pay hours | forms | `frontend/src/pages/subcontractor-portal/docketEditHelpers.ts:8-15`; `DocketEntrySheet.tsx:106-127,232-244` | M | Inline warn when finish≤start ("overnight — is 22h correct?") or require an explicit overnight toggle. |
| `forms-08` | Diary fields use placeholder-as-label, no visible/associated `<label>` | forms | `frontend/src/pages/diary/components/ActivitiesTab.tsx:151-185`; `DelaysTab`/`PlantTab`/`PersonnelTab` | M | Add visible `<Label>` (or `aria-label`) per input; reuse the NCR/Lot/Claims `<Label>` pattern. |
| `forms-09` | Diary weather autosave is a 60s timer that doesn't fire on SPA nav; other tabs no draft buffer | forms | `frontend/src/pages/diary/components/WeatherTab.tsx:163-192` | M | Shorten debounce to ~5-10s; add a React-Router `useBlocker`/prompt mirroring `beforeunload`. |
| `states-01` | Two error-banner styles; dominant `bg-red-50/text-red-700` is light-only (broken in dark mode) | states | `LotsPage.tsx:300-318`; `ProjectsPage.tsx:443-460`; `NCRPage.tsx:131-153`; `ClaimsPageSections.tsx:60-80` | M | Extract one `<LoadErrorAlert>` using the destructive-token style already in DocketApprovals/TestResults. |
| `states-02` | Core pages show a bare centred spinner (blank flash, layout jump) instead of a skeleton | states | `DashboardPage.tsx:255-265`; `NCRPage.tsx:92-103`; `TestResultsPage.tsx:346-356`; `LotDetailPageStates.tsx:8-18`; `ClaimsPageSections.tsx:82-88` | M | Use existing `StatCardsSkeleton` + table/row skeletons; keep the page header rendered during load. |
| `states-03` | A complete shared skeleton kit exists but is almost entirely dead code | states | `frontend/src/components/ui/Skeleton.tsx:17-141` (TableRow/Card/ListItem/LotsTable/ProjectsGrid/StatCards unused) | M | Adopt the existing exports across Projects/Lots/Dashboard/list-detail; delete genuinely homeless variants. |
| `states-04` | Subbie dashboard collapses load failures into "empty" (silent failure) | states | `frontend/src/pages/subcontractor-portal/SubcontractorDashboard.tsx:143-177,465-512` | S | Surface `isError` on the dockets/lots/notifications queries; render an inline "Couldn't load — Try again". |
| `states-05` | Opacity-reduced muted text (`/70`, `/50`) fails 1.4.3 on foreman outdoor surfaces | states | `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:285,301`; `frontend/src/components/ui/SignaturePad.tsx:213` | S | Drop the opacity modifiers; use solid `text-muted-foreground`/`text-foreground` for real body/prompt text. |
| `journeys-01` | First-run owner gets zero guided onboarding — the built 9-step tour is hard-disabled | journeys | `frontend/src/components/layouts/ProtectedAppShell.tsx:15,40-45,51`; `OnboardingTour.tsx:17-65` | M | Ship a trimmed first-run path (re-enable trimmed tour or an outcome-framed checklist) gated on `companyId && projectCount===0`. |
| `journeys-04` | New project's dashboard shows emptiness-as-metrics, buried CTA, misleading green "all clear" | journeys | `frontend/src/components/dashboard/ProjectDashboard.tsx:276-330,351-357,424-428` | M | When `lots.total===0`: promote a prominent "Create your first lot" CTA; suppress/relabel the green "No NCRs" state. |

---

## P3 — Polish / opportunistic

| id | Title | Dimension | Location | Effort | Recommendation |
|---|---|---|---|---|---|
| `heuristics-03` | 3+ divergent status colour/label maps across screens | heuristics | `docketActionData.ts:18-32`; `DocketApprovalsMobileView.tsx:47-61`; `ncr/constants.ts:7-14`; `lotsPageDisplay.ts:2-8` | M | Centralise one status→{label,className,icon} map per domain; import in both table and mobile card. |
| `heuristics-04` | Inconsistent loading affordance — spinners on some core pages, skeletons on others | heuristics | spinners: `DashboardPage.tsx:255`, `NCRPage.tsx:92`, `ITPChecklistTab.tsx:160`; skeletons: `LotsPage.tsx:274`, `SubcontractorDashboard.tsx:237` | M | Standardise on skeletons for full-page content loads; reserve spinners for inline waits. (Pairs with `states-02/03`.) |
| `heuristics-07` | Bulk lot status update commits to N lots with only a count, no preview | heuristics | `frontend/src/pages/lots/components/BulkActionModals.tsx:80-135`; `LotsPage.tsx:193-196` | M | List affected lot numbers (or count + expandable list), show current→new status; consider undo toast. |
| `heuristics-08` | NCR contextual help describes a status lifecycle the app doesn't use | heuristics | `ContextHelp.tsx:112-117` vs `ncr/constants.ts:7-14` | S | Rewrite NCR help to the real lifecycle; audit other `HELP_CONTENT` entries before mounting (see `heuristics-01`). |
| `heuristics-09` | DefaultDashboard has no first-run launchpad — all-zero KPIs, no primary next step | heuristics | `frontend/src/pages/DashboardPage.tsx:267-436` | M | When `totalProjects===0`, swap the grid for a focused empty state + "Create your first project". (Bounded: Projects page already launches first-run.) |
| `heuristics-10` | NCR page shows a persistent "Your role:" info banner (clutter, consistency outlier) | heuristics | `frontend/src/pages/ncr/NCRPage.tsx:164-172` | S | Remove the standing banner; surface the major-closure hint inside the close/approve flow. |
| `heuristics-11` | Docket Approvals duplicates the pending count and buries the summary below the table | heuristics | `frontend/src/pages/dockets/DocketApprovalsPage.tsx:334-346,383-400` | S | Move labour/plant/pending summary above the table; align desktop with mobile inline-stats. |
| `accessibility-04` | No `prefers-reduced-motion` handling — all keyframes/transitions ignore OS reduce-motion | accessibility | `frontend/src/index.css:122-212`; `ContextFAB.tsx:42-98`; `SwipeableCard.tsx:139` | S | Add a global `@media (prefers-reduced-motion: reduce)` reset block; gate ContextFAB injected keyframes. |
| `accessibility-07` | VoiceInputButton transcription/error not in an aria-live region; state by colour/animation | accessibility | `frontend/src/components/ui/VoiceInputButton.tsx:120-144` | S | Wrap preview in `aria-live="polite"`, error in `role="alert"`; add a visible/aria recording state. |
| `accessibility-10` | SignaturePad bare `<canvas>` — no name/role, no non-pointer alternative | accessibility | `frontend/src/components/ui/SignaturePad.tsx:22-60` | M | Add `aria-label` from `label` prop + role; provide a "type your name to sign" fallback. (Contained: one caller, with keyboard email/paper options.) |
| `design-system-conformance-02` | No font-family declared — falls back to the banned system/Inter-class stack | design-system | `frontend/src/index.css`; `frontend/tailwind.config.js`; `LandingPage.tsx:16` | M | Self-host Geist + Geist Mono `@font-face`; set `theme.extend.fontFamily`; add `tabular-nums` on numeric columns. (Promote with P0/font work.) |
| `design-system-conformance-04` | Mobile vs desktop docket approvals use different colours for the same status (emerald vs green) | design-system | `DocketApprovalsMobileView.tsx:47-53` vs `docketActionData.ts:18-24` | S | Delete the private mobile maps, import the shared one; mobile card `rounded-xl`→`rounded-md`. |
| `design-system-conformance-05` | Banned bespoke palettes (civil/safety/lot) still in tailwind.config.js | design-system | `frontend/tailwind.config.js:51-75` | M | Migrate `civil-*` usage (only `AuthLayout.tsx:5,9`) to tokens; delete the three blocks. safety/lot are unused. |
| `design-system-conformance-06` | Button `success` hardcodes `bg-green-600`; `ghost` variant defined (used mostly for icon dismissals) | design-system | `frontend/src/components/ui/button.tsx:17-20` | M | Switch success to `bg-success` once token exists; ghost is largely icon-only already — light audit. |
| `design-system-conformance-07` | Landing hardcodes raw hex (`bg-[#f97316]`, `text-[#10b981]`) next to the violet primary | design-system | `frontend/src/components/landing/Hero.tsx:18,52,56`; 9 arbitrary `[#…]` across 5 landing files; `ClaimsCharts.tsx:16` | S | Replace with `bg-accent`/`text-success` (after tokens exist); convert chart hex to chart CSS vars. |
| `design-system-conformance-08` | Background off-white (98%) and radius 0.5rem vs spec pure-white + 0.375rem | design-system | `frontend/src/index.css:8,36` | S | Set `--background` 0 0% 100%, `--radius` 0.375rem; drop shadow on non-modal buttons. (Same PR as P0.) |
| `design-system-conformance-10` | Focus ring weakened to `ring-1` on buttons + landing CTAs | design-system | `frontend/src/components/ui/button.tsx:8`; `Hero.tsx:34,41` | S | `ring-1`→`ring-2` (with offset); ensure ring colour is the new zinc `--ring`. (Pairs with `accessibility-06`.) |
| `field-ergonomics-05` | Secondary muted text clears AA by a hair (4.63:1), misses the AAA sunlight target the spec mandates | field-ergonomics | `frontend/src/index.css:24`; `DocketApprovalsMobileView.tsx:118,134-143`; `MobileITPChecklistSections.tsx:25,29` | S | Adopt the spec's `--muted-foreground` (240 5% 34%). (Same token swap as P0.) |
| `field-ergonomics-08` | Filter pills + a few controls below 44-48px field target; share the swipe plane | field-ergonomics | `DocketApprovalsMobileView.tsx:196-208`; `CaptureModal.tsx:357-365` | S | Bump pills/inline Retry to `min-h-11`; add inter-pill spacing + a divider above the swipe-card list. |
| `field-ergonomics-10` | Foreman bottom-nav active tab signalled by violet colour alone; inactive labels borderline | field-ergonomics | `frontend/src/components/foreman/ForemanBottomNavV2.tsx:167,184-186` | S | Add a non-colour active indicator (top bar / filled icon); lift inactive label contrast; pair with token fix. |
| `field-ergonomics-11` | Auto-camera can dead-end on cancel; shared CaptureModal gated foreman-only | field-ergonomics | `frontend/src/components/foreman/CaptureModal.tsx:81-113,244-256`; `MainLayout.tsx:18-20,51-57` | M | Replace stale "Opening camera…" heading with a re-trigger state; mount the shared CaptureModal for other field roles. |
| `microcopy-01` | Subbie portal labels compliance objects with bare acronyms; in-app glossary unreachable there | microcopy | `SubcontractorITPsPage.tsx:167`; `SubcontractorHoldPointsPage.tsx:167`; `SubcontractorNCRsPage.tsx:186` | S | Expand the acronym in each detail-page header; add an info affordance reusing `HELP_CONTENT`. |
| `microcopy-03` | Rich `HELP_CONTENT` glossary wired into only one page | microcopy | `frontend/src/components/ContextHelp.tsx:13`; only consumer `LotsPage.tsx:17,179` | M | Render `<ContextHelp>` on each page with a `HELP_CONTENT` key. (Same root as `heuristics-01`.) |
| `microcopy-05` | Subbie "Total ITPs" counts lots-with-an-ITP, not ITPs | microcopy | `frontend/src/pages/subcontractor-portal/SubcontractorITPsPage.tsx:175-177` | S | Rename label to "Lots with ITPs" or compute the real ITP-instance count; align In Progress/Completed. |
| `microcopy-06` | Subbie ITP "view only" notice abbreviates the role as "PM" to the least-technical user | microcopy | `frontend/src/pages/subcontractor-portal/SubcontractorITPsPage.tsx:273` | S | Replace "PM" with "the project manager" / "the head contractor". |
| `microcopy-09` | "Mark as Completed" copy contradicts itself on whether a completed project is editable | microcopy | `frontend/src/pages/projects/settings/components/DangerZone.tsx:195,396` | S | State the exact effect (it is a soft flag, no read-only enforcement), mirroring Archive's precise wording. |
| `forms-10` | Default Input height (h-9 / 36px) below the 44px field touch target | forms | `frontend/src/components/ui/input.tsx:11` | S | Add a field/mobile size variant (h-10/h-11) for foreman/subbie forms; don't blanket-bump desktop management views. |
| `forms-11` | Inconsistent required-field marking; several Zod errors not aria-live announced | forms | `MarkAsFailedModal.tsx:86`; `CreateLotModal.tsx:264`; `CreateNCRModal.tsx:166`; `CreateLotModal.tsx:278` | M | Standardise a required-marker (styled asterisk + sr-only "required"); ensure `role="alert"`+`aria-describedby`+`aria-invalid`. |
| `states-06` | Documents list shows a bare "Loading documents…" text node (no skeleton, no `role="status"`) | states | `frontend/src/pages/documents/components/DocumentGrid.tsx:57-58` | S | Replace with `ListItemSkeleton` rows in `role="status"`. (Same pattern as `DrawingRegisterTable.tsx:56`.) |
| `states-07` | NCR uses ad-hoc inline green/role banners while most pages use toasts | states | `frontend/src/pages/ncr/NCRPage.tsx:155-172` | S | Route NCR success through `toast({variant:'success'})`; if the role note stays, give it dark-mode tokens. |
| `states-08` | Docket status chips: desktop table has no dark variants (mobile does); shared-map drift | states | `DocketApprovalsTable.tsx:142-147` vs `DocketApprovalsMobileView.tsx:47-53`; `SubcontractorDashboard.tsx:100-115` | M | One shared light+dark status map. (Note: the "colour-only icon" sub-claim was a misread — icons already differ by glyph + always paired with a label. `codeConfirmed:false`.) |
| `states-09` | Swipe approve/reject gives no optimistic feedback or undo; card unchanged until refetch | states | `DocketApprovalsMobileView.tsx:312-366`; `DocketApprovalsPage.tsx:309-311,428-432`; `DocketActionModal.tsx:88-118` | M | Optimistically update the cached list (`setQueryData`) + time-boxed undo, reconcile on refetch. (Pairs with `field-ergonomics-09`.) |
| `states-10` | Filtered-empty vs first-use-empty conflated on Documents (no "Clear filters") | states | `frontend/src/pages/documents/components/DocumentGrid.tsx:59-84`; `DocumentsPage.tsx:361-370` | S | Pass a `hasActiveFilters` flag into DocumentGrid; branch to "No documents match your filters" + Clear, like NCRPage. |

---

## Recommended execution sequence

The sequence below is dependency- and leverage-ordered. Group A is the pre-beta minimum (see `00-EXECUTIVE-SUMMARY.md` for the narrative version).

### Group A — pre-beta (≈1 week)

1. **PR 1 — Token rewrite (the keystone).** Closes P0 `design-system-conformance-01` and the cheap token riders in one `frontend/src/index.css` + `frontend/tailwind.config.js` change: zinc-950 primary/ring, pure-white background, 6px radius, add `--accent`/`--success`/`--warning`/`--info`, recolour chart vars, darken `--border`/`--input` (`accessibility-01`), darken `--muted-foreground` (`accessibility-08`, `field-ergonomics-05`), lighten `.dark --primary` (`accessibility-08`), drop non-modal button shadows (`design-system-conformance-08`). Also resolves `field-ergonomics-03` and `field-ergonomics-10`'s colour half.
   *Verify:* `productionReadiness.spec.ts` / static-string E2E may pin token-adjacent markup — repoint, never weaken.
2. **PR 2 — Fonts.** `design-system-conformance-02` + `tabular-nums`.
3. **PR 3 — Offline docket entry.** P1 `forms-02`. Keep `docket_submit` online-only.
4. **PR 4 — Field bottom-sheet a11y.** P1 `accessibility-03` + `field-ergonomics-07` (one component). Swap to Radix dialog.
5. **PR 5 — Silent-failure sweep on field/pay surfaces.** `forms-03`, `field-ergonomics-06`, `microcopy-02`, `microcopy-04`.

### Group B — shared-primitive a11y (each app-wide, low risk)

6. **PR 6 — Form error a11y wrapper.** `accessibility-05` + `forms-08` + `forms-11`.
7. **PR 7 — Focus ring.** `accessibility-06` + `design-system-conformance-10`.
8. **PR 8 — Reduced motion.** `accessibility-04`.
9. **PR 9 — Header menus.** `accessibility-09` (Radix dropdown).
10. **PR 10 — Status-pill contrast helper.** `accessibility-02` + `field-ergonomics-04` (one accessible pill helper + Success button).

### Group C — states + first-run activation

11. **PR 11 — Skeleton adoption.** `states-02` + `states-03` + `states-06` + `heuristics-04`.
12. **PR 12 — Error-banner component.** `states-01` + `states-07` + `states-04`.
13. **PR 13 — First-run path.** `journeys-01` + `journeys-04` + `heuristics-09`.
14. **PR 14 — Context-help mount + content audit.** `heuristics-01` + `heuristics-08` + `microcopy-03` + `microcopy-01`.

### Group D — colour codemod + remaining polish (multi-day, post-beta-OK)

15. **PR 15+ — Semantic-colour codemod.** P1 `design-system-conformance-03` (source-of-truth constants first, then the 239-file long tail) + `design-system-conformance-04/05/06/07`, `heuristics-03`, `states-08`, `states-09`.
16. **Opportunistic singletons:** `heuristics-02/06/07/10/11`, `field-ergonomics-01/02/08/09/11`, `forms-04/05/07/09/10`, `accessibility-07/10`, `states-05/10`, `microcopy-05/06/09`.

---

## Merge-group ledger (deduped / cross-referenced findings)

Overlapping findings were kept distinct in the detail file (each is independently true and confirmed) but are merged for execution so one PR closes them together. Strongest framing is noted.

| Merge group | Canonical finding (strongest framing) | Folds in | Why merged | Cross-ref |
|---|---|---|---|---|
| **MG-1 Violet token** | `design-system-conformance-01` (P0) | `field-ergonomics-03` (P2), `design-system-conformance-08` (P3, bg/radius), partial of `accessibility-08`/`field-ergonomics-05`/`accessibility-01` | All resolved by the single `index.css` token rewrite. `dsc-01` is the design-system framing; `fe-03` is the field-surface framing of the same token. | Group A / PR 1 |
| **MG-2 Field bottom-sheet a11y** | `accessibility-03` (P1) | `field-ergonomics-07` (P2) | Same `BottomSheet.tsx` component; `acc-03` cites the 6 diary sheets, `fe-07` the ITP item sheet — identical fix. | Group A / PR 4 |
| **MG-3 Context-help wiring** | `heuristics-01` (P2) | `microcopy-03` (P3), `heuristics-08` (P3, stale content), `microcopy-01` (P3, portal expansion) | All stem from `HELP_CONTENT` being built but mounted on one page; mounting it + a content audit closes all four. | Group C / PR 14 |
| **MG-4 Focus ring 1px→2px** | `accessibility-06` (P2) | `design-system-conformance-10` (P3) | Identical `ring-1` override on the same primitives (`button.tsx`/`input.tsx`/`native-select.tsx`) + landing CTAs. | Group B / PR 7 |

Additional cross-references (NOT merged — distinct fixes, related theme):
- **Status-colour consistency** runs through `heuristics-03`, `design-system-conformance-03/04`, `states-08`, `accessibility-02`, `field-ergonomics-04`. The colour *values* are the codemod (MG in Group D); the *contrast* fixes are the pill helper (PR 10).
- **Loading states** run through `states-02/03/06` and `heuristics-04` — one skeleton-adoption PR (PR 11).
- **Silent error handling** runs through `forms-03`, `states-04`, `microcopy-02/04`, `field-ergonomics-06` — the `extractErrorMessage`/`toast`/`isError` pattern (PR 5 + PR 12).
- **Swipe safety/feedback** runs through `field-ergonomics-09` and `states-09` — confirm-modal already exists; add hint + optimistic update + undo.
