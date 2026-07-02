# SiteProof v3 — Full Findings Detail

**Audited commit:** `origin/master @ 3cc0d37`
**Date:** 2026-06-08
**Companion files:** `00-EXECUTIVE-SUMMARY.md` (verdict), `01-prioritized-roadmap.md` (priority/sequence/merge-ledger), `02-design-system-conformance.md`, `03-external-research-pack.md`.

Every confirmed finding, grouped by dimension. Each carries: severity (post-verification), evidence, standard, location (relative to repo root), recommendation, effort, and the verifier's note. Cross-references to merged/related findings are inline. All locations were re-confirmed against `3cc0d37` by the verifier unless flagged.

---

## Heuristics (Nielsen)

### heuristics-01 — Context-help built for 14 pages, mounted on one; onboarding promises help that's absent
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `microcopy-03`, `heuristics-08`, `microcopy-01` (merge group MG-3)
- **Location:** `frontend/src/components/ContextHelp.tsx:13-298` (HELP_CONTENT); only consumer `frontend/src/pages/lots/LotsPage.tsx:179`; broken promise `frontend/src/components/OnboardingTour.tsx:63`
- **Standard:** Nielsen H10 Help & documentation; WCAG 2.2 SC 3.2.6 Consistent Help (A); H4 Consistency.
- **Evidence:** HELP_CONTENT defines rich help for lots, itp, hold-points, tests, ncr, diary, dockets, claims, costs, documents, subcontractors, reports, dashboard, projects. Repo-wide grep for `ContextHelp` returns only the component + `LotsPage.tsx:179`. So 13 of 14 topics are unreachable. The OnboardingTour final step tells every new user "Click the help icon (?) on any page for context-specific guidance" — but the per-page help icon exists only on the Lot Register.
- **Recommendation:** Mount `<ContextHelp>` in the header of every screen with a HELP_CONTENT key, keying off the existing `useContextHelp(pageKey)`. Mostly wiring — content is written. Until done, edit the OnboardingTour copy so it doesn't promise an absent icon.
- **Verifier note:** Confirmed. HELP_CONTENT defines 14 page keys; only consumer is LotsPage.tsx:179; `useContextHelp` (line 354) has zero importers. OnboardingTour.tsx:63 promise is live (mounted at ProtectedAppShell.tsx:51, gated by localStorage). A sidebar "Help & Support" → /support is a separate global page, not the per-page icon. Corrections: 14 keys (13 unreachable), not "16/15 of 16"; fix is largely wiring. P2 (working global help + keyboard shortcuts exist), not P1.

### heuristics-02 — Dashboard "Team Members" KPI tile permanently renders an em-dash
- **Severity:** P2 · **Effort:** S
- **Location:** `frontend/src/components/dashboard/DashboardKpiTiles.tsx:78-81`
- **Standard:** Nielsen H1 Visibility of system status; H8 Aesthetic & minimalist (no dead UI).
- **Evidence:** The fourth KPI tile is hardcoded `<p className="text-2xl font-bold">—</p>` for "Team Members". The other three bind to real `stats`. It's still a clickable button navigating to /company-settings. On the first authenticated screen, one of four headline metrics is visibly empty.
- **Recommendation:** Wire to a real count (`/api/company/members` returns `members[]`) or remove the tile until the number exists.
- **Verifier note:** Confirmed (tile block 67-82; em-dash at 79). DashboardStats (DashboardPage.tsx:43-50) and props (3-8) carry no team-member field, so it can never show a number. A committed test (DashboardKpiTiles.test.tsx:29) asserts the '—', confirming intended-shipped. Real count trivially available. P2 (cosmetic/dead-UI credibility defect; tile still navigates), not P1.

### heuristics-03 — 3+ divergent status colour/label maps across screens, several weak-contrast
- **Severity:** P3 · **Effort:** M · **Cross-ref:** `design-system-conformance-03/04`, `states-08`
- **Location:** `frontend/src/pages/dockets/docketActionData.ts:18-32` vs `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:47-61` vs `frontend/src/pages/ncr/constants.ts:7-14` vs `frontend/src/pages/lots/lotsPageDisplay.ts:2-8`
- **Standard:** Nielsen H4 Consistency; WCAG 2.2 SC 1.4.3 / 1.4.1.
- **Evidence:** The same docket status renders differently by viewport (desktop yellow/amber vs mobile amber/emerald); NCRs use a third palette; lots a fourth (Okabe-Ito). A foreman sees one colour language on mobile, another on desktop for the identical docket.
- **Recommendation:** Centralise one status→{label, className, icon} map per domain (extend `lib/statusLabels.ts` to colours); import in both table and mobile card. Replace yellow/amber pairings if pushing to higher contrast.
- **Verifier note:** All four maps exist at cited lines; the consistency issue is real and `statusLabels.ts` documents the maps "mirror" a shared source. Downgraded from P1: the WCAG contrast sub-claim is wrong (yellow-800-on-yellow-100 and amber-800-on-amber-100 both ~7:1, above 4.5:1); the label text always accompanies colour so 1.4.1 is satisfied; nothing blocked → P3.

### heuristics-04 — Inconsistent loading affordance (bare spinners vs skeletons)
- **Severity:** P3 · **Effort:** M · **Cross-ref:** `states-02`, `states-03`
- **Location:** Spinners: `frontend/src/pages/DashboardPage.tsx:255-265`, `frontend/src/pages/ncr/NCRPage.tsx:92-103`, `frontend/src/pages/lots/components/ITPChecklistTab.tsx:160-166`. Skeletons: `frontend/src/pages/lots/LotsPage.tsx:274-297`, `frontend/src/pages/subcontractor-portal/SubcontractorDashboard.tsx:237-253`
- **Standard:** Nielsen H1, H4; skeletons-over-spinners.
- **Evidence:** LotsPage/SubcontractorDashboard render shaped skeletons; Dashboard/NCR/ITP-checklist fall back to a single centred `animate-spin`. Same event, two treatments; the spinner pages are the data-dense ones where skeletons help most.
- **Recommendation:** Standardise on skeletons for full-page content loads (reuse Skeleton primitive + the LotsPage table-skeleton pattern); reserve the bare spinner for inline waits.
- **Verifier note:** All 5 locations confirmed verbatim. Broader than stated — ITPPage.tsx:316-319 also uses a bare spinner while subbie DocketsListPage.tsx:151-161 uses Skeletons. Skeleton primitive exists. Downgraded P2→P3: every spinner page still shows an accessible loading state (role=status + aria-label); cosmetic.

### heuristics-06 — "Raise NCR" styled as destructive red, signalling danger for a routine create
- **Severity:** P2 · **Effort:** S · **Cross-ref:** `design-system-conformance` §7
- **Location:** `frontend/src/pages/ncr/NCRPage.tsx:121-126` (desktop, `variant="destructive"`); `:293-305` + `mainColor="bg-red-500"` (mobile FAB)
- **Standard:** Nielsen H2 Match to real world; H4 Consistency (create actions aren't destructive).
- **Evidence:** The primary create button is `variant="destructive"` and the FAB is `bg-red-500`. Everywhere else create uses primary (LotsPage "Create Lot" at 234). Red is the platform's delete colour. Raising an NCR is an encouraged compliance action — colouring it like delete breaks the button language and subtly discourages logging non-conformances.
- **Recommendation:** Use the default primary variant (keep an AlertTriangle icon if a severity cue is wanted). Reserve red for irreversible actions. Same for the FAB.
- **Verifier note:** Confirmed (122 destructive; 300/304 red FAB). button.tsx:13 destructive = bg-destructive (delete/danger). design-system.md:177 reserves Destructive for "final delete confirmations" and 120/264 mark red as the sacred status for "NCR Open/failed" — so red here violates the documented contract AND conflates the action with its negative outcome. P2 correct.

### heuristics-07 — Bulk lot status update commits to N lots with only a count, no preview
- **Severity:** P3 · **Effort:** M
- **Location:** `frontend/src/pages/lots/components/BulkActionModals.tsx:80-135` (BulkStatusModal); trigger `frontend/src/pages/lots/LotsPage.tsx:193-196`
- **Standard:** Nielsen H5 Error prevention; preview the effect of a bulk change before commit.
- **Evidence:** BulkStatusModal shows only "Update status for N lot(s)" + a dropdown, then commits. No list of affected lots, no transition preview. Selection can come from a long virtualised table; a mis-set status can flip lots into `completed`/`ncr_raised`, feeding compliance/claims. Bulk delete in the same file warns "cannot be undone"; bulk status gives less safety.
- **Recommendation:** List affected lot numbers (or count + expandable list), show current→new status; consider an undo toast.
- **Verifier note:** Confirmed (80-136; handler useLotsActions.ts:222-240 commits with no preview); LotTable is virtualised (rowVirtualizer LotTable.tsx:320); bulk delete warns (53-55). Downgraded P2→P3: status change is reversible (no data loss), applies only to explicitly-checked rows, already excludes locked conformed/claimed states (LotTable.tsx:346), management-gated.

### heuristics-08 — NCR contextual help describes a different status lifecycle than the app uses
- **Severity:** P3 · **Effort:** S · **Cross-ref:** `heuristics-01` (MG-3)
- **Location:** `frontend/src/components/ContextHelp.tsx:112-117` vs `frontend/src/pages/ncr/constants.ts:7-14`
- **Standard:** Nielsen H6 Recognition over recall; H2; H10 Help accuracy.
- **Evidence:** HELP_CONTENT.ncr lists "Open / Under Review / Corrective Action / Closed" (4 stages). The real set is open, investigating, rectification, verification, closed, closed_concession. A user reading the help learns labels and a stage count that don't exist in the UI.
- **Recommendation:** Rewrite the NCR help to the real lifecycle; audit other HELP_CONTENT entries before mounting (see heuristics-01).
- **Verifier note:** Confirmed (real set constants.ts:7-13, rendered via formatStatusLabel in NCRTable.tsx:170). Downgraded P2→P3 because HELP_CONTENT.ncr is currently mounted on no NCR surface (only LotsPage uses HELP_CONTENT.lots) — latent content debt to fix when help is wired up, not a live mismatch.

### heuristics-09 — DefaultDashboard has no first-run launchpad (all-zero KPIs, no primary next step)
- **Severity:** P3 · **Effort:** M · **Cross-ref:** `journeys-04`
- **Location:** `frontend/src/pages/DashboardPage.tsx:267-436` (blank-slate copy only at 427-434)
- **Standard:** B2B onboarding empty-state best practice; Nielsen H1.
- **Evidence:** With zero projects the page renders Total Projects 0, Active 0, Total Lots 0, Team Members —, plus empty widgets. No first-run "Create your first project" CTA; the attention widget returns null when empty.
- **Recommendation:** When `stats.totalProjects === 0`, replace the grid with a focused empty state + primary "Create your first project" (and secondary "Take the tour").
- **Verifier note:** Code matches (DefaultDashboard 110-439; no zero-projects branch). BUT premise is bounded: a brand-new self-signup owner has no companyId → CompanyOnboardingGate hard-redirects to /onboarding, then to /projects (NOT /dashboard). ProjectsPage already IS the launchpad ("No projects found" + "Create Project", 472-479). Reaching the zeroed dashboard needs off-path navigation. Also the cited OnboardingTour mitigation never auto-shows (AUTO_SHOW_GENERAL_ONBOARDING=false). Reasonable low-priority polish → P3.

### heuristics-10 — NCR page shows a persistent "Your role:" info banner (clutter, consistency outlier)
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/pages/ncr/NCRPage.tsx:164-172`
- **Standard:** Nielsen H8 Aesthetic & minimalist; H6.
- **Evidence:** Above the filters, an always-rendered banner reads "Your role: <role> (Can approve major NCR closures)". Persistent chrome competing with content; the qualifier is only relevant at major-closure time. No other index page carries an always-on role banner.
- **Recommendation:** Remove the standing banner; surface the major-closure hint inside the close/approve flow. If a global role indicator is wanted, put it once in the header.
- **Verifier note:** Confirmed (164-172; shows raw snake_case `userRole.role`, no humanisation). userRole fetched on mount from /api/ncrs/check-role/:projectId, non-null for any member. Grep confirms "Your role:" only on NCRPage. Close/approve permission already gated contextually in NCRTable (231-299), making the banner redundant. P3.

### heuristics-11 — Docket Approvals duplicates the pending count and buries the summary below the table
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/pages/dockets/DocketApprovalsPage.tsx:334-346` (header "Pending (N)") and `:383-400` ("Operational Summary" after the table)
- **Standard:** Nielsen H8; dashboards: most important numbers top-left, progressive disclosure.
- **Evidence:** The header shows "Pending (N)" as a filter button (344); the bottom "Operational Summary" repeats "Pending Approvals: N" + labour/plant hours (383-400). On a long list the summary numbers sit off-screen while the pending count appears twice. Mobile (DocketApprovalsMobileView.tsx:211-226) puts stats inline at top — desktop/mobile disagree on placement.
- **Recommendation:** Move the labour/plant/pending summary above the table (or into the header row); drop the duplicated count; align desktop with the mobile inline-stats pattern.
- **Verifier note:** Confirmed (344 filter button; 383-400 summary after table repeating pendingCount at 389; mobile inline stats at 211-226). Genuine but minor P3: the buried-summary half is sound; "duplicated count" is overstated (a filter-badge count + a KPI metric is an accepted pattern); nothing broken, no design-doc contradicted.

---

## Accessibility (WCAG 2.2)

### accessibility-01 — Border/input token 1.27:1; every field outline/divider effectively invisible (fails 1.4.11)
- **Severity:** P2 · **Effort:** S · **Cross-ref:** token PR (`design-system-conformance`)
- **Location:** `frontend/src/index.css:32-33` (`--border`/`--input` 240 5.9% 90%); consumed by `frontend/src/components/ui/input.tsx:11`, `native-select.tsx:12`, `card.tsx`, every bordered table/list
- **Standard:** WCAG 2.2 SC 1.4.11 Non-text Contrast (AA, 3:1).
- **Evidence:** From the HSL tokens, `--border`/`--input` vs `--card` (white) = 1.27:1 and vs `--background` (98%) = 1.21:1 — far below 3:1. Input/NativeSelect/Card all render this token, so the outline of every field/select and the divider of every table/card is sub-threshold. On a sunlit phone these disappear.
- **Recommendation:** Darken `--border`/`--input` (and `.dark`) until they clear 3:1 against card/background. Keep at the token layer.
- **Verifier note:** Confirmed (consumed by input.tsx:11, native-select.tsx:12, card.tsx:9, ~207 files via dividers; index.css:83-84 applies border-border to *). HSL math reproduces 1.27:1 / 1.21:1, and dark mode also fails (1.19:1 / 1.34:1). design-system.md (68-69) supports darkening. Two corrections → P2: (1) the suggested "L80% ≈ 3:1" is wrong — L80% only ~1.65:1; a real 3:1 needs ~L58-60% (zinc-400/500); (2) borders are faint, not invisible — inputs retain layout/padding/placeholder + a 3:1 violet focus ring. Degraded-affordance, pre-existing, non-blocking → P2.

### accessibility-02 — White-on-amber/green/red status pills 2.1–3.8:1 (fails 4.5:1)
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `field-ergonomics-04`
- **Location:** `frontend/src/components/foreman/ForemanBottomNavV2.tsx:183-184,191-194`; `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:182-186` (amber-500 count); `frontend/src/components/ui/button.tsx:17-18` (success = green-600 white)
- **Standard:** WCAG 2.2 SC 1.4.3 (AA, 4.5:1 normal text); field 7:1 in sunlight.
- **Evidence:** White on amber-500 = 2.15:1, green-500 = 2.28:1, red-500 = 3.76:1, green-600 = 3.30:1 — all below 4.5:1. The amber-500 pending-count badge (DocketApprovalsMobileView:183) carries the number a foreman scans at 7am.
- **Recommendation:** Use -600/-700 shades (white on amber-700 ≈ 4.9:1, red-700 ≈ 5.9:1, green-700 ≈ 4.5:1) or the dark-text-on-light-fill pattern already used in DocketApprovalsMobileView's statusColors (amber-800/amber-100 = 6.37:1). One accessible pill helper + the success button.
- **Verifier note:** Confirmed. Real instances: DocketApprovalsMobileView.tsx:183 (amber-500/white = 2.15:1), ForemanBottomNavV2.tsx:192 (red-500/white = 3.76:1), button.tsx:18 (green-600/white = 3.30:1). Math matches. Fix is mandated by design-system.md (124/185 pills = 100-bg/800-text; 178/85 Success should be emerald-700). Two inaccuracies: (a) the amber-500 in ForemanBottomNavV2 at 128 is a non-text 2×2 ping dot, and its "pending sync" text sits on the COMPLIANT amber-100/amber-800 banner (6.37:1) — so no amber-500 pill at 183-194 there, only the red-500 badge; (b) elements are short bold count badges, not body copy. Genuine AA failure + design drift, broad-and-mild → P2.

### accessibility-03 — Foreman BottomSheet (6 diary sheets): no dialog role, no focus trap/restore, unlabelled close (P1)
- **Severity:** P1 · **Effort:** M · **Cross-ref:** `field-ergonomics-07` (MG-2)
- **Location:** `frontend/src/components/foreman/sheets/BottomSheet.tsx:24-40` (wraps AddActivity/AddDelay/AddDelivery/AddManualLabourPlant/AddWeather/AddEvent)
- **Standard:** WCAG 2.2 SC 4.1.2 (A), 2.4.3 (A), ARIA APG Dialog; 4.1.2 for the close button.
- **Evidence:** Hand-rolled `<div className="fixed inset-0 z-50">` with no `role="dialog"`, no `aria-modal`, the `<h2>` title (33) not wired via aria-labelledby. Only Escape is handled (14-20); it never moves focus in, never traps Tab, never restores focus on close — keyboard/SR users fall behind the overlay. The close X (34-39) is icon-only with no aria-label, announcing as an empty "button". This is the field daily-diary capture path.
- **Recommendation:** Replace with the in-repo Radix Sheet/Dialog (role/modal/trap/restore for free), or add `role="dialog"` + `aria-modal="true"` + aria-labelledby, focus-in on open, Tab trap, focus-restore on close, and `aria-label="Close"`.
- **Verifier note:** Confirmed. Grep for role/aria/focus in the file returns zero matches. Rendered by all 6 diary sheets + MobileITPItemSheet. ui/dialog.tsx (`<span className="sr-only">Close</span>` at 47) proves the fix is viable. Multiple WCAG Level-A failures on the field path → P1 accurate.

### accessibility-04 — No `prefers-reduced-motion` handling
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/index.css:122-212` (enter/fadeInUp/slideUp keyframes, card-press, animate-in); `frontend/src/components/mobile/ContextFAB.tsx:42-98`; `frontend/src/components/foreman/SwipeableCard.tsx:139`
- **Standard:** WCAG 2.2 SC 2.3.3 (AAA) + vestibular-safety; design-system motion guidance.
- **Evidence:** Repo-wide, `@media (prefers-reduced-motion)` appears in zero CSS and `motion-reduce:`/`motion-safe:` zero times; only one JS hook is reduce-motion-aware. Yet index.css defines many always-on animations, ContextFAB injects its own keyframes, Header dropdowns scale/translate, and sonner toasts animate — none gated.
- **Recommendation:** Add a global `@media (prefers-reduced-motion: reduce){ *,*::before,*::after{ animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important; scroll-behavior:auto!important } }`; gate the ContextFAB injected keyframes the same way.
- **Verifier note:** Confirmed (index.css is the only css file; zero reduce-motion blocks; always-on animations + html{scroll-behavior:smooth}). ContextFAB.tsx:42-98 injects ungated keyframes; SwipeableCard.tsx:139 transition-transform; Header dropdown scale at layouts/Header.tsx:211-214; sonner + dropdown-menu animate-in ungated; only JS awareness useLotReadinessNavigation.ts:91. Genuine gap; the cited standard (2.3.3) is AAA and motion is short/small/mostly non-looping → P2 to P3.

### accessibility-05 — RHF+Zod field errors not programmatically linked to inputs (no aria-describedby/aria-invalid)
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `forms-08`, `forms-11`
- **Location:** `frontend/src/pages/ncr/components/CreateNCRModal.tsx:166-198` (representative); aria-describedby/aria-invalid appear in only 4 files (InviteSubcontractorModal, RecordPaymentModal, RecordCertificationModal, AccountDangerModals)
- **Standard:** WCAG 2.2 SC 3.3.1 (A) + ARIA21, SC 1.3.1 (A); 4.1.3 for announcement.
- **Evidence:** Repo-wide aria-describedby|aria-invalid returns 5 occurrences in 4 files, vs ~90+ files rendering Zod error text. In CreateNCRModal the input has neither attribute and the error `<p role="alert">` has no id. A SR user who tabs to the field isn't told it's invalid; the error is colour (red border) + an adjacent paragraph only. Multiply across NCR/lot/claim/test/holdpoint modals.
- **Recommendation:** Add a shared field wrapper (or extend Input/Textarea/NativeSelect) that sets `aria-invalid="true"` and `aria-describedby` to the error id when present. Keep `role="alert"`. One wrapper fixes every form.
- **Verifier note:** Confirmed (CreateNCRModal ~167-198). Repo-wide aria-invalid|aria-describedby = 5 hits in 4 files; shared primitives input/textarea/native-select.tsx are thin pass-throughs with no error-a11y, so the gap is structural (verified CreateLotModal, CreateTestModal, RequestReleaseModal all lack aria). Downgraded P1→P2: errors stay visible to sighted users via border+text, the existing role="alert" partially satisfies announcement, it blocks no task; breadth keeps it above P3.

### accessibility-06 — Interactive primitives override the 2px ring to 1px with no offset
- **Severity:** P2 · **Effort:** S · **Cross-ref:** `design-system-conformance-10` (MG-4)
- **Location:** `frontend/src/components/ui/button.tsx:8`; `input.tsx:11`; `native-select.tsx:12` — vs global `frontend/src/index.css:117-119` (ring-2 ring-offset-2)
- **Standard:** WCAG 2.2 SC 2.4.7 (AA); SC 2.4.13 strong focus (~2px); design-system rule.
- **Evidence:** index.css sets a good `:focus-visible { ring-2 ring-offset-2 }`, but Button/Input/NativeSelect hardcode `focus-visible:ring-1 ring-ring` with NO offset, which wins. The result is a 1px ring on the control's edge — easy to miss on filled buttons, and below the 2px strong-focus target. Button is the app's most-used control.
- **Recommendation:** Remove the per-component `ring-1` overrides (let global `ring-2 ring-offset-2` apply) or set `ring-2 ring-offset-2`. Verify a focused Button shows a ≥2px offset ring at ≥3:1.
- **Verifier note:** Confirmed (button.tsx:8, input.tsx:11, native-select.tsx:12 hardcode ring-1, no offset; global ring-2 at 117-119). Component utilities win via Tailwind utilities-layer precedence (the finding's "class specificity" wording is imprecise, outcome correct). tabs.tsx:32/47 and MobileDataCard.tsx:61 already use ring-2. Kept P2 not P1: a 1px violet ring (--ring still violet, ~5.71:1) is still visible so 2.4.7 passes; genuine gap is the weaker-than-2px strong-focus target (2.4.13).

### accessibility-07 — VoiceInputButton transcription/error not in an aria-live region; state by colour/animation
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/components/ui/VoiceInputButton.tsx:120-144`
- **Standard:** WCAG 2.2 SC 4.1.3 (AA), 1.4.1 (A), 3.3.1 (A).
- **Evidence:** The voice control shows "● Recording..." (120) and a live transcription preview (134-144) with no aria-live, so a SR user gets no announcement. The error panel (124-131) is a styled red div with no role="alert"/aria-live, so a mic-blocked failure is silent. Recording state is signalled by red bg + animate-pulse.
- **Recommendation:** Wrap the preview in `aria-live="polite"`, the error in `role="alert"`; add an `aria-pressed`/visible text state to the toggle.
- **Verifier note:** Confirmed (120/124-131/133-144 lack aria-live/role="alert"; adding them is consistent with existing usage — aria-live ×26, role="alert" ×179 elsewhere). The "colour only" 1.4.1 claim is overstated: the toggle label/icon swap between "Voice"/Mic and "Stop"/Square (107-117) and title changes, so on/off isn't purely colour — only the status pill is. Downgraded P2→P3: enhancement-only secondary input over fully-accessible textareas on all 5 sites, with a readable "Voice not supported" fallback.

### accessibility-08 — Violet primary text/links fail 4.5:1 in dark mode (4.19:1); muted-foreground marginal in light
- **Severity:** P2 · **Effort:** M · **Cross-ref:** token PR; `field-ergonomics-05`
- **Location:** `frontend/src/index.css:55` (.dark --primary 258.3 89.5% 66.3%), `:24` (--muted-foreground 240 3.8% 46.1%); `frontend/src/components/ui/button.tsx:20` (link = text-primary); text-muted-foreground used in ~278 files
- **Standard:** WCAG 2.2 SC 1.4.3 (AA, 4.5:1); field 1.4.6 (AAA 7:1).
- **Evidence:** Dark-mode --primary on the dark --card = 4.19:1, so violet text in dark mode (Button link variant, violet links, active labels) fails 4.5:1. Light-mode --muted-foreground = 4.83:1 on white / 4.62:1 on the actual --background (98%) — clears AA but well under the 7:1 field target, and it's the default secondary-text colour (~278 files).
- **Recommendation:** Lighten `.dark --primary` until violet text clears 4.5:1; darken `--muted-foreground` toward ~240 4% 38-40% so secondary text approaches 7:1.
- **Verifier note:** Confirmed. .dark --primary (#8b5cf6) = 4.18:1 on the dark --card #18181b; dark mode is reachable (tailwind darkMode:'class', theme.tsx defaults 'system', plus Header.tsx:170 toggle). --muted-foreground (#71717a) = 4.83:1 / 4.63:1, used in exactly 278 files. design-system.md prescribes an even darker --muted-foreground (240 5% 34%). Hard AA violation only in dark-mode violet; muted-fg half is sub-AAA/sunlight → P2 correct.

### accessibility-09 — Header dropdown menus are custom divs without focus management
- **Severity:** P2 · **Effort:** M
- **Location:** `frontend/src/components/layouts/Header.tsx:191-376` (project selector role=listbox + user menu role=menu)
- **Standard:** WCAG 2.2 SC 2.4.3 (A), 4.1.2 (A), ARIA APG Menu/Listbox.
- **Evidence:** Both menus are hand-rolled: triggers have good aria-expanded/aria-haspopup, but on open focus isn't moved into the menu (only the project search input is focused via setTimeout at 86-92; the user menu moves focus nowhere), no roving arrow-key nav, no Tab trap, and on close (Escape 112-121 / outside-click 95-109) focus isn't returned to the trigger. role=menu/listbox applied without the keyboard model. Top-of-app, every-session controls.
- **Recommendation:** Replace with the in-repo Radix `dropdown-menu`, or add focus-into-menu on open, arrow-key nav, Tab containment, focus-restore.
- **Verifier note:** Confirmed (project selector 191-268; user menu 293-376). components/ui/dropdown-menu.tsx is a real Radix wrapper (dep present). P2: items are still Tab-reachable buttons and keyboard-activatable with Escape-to-close, so it's a conformance/friction gap, not a hard keyboard block.

### accessibility-10 — SignaturePad bare `<canvas>` with no name/role and no non-pointer alternative
- **Severity:** P3 · **Effort:** M
- **Location:** `frontend/src/components/ui/SignaturePad.tsx:22-60` (canvasRef, pointer-only)
- **Standard:** WCAG 2.2 SC 4.1.2 (A), 2.1.1 (A), 1.1.1 (A).
- **Evidence:** The signature canvas is pointer/touch-only with no role, aria-label, or tabindex; the `label`/`required` props aren't associated via aria-labelledby. A SR announces nothing and a keyboard-only user can't sign.
- **Recommendation:** Give the canvas an accessible name (from `label`) + appropriate role; provide a "type your name to sign" fallback; expose required/empty state.
- **Verifier note:** Confirmed the canvas (193-207) has no role/aria-label/tabindex and is pointer-only, and its lone caller doesn't pass `label`. But impact overstated: SignaturePad is used in ONE place (holdpoints/RecordReleaseModal.tsx), NOT ITP/docket sign-off, and that modal offers keyboard-operable email/paper radio options (185-202) with file-upload evidence — so sign-off is NOT unusable to keyboard/AT; the canvas is needed only if the user picks 'digital'. Contained → P3.

---

## Design-system conformance

### design-system-conformance-01 — Violet primary/ring/chart tokens (the banned #1 AI-slop signal) (P0)
- **Severity:** P0 · **Effort:** S · **Cross-ref:** `field-ergonomics-03`, `design-system-conformance-08` (MG-1)
- **Location:** `frontend/src/index.css:6-43` (comment "High-Growth Startup: Violet + Zinc"; --primary/--ring/--chart-1 = 262.1 83.3% 57.8%; dark 55-74 = 258.3 89.5% 66.3%)
- **Standard:** design-system.md §4 (--primary zinc-950, --ring matches) + §3 Banned + §13 Don'ts (violet anti-pattern "we're replacing").
- **Evidence:** Shipped tokens are the unmodified shadcn violet starter. tailwind.config.js:23-26 maps bg/text/ring/border-primary to this var, so EVERY default Button (button.tsx:12), every link (link variant text-primary), the global focus ring (index.css:118), and the landing hero CTA + accent (Hero.tsx:23,34) render violet — the single biggest visual driver of the "B2C wellness app" look the spec kills, front-and-centre on the prospect's first screen.
- **Recommendation:** Replace the :root and .dark token block wholesale with §4 values: --primary/--ring 240 10% 3.9%, --background 0 0% 100%, --radius 0.375rem, and ADD --accent (amber 38 92% 50%), --success, --warning, --destructive (red-700), --info plus -foreground pairs. Recolour the 5 chart vars. One file, app-wide.
- **Verifier note:** Confirmed @3cc0d37 (comment line 6; tokens 17/34/38, dark 55/72/74). tailwind.config.js:18-26 maps; button.tsx:12/20; index.css:118. Hero renders violet but the file is components/landing/Hero.tsx (23/34) — the finding's "marketing/Hero.tsx" path is the only error. bg/text/ring-primary appears 111+ times across 40+ files. P0 upheld: documented top banned anti-pattern, buyer's first screen, single-file fix.

### design-system-conformance-02 — No font-family declared anywhere (falls back to the banned system stack)
- **Severity:** P2 · **Effort:** M
- **Location:** `frontend/src/index.css` (no @font-face/font-family/--font) + `frontend/tailwind.config.js` (no fontFamily) + `frontend/src/pages/LandingPage.tsx:16` (font-sans)
- **Standard:** design-system.md §5 (Geist Mono + Geist) + §3/§13 Banned (Inter/Roboto/Arial/system).
- **Evidence:** Whole-frontend grep for font-family/fontFamily/font-display returns zero design declarations — only two print-only Arial strings (PrintLabelsModal.tsx:127, LotQRCode.tsx:108). With no override, font-sans = Tailwind's default ui-sans-serif/system-ui, the generic sans the spec calls AI slop. No Geist/IBM Plex is loaded.
- **Recommendation:** Self-host Geist + Geist Mono, add @font-face, set theme.extend.fontFamily = { sans:['Geist',…], mono:['Geist Mono',…] }. Add font-feature-settings/tabular-nums on numeric columns. ~half a day.
- **Verifier note:** Verified (body rule 92-96 sets only bg/text/overscroll; theme.extend 16-106 has no fontFamily; LandingPage.tsx:16 font-sans; index.html loads no fonts; grep yields only the two Arial strings). §3 (33-37)/§13 (273) ban the stack; §5 (130-137) recommends Geist. No tabular-nums anywhere. Downgraded P1→P2: brand/identity polish (text is legible/functional), not a launch-impairing defect.

### design-system-conformance-03 — Status colour hardcoded as raw Tailwind palette in 239 files (1,468 occurrences) (P1)
- **Severity:** P1 · **Effort:** L · **Cross-ref:** `design-system-conformance-04/05/06/07`, `heuristics-03`, `states-08`
- **Location:** `frontend/src/pages/lots/constants.ts:41-76`; `frontend/src/pages/ncr/constants.ts:7-13`; `frontend/src/pages/tests/constants.ts:6-18`; +236 files (e.g. reports/components/LotStatusTab.tsx, portfolio/components/PortfolioSections.tsx, components/dashboard/ProjectDashboard.tsx)
- **Standard:** design-system.md §12 (semantic tokens) + §13 (status colours are sacred) + §4 status table.
- **Evidence:** A grep for raw palette utilities returns 1,468 matches across 239 files — essentially every status pill is a literal class, not a token. The canonical maps are themselves hardcoded (lots/constants.ts uses bg-green-100/red-100/yellow-100 and severityColors.major:'bg-red-500 text-white'; ncr/constants.ts:7-13 repeats them). Because --success/--warning/--info don't exist yet (finding 01), there is nothing to migrate TO — a global retint/dark-mode pass is impossible and statuses are inconsistent.
- **Recommendation:** After adding the tokens (finding 01), introduce a token-keyed colour map (extend `lib/statusLabels.ts`), migrate the per-domain constants first (lots, ncr, tests, dockets, holdpoints), then treat the 239-file tail as an incremental codemod. Multi-day.
- **Verifier note:** Confirmed. Verifier grep = 1,468 / 239 (finding said 1,453 — conservative). Source-of-truth maps verbatim (lots 41-76 incl. severityColors.major at 75; ncr 7-13; tests 6-18). "Nothing to migrate TO" holds (:root defines only --destructive; tailwind maps no success/warning/info). Spec cites accurate; recommendation sound. P1 not P0 (status colours currently render correctly — no user-facing breakage). Minor overstatement: a slice are non-status uses (print CSS, charts, AI-confidence borders, dev RoleSwitcher).

### design-system-conformance-04 — Mobile vs desktop docket approvals: different colours for the same status (emerald vs green)
- **Severity:** P3 · **Effort:** S · **Cross-ref:** `design-system-conformance-03`, `heuristics-03`, `states-08`
- **Location:** `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:47-53` vs `frontend/src/pages/dockets/docketActionData.ts:18-24` (imported by DocketApprovalsTable.tsx:4 + DocketActionModal)
- **Standard:** design-system.md §12 (sacred status colours) + Nielsen H4 + WCAG note.
- **Evidence:** `approved` renders bg-emerald-100/emerald-800 on mobile (50) but bg-green-100/green-800 on desktop (21); `pending_approval` amber on mobile (49) but yellow-100 on desktop (20). docketActionData.ts:16 even documents the split as deliberate. Hero daily-habit flow, so a foreman switching phone↔desk sees inconsistent colours. Mobile also uses rounded-xl (108) vs spec rounded-md.
- **Recommendation:** Delete the private mobile maps, import the shared map (which should point at the new tokens); change the mobile card rounded-xl→rounded-md.
- **Verifier note:** Confirmed (mobile 50/49 emerald/amber; desktop 21/20 green/yellow; deliberate-split comment at 16; mobile card rounded-xl 108). Downgraded P1→P3: a two-source (not "three") cosmetic divergence between adjacent hues that both map approved→success and are legible 100/800 pills, so the §12 semantic rule is honoured on both sides. Minor mis-cites: "sacred" rule is §12; rounded-md cards are §7.

### design-system-conformance-05 — Banned bespoke palettes (civil/safety/lot) still in tailwind.config.js
- **Severity:** P3 · **Effort:** M
- **Location:** `frontend/tailwind.config.js:51-75` (civil 50-900 ramp, safety.orange/yellow/green/red, lot.open/hold/closed/failed)
- **Standard:** design-system.md §13 ("Replace civil, safety, lot palettes with semantic tokens").
- **Evidence:** tailwind.config.js still defines safety.orange '#f97316', safety.green '#22c55e', safety.red '#ef4444', lot.hold '#f97316', lot.failed '#ef4444', and a full civil-50…900 ramp — keeping the door open for competing class usages.
- **Recommendation:** Grep for civil-/safety-/lot- usages, migrate to semantic tokens (finding 01), then delete the three blocks.
- **Verifier note:** Confirmed (52-75, exact hexes; §13 line 277 says delete them). Severity inflated to P2: safety.* and lot.* are entirely unused (zero call-sites incl. template literals); civil-* used only in AuthLayout.tsx:5,9. Tailwind emits no CSS for unused tokens → no current fragmentation. Strictly downstream of finding 01. Real but P3 config housekeeping.

### design-system-conformance-06 — Button `success` hardcodes green-600; `ghost` variant exists/used
- **Severity:** P3 · **Effort:** M
- **Location:** `frontend/src/components/ui/button.tsx:17-20` (success: bg-green-600 … ring-green-600; ghost: hover:bg-accent)
- **Standard:** design-system.md §7 (Success uses bg-success; "No ghost buttons except `<X>` dismissals").
- **Evidence:** The shared Button hardcodes success as bg-green-600 hover:bg-green-700 ring-green-600 (18) rather than bg-success, so the docket approval CTA can't be retuned centrally. A ghost variant is defined (19) and used broadly despite §7 restricting ghost to icon dismissals.
- **Recommendation:** Change success to bg-success text-success-foreground hover:bg-success/90 ring-success once the token exists (finding 01). Audit ghost usages.
- **Verifier note:** Confirmed (18 hardcodes; no --success token / no success colour in tailwind). Core gap real but cosmetic/maintainability-only and blocked on finding 01. The ghost half is overstated: sampling the 48 usages (27 files) shows they're overwhelmingly `variant="ghost" size="icon"` (the permitted icon-dismissal case), not systemic hierarchy erosion. P2 inflated → P3.

### design-system-conformance-07 — Landing hardcodes raw hex via arbitrary classes next to the violet primary
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/components/landing/Hero.tsx:18` (bg-[#f97316]), `:52`, `:56` (text-[#10b981]); 9 arbitrary `[#…]` across 5 landing files; 44 literal hex across 11 files incl. charts/ClaimsCharts.tsx:16
- **Standard:** design-system.md §12 (semantic tokens) + §4 (amber = accent/warning, emerald = success).
- **Evidence:** Hero pairs the violet bg-primary CTA with a raw bg-[#f97316] pulse dot and raw text-[#10b981] check icons — orange and emerald inlined as arbitrary hex on the public marketing page. These bypass tokens entirely (ignore dark mode + future palette change) and sit next to the violet primary.
- **Recommendation:** Replace bg-[#f97316] → bg-accent, text-[#10b981] → text-success on Hero and the other landing components; convert chart hex to chart vars. After tokens exist.
- **Verifier note:** Confirmed (Hero 18/52/56; 9 arbitrary [#..] across Hero/FinalCTA/RoleBasedBenefits/Pricing/MobileShowcase; ClaimsCharts hex — verifier counted 18, finding 16). Two caveats lower severity: (1) the literal fix is unsound as written — --accent is currently zinc-100 grey, not amber, and no success/warning utilities exist, so bg-accent renders grey and text-success/warning are no-ops until tokens land; (2) cosmetic-only on a decorative marketing page, pre-launch. P2 overstates → P3.

### design-system-conformance-08 — Background off-white (98%) and radius 0.5rem vs spec pure-white + 0.375rem
- **Severity:** P3 · **Effort:** S · **Cross-ref:** token PR (MG-1)
- **Location:** `frontend/src/index.css:8` (--background 0 0% 98%), `:36` (--radius 0.5rem)
- **Standard:** design-system.md §4 (--background 0 0% 100%; --radius 0.375rem "6px — slightly tighter than current 8px") + §8 ("Buttons: no shadow").
- **Evidence:** Shipped --background is 98% grey, --radius 0.5rem (8px) — the exact value the spec calls out to replace. The bordered-card-on-pure-white model depends on true white; off-white + shadcn default shadows on Button (12 shadow, 13 shadow-sm) softens the flat industrial look.
- **Recommendation:** Set --background 0 0% 100% and --radius 0.375rem in the token rewrite (finding 01); drop shadow/shadow-sm on non-modal button variants per §8.
- **Verifier note:** Confirmed (8/36; §4 lines 65/95; §8; button.tsx 12-18). All claims accurate. Cosmetic deviation, negligible user impact → P3 (the least impactful slice of the token drift; same :root still ships the banned violet --primary at line 17).

### design-system-conformance-10 — Focus ring weakened to ring-1 on buttons and landing CTAs
- **Severity:** P3 · **Effort:** S · **Cross-ref:** `accessibility-06` (MG-4)
- **Location:** `frontend/src/components/ui/button.tsx:8` and `frontend/src/components/landing/Hero.tsx:34,41` — vs global `frontend/src/index.css:118`
- **Standard:** design-system.md §8/2.4.7 + WCAG 2.2 SC 2.4.13 (strong focus ~2px, ≥3:1).
- **Evidence:** index.css:118 sets a global 2px ring, but Button overrides to focus-visible:ring-1 (8) and the landing CTAs do the same (Hero 34/41). A 1px ring is the common way the strong-focus target collapses; combined with the violet ring colour, keyboard focus on the primary control is thin and off-brand.
- **Recommendation:** Change Button's ring-1→ring-2 (with offset) to match the global rule; update the hand-rolled landing CTAs to ring-2; ensure the ring colour is the new zinc --ring.
- **Verifier note:** Confirmed (button.tsx:8 + input/textarea/native-select share ring-1; Hero 34/41 ring-1; global ring-2 at 118; --ring violet at 34). Real but trivial: a 1px ring still satisfies 2.4.7 (AA); the spec citation is imprecise (§8 is Depth/Elevation; the doc never specifies a focus-ring width). Genuine issue is internal inconsistency + thin/off-brand focus → P3.

---

## Field ergonomics

### field-ergonomics-01 — Two offline/sync systems show the foreman contradictory pending counts; nav hides failed/conflicted
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `field-ergonomics-02`, `states-04`
- **Location:** `frontend/src/hooks/useOnlineStatus.ts:7-44` (used by ForemanBottomNavV2.tsx:70,114-138) vs `frontend/src/lib/useOfflineStatus.ts:26-160` (used by components/OfflineIndicator.tsx:40-124)
- **Standard:** Nielsen H1; offline must be visible & per-item (silent-data-loss anti-pattern); calm sync state.
- **Evidence:** The bottom nav (the 7am surface) calls useOnlineStatus, exposing only {isOnline, pendingSyncCount} where pendingSyncCount = getPendingSyncCount() — a raw count INCLUDING dead-lettered items past MAX_SYNC_ATTEMPTS (ForemanBottomNavV2.tsx:130 renders "{pendingSyncCount} pending sync"). The floating OfflineIndicator uses useOfflineStatus whose pendingSyncCount = getLiveSyncCount() (EXCLUDES dead-lettered) and surfaces failedSyncCount + conflictCount with Retry/Resolve (78-92,63-74). Net: the nav can read "3 pending sync" forever while those 3 are dead-lettered, and the nav has no failure/conflict signal.
- **Recommendation:** Make the bottom-nav strip consume useOfflineStatus (live pending + failed + conflict), or delete its counter and rely on one indicator. At minimum stop counting dead-lettered as "pending" and surface "N failed - tap to retry" / "N conflict - resolve" inline.
- **Verifier note:** Confirmed. pendingSyncCount = getPendingSyncCount() = offlineDb.syncQueue.count() (offline/syncQueue.ts:22-24) — raw, includes dead-lettered. getLiveSyncCount() excludes (28-31). Both co-render (OfflineIndicator mounted App.tsx:490; ForemanBottomNavV2 in MobileNav.tsx:169). Real visibility defect on the primary surface. Downgraded P1→P2: the failed/conflict info + Retry/Resolve is NOT entirely absent (co-rendered indicator carries it) and items only dead-letter after MAX_SYNC_ATTEMPTS. Recommendation sound.

### field-ergonomics-02 — Floating offline indicator (z-50) overlaps the bottom-nav corner tab
- **Severity:** P2 · **Effort:** S · **Cross-ref:** `field-ergonomics-01`
- **Location:** `frontend/src/components/OfflineIndicator.tsx:61` (fixed bottom-4 right-4 z-50); `frontend/src/components/foreman/QuickCaptureButton.tsx:100` (fixed bottom-20 right-4 z-50); mounted globally in `frontend/src/App.tsx:490` over ForemanBottomNavV2.tsx:113 (z-30)
- **Standard:** thumb-zone (bottom-right is primary real estate); WCAG 2.2 SC 2.4.11 Focus Not Obscured; Nielsen H5.
- **Evidence:** OfflineIndicator renders globally at bottom-4 right-4 z-50; the quick-capture FAB at bottom-20 right-4 z-50. Same gutter, same layer. When offline (normal field condition) the pill sits in the bottom-right thumb zone and, at z-50 over z-30, overlaps the bottom nav's right-most target — the foreman 'Lots' tab / the non-foreman 'Menu' button (MobileNav.tsx:332). A foreman reaching for Lots can hit the offline pill.
- **Recommendation:** Give nav/FAB/indicator an explicit z-scale (nav < FAB < indicator); anchor the indicator above the nav height (e.g. `bottom-[calc(4rem+env(safe-area-inset-bottom))]`) clear of the FAB column, or fold the offline state into the nav strip.
- **Verifier note:** Confirmed (OfflineIndicator z-50 globally via DeferredOfflineIndicator App.tsx:490; both navs z-30 — ForemanBottomNavV2.tsx:113 Lots tab; non-foreman nav at components/layouts/MobileNav.tsx:297, Menu at 332). The pill's band (~1rem–3.5rem) sits in the h-16 nav band; at z-50 over z-30 it obscures the rightmost target when offline — real 2.4.11-style obstruction. FAB-collision sub-claim overstated (FAB at bottom-20=5rem sits above with a gap; FAB only on foreman dashboard). Foreman nav already has its own in-nav offline strip, so foremen see two indicators. Downgraded P1→P2: obstruction partial (one corner tab), non-destructive, alternate nav exists.

### field-ergonomics-03 — Banned violet primary colours every primary field action
- **Severity:** P2 · **Effort:** S · **Cross-ref:** `design-system-conformance-01` (MG-1 — merged into P0)
- **Location:** `frontend/src/index.css:6-43`; `frontend/src/components/foreman/ForemanBottomNavV2.tsx:175` (capture FAB bg-primary); `frontend/src/components/foreman/MobileITPChecklistSections.tsx:36` (progress bar); `frontend/src/components/OfflineIndicator.tsx:109`
- **Standard:** design-system.md §3 (purple = #1 AI-slop signal) + §4 (--primary zinc-950); first-HC brand credibility.
- **Evidence:** index.css is still "Violet + Zinc". Because primary is the action colour, the foreman's central capture button, the ITP progress bar, the "Click to sync" control, the active nav tab, and focus rings all render violet — the most-seen field chrome is the one colour the spec forbids. Reads "B2C wellness app" to an HC buyer.
- **Recommendation:** Apply the design-system index.css tokens; update the stale comment. One-file token swap propagating to every field surface.
- **Verifier note:** Confirmed (tokens; capture FAB ForemanBottomNavV2.tsx:176; ITP progress bar at line 36 but file is foreman/MobileITPChecklistSections.tsx NOT the cited itp/ path; sync CTA OfflineIndicator.tsx:109/120). §3 line 42 / §4 line 77; spec (committed 2026-05-13) labels this "the violet anti-pattern we're replacing". Downgraded P1→P2: brand-credibility issue but cosmetic, single-file swap; only the ITP directory citation is wrong. Merged into the P0 token PR.

### field-ergonomics-04 — Field-critical text/labels fail 1.4.3 on white (amber hints; white-on-green/red swipe labels)
- **Severity:** P2 · **Effort:** S · **Cross-ref:** `accessibility-02`
- **Location:** `frontend/src/components/foreman/MobileITPChecklistSections.tsx:190` (text-amber-600 'Photo req'); `frontend/src/components/foreman/SwipeableCard.tsx:30-31,115,130` (white on green-500/red-500); `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:322,327` (swipe icons on green-500/red-500)
- **Standard:** WCAG 2.2 SC 1.4.3 (AA 4.5:1); field 4.5:1 to survive sunlight.
- **Evidence:** text-amber-600 'Photo req' fails 4.5:1 on white. Swipe labels are white on green-500 (2.28:1) and the reject swipe white on red-500 (3.76:1) — under 4.5:1 for the small 'Approve'/'Reject' word, before glare.
- **Recommendation:** Darken to amber-700+/the warning token for text-at-large-size; swipe fills to green-700 (white = 5.02:1) and red-700 (6.47:1); keep icon AND word (1.4.1).
- **Verifier note:** Locations exist (amber-600 at 190, also 202; swipe labels SwipeableCard 30-31,115,130 + DocketApprovalsMobileView 322,327 — finding said 323,328, off by one). Config only extends Tailwind defaults, so real tokens are amber-600 #d97706 (3.19:1, NOT the cited #ca8a04/2.94:1 which is yellow-600), green-500 white 2.28:1, red-500 white 3.76:1 — all below the floor, so the 1.4.3 concern is genuine and green-700/red-700/amber-700 verifiably clear 4.5:1. The "white on amber-500 swipe label = 2.15:1" is unfounded (no swipe uses amber; that's the pending-count badge). Downgraded P1→P2: swipe labels are transient, icon-redundant, with a persistent button fallback (only green-600 Approve at 3.30:1 is marginal).

### field-ergonomics-05 — Secondary muted text clears AA by a hair (4.63:1), misses the AAA sunlight target the spec mandates
- **Severity:** P3 · **Effort:** S · **Cross-ref:** `accessibility-08`, token PR
- **Location:** `frontend/src/index.css:24` (--muted-foreground 240 3.8% 46.1%); pervasive e.g. DocketApprovalsMobileView.tsx:118,134-143, MobileITPChecklistSections.tsx:25,29
- **Standard:** WCAG 2.2 SC 1.4.6 (AAA 7:1) field target; design-system.md §4 comment ("240 5% 34% — darker for outdoor readability").
- **Evidence:** Current muted-foreground = 4.63:1 vs the live --background — scrapes past AA but fails 7:1. The spec explicitly calls for zinc-600 (240 5% 34% = 7.41:1) "for outdoor readability", so the code is behind its own standard. Every secondary label a foreman scans renders in this grey.
- **Recommendation:** Adopt the spec's --muted-foreground (240 5% 34%); part of the same token swap as field-ergonomics-03.
- **Verifier note:** Verified (4.63:1 vs background / 4.83:1 vs white; §4 line 68 specs 7.41:1; usages at DocketApprovalsMobileView 118/134/138/142 + MobileITPChecklistSections 25/29, in components/foreman/ not the cited dockets/itp paths; single-source, 278 files). Downgraded P2→P3: already clears AA; the "fails the standard" rests on aspirational AAA — low-risk one-token polish.

### field-ergonomics-06 — Capture GPS feedback is success-only; denied/pending/unavailable is silent
- **Severity:** P2 · **Effort:** S · **Cross-ref:** `microcopy-02`
- **Location:** `frontend/src/components/foreman/CaptureModal.tsx:281-286` (badge gated on `latitude &&`); GPS state from `frontend/src/hooks/useGeoLocation.ts:62-77`
- **Standard:** auto-stamp GPS + show it (Esri/FastField); Nielsen H1; clean exportable evidence.
- **Evidence:** CaptureModal renders only a positive 'GPS captured' pill, only when latitude is truthy (281). useGeoLocation exposes error ('permission denied'/'unavailable'/'timed out') + loading, but the modal discards them. When GPS is resolving/denied/unavailable (basements, steel) the foreman sees no badge and can't distinguish pending from off from un-stamped. The photo still saves with gpsLatitude undefined (154-155), silently producing un-geotagged NCR/ITP evidence.
- **Recommendation:** Show all three states: spinner 'Getting location…', green 'GPS captured (±Xm)' using the returned accuracy, amber 'No GPS — photo will save without location'; optionally retry via refresh().
- **Verifier note:** Confirmed (45 destructures only {latitude, longitude}; pill 281-286 gated on `latitude &&`; saves `gpsLatitude: latitude ?? undefined` at 154/213). useGeoLocation exposes error/loading/accuracy/refresh (11-17,62-91) with the exact strings. gpsError written to foremanMobileStore but no component reads it (dead write). The sibling QuickPhotoCapture.tsx:325-338 already shows a pending state + positive indicator, so CaptureModal is the inconsistent one. Genuine visibility/evidence-trust gap; P2 (capture still works, no data loss).

### field-ergonomics-07 — Core ITP inspection bottom-sheet lacks focus trap, dialog role, restore
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `accessibility-03` (MG-2)
- **Location:** `frontend/src/components/foreman/sheets/BottomSheet.tsx:11-50` (wraps MobileITPItemSheet.tsx:71 — the Pass/Fail/N-A surface)
- **Standard:** WCAG 2.2 SC 4.1.2 (A), 2.4.3, ARIA APG Dialog; 2.1.2 (a proper trap is allowed/required).
- **Evidence:** Plain `<div className="fixed inset-0 z-50">` with no role="dialog"/aria-modal/aria-labelledby. Handles Escape + backdrop-click (14-25) but never moves focus in, never traps Tab, never restores focus. This is the primary mobile ITP completion surface + several diary sheets. DocketActionModal.tsx:122-126 DOES set role/aria-modal/aria-labelledby, so the pattern exists in-repo.
- **Recommendation:** Add role="dialog" aria-modal="true" aria-labelledby; focus the sheet on open; trap Tab; return focus on close — mirroring DocketActionModal and the ARIA dialog APG.
- **Verifier note:** Confirmed (plain div 11-50; Escape 14-20, backdrop 25; sheetRef never focuses; no Tab containment/restore; `<h2>` 33 has no id). Consumed by MobileITPItemSheet + all six diary sheets. The in-repo counter-example is at pages/dockets/components/DocketActionModal.tsx:124-126 (not the path cited). A focus-trapping Modal/Dialog already exists in-repo. Genuine 4.1.2/APG gap; P2 — degrades keyboard/AT on a key surface but doesn't block the touch user and dismissal works. Merged with accessibility-03.

### field-ergonomics-08 — Filter pills and a few controls below 44-48px; share the swipe plane
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:196-208` (filter pills px-3 py-1.5 ≈ 30px); `frontend/src/components/foreman/CaptureModal.tsx:357-365` (Retry h-8 = 32px)
- **Standard:** WCAG 2.2 SC 2.5.8 (24px floor) / 2.5.5 (AAA 44px); 48-60px for gloves; swipe-vs-scroll conflict.
- **Evidence:** The docket filter pills are px-3 py-1.5 text-sm ≈ 30px in a horizontally scrollable strip (overflow-x-auto, 190) directly above the swipeable docket cards, so a gloved horizontal drag near the boundary can be ambiguous. The lots-error Retry is h-8 (32px).
- **Recommendation:** Bump filter pills + inline Retry/secondary buttons to min-h-11 (44px), increase inter-pill spacing, and visually/touch-separate the pill strip from the swipe-card list.
- **Verifier note:** Confirmed (pills 196-207 px-3 py-1.5 ~32px in overflow-x-auto 190; cards below wrapped in SwipeableCard 311-369 doing a translateX drag 51-95 — swipe-plane adjacency real; CaptureModal Retry h-8 357-364). Falls under the project's own 44px standard (design-system.md:161). Downgraded P2→P3: clears the WCAG 24px floor, mis-taps recoverable, and a stats bar (212-226) already separates pills from cards.

### field-ergonomics-09 — Swipe approve/reject has no Undo and is undiscoverable / not exposed to AT (mitigated by a confirm modal)
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `states-09`
- **Location:** `frontend/src/components/foreman/SwipeableCard.tsx:82-95` (threshold 100px); `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:315-330`; routed via `frontend/src/pages/dockets/DocketApprovalsPage.tsx:309-311` → openActionModal
- **Standard:** swipe is undiscoverable, pair with Undo; accidental taps; destructive = confirm OR salient undo; WCAG 1.4.1 / 4.1.2.
- **Evidence:** Swipe-right=Approve / left=Reject at 100px. Saving grace: swipe doesn't instantly commit — it opens DocketActionModal, and reject/query require a typed reason (79-82,488-491). But (a) no Undo after a confirmed approve, and approve is a single tap with hours pre-filled, so a rushed double-action can over-approve; (b) the affordance is invisible until offset>20 with no hint; (c) the gesture exposes nothing to AT. Explicit Approve/Query/Reject buttons exist (338-361).
- **Recommendation:** Keep the confirm modal; add a one-time swipe hint / persistent chevron + a time-boxed Undo snackbar after approve; keep the explicit buttons visible for AT.
- **Verifier note:** All confirmed (SwipeableCard 32,86-92; wiring 318-319; routing 309-311; reason 79-82,488-491; approve single-tap 48-49,478-504; no Undo; affordance hidden until offset>20 at 97-98,110,125; pure onTouch, no role/aria). Saving graces real: explicit ~44px buttons (336-362) give the AT/visible equivalent, so 4.1.2 is largely satisfied. The same un-hinted SwipeableCard is reused in NCRMobileList, LotMobileList, DiaryTimelineEntry. Residual-polish; P2 fair.

### field-ergonomics-10 — Foreman bottom-nav active tab signalled by violet colour alone; inactive labels borderline
- **Severity:** P3 · **Effort:** S · **Cross-ref:** token PR
- **Location:** `frontend/src/components/foreman/ForemanBottomNavV2.tsx:167,184-186` (active = text-primary vs text-muted-foreground, no shape/underline)
- **Standard:** WCAG 2.2 SC 1.4.1 (A); 1.4.3 (label contrast); recognition over recall.
- **Evidence:** The active tab differs only by colour (text-primary, violet) + a font-medium label bump; no underline/top-bar/filled pill/icon-fill. Inactive icon+label use text-muted-foreground (4.63:1) at text-xs/text-[10px], small and low-contrast in sun.
- **Recommendation:** Add a non-colour active indicator (top accent bar / filled icon background); lift inactive label contrast; pair with the token fix.
- **Verifier note:** Confirmed (active text-primary 167 + icon 184 + font-medium 186; inactive muted-foreground; --primary violet; --muted-foreground 240 3.8% 46.1%; mounted). The finding itself notes the font-medium bump, so a strict 1.4.1 reading is arguably met by that secondary cue + page content. Aligns with design-system.md (darken muted-foreground 68; drop violet 42/274). Real polish → P3.

### field-ergonomics-11 — Auto-camera can dead-end on cancel; shared CaptureModal gated foreman-only
- **Severity:** P3 · **Effort:** M
- **Location:** `frontend/src/components/foreman/CaptureModal.tsx:81-94` (150ms auto-click), `:96-113` (cancel), `:244-256` ('Opening camera...'); gating in `frontend/src/components/layouts/MainLayout.tsx:18-20,51-57`
- **Standard:** single-tap fire-and-forget (Esri); Nielsen H1 & User control; never dead-end.
- **Evidence:** On open the modal clicks a hidden `<input capture="environment">` after 150ms. If the OS sheet is dismissed, handleFileSelect calls onClose() (100-102) — fine. But the fallback 'capture' phase reads a perpetual 'Opening camera...' heading. Separately, the shared CaptureModal mounts at MainLayout only when userRole === 'foreman' (18-20,51), so site engineers/managers/subbies don't get the fast camera-first shell path.
- **Recommendation:** Replace the stale 'Opening camera...' heading with an explicit re-trigger state ('Camera closed — tap to retake'); consider mounting the shared CaptureModal for other field-capable roles.
- **Verifier note:** Code matches (auto-click 91; onClose 96-102; fallback 244-256; gating MainLayout 18-20,51-57). The "dead-end on cancel" half is overstated/a misread: the fallback is NOT a dead-end — it has a prominent primary "Open Camera" re-trigger (min-h-[48px]) + helper copy + Cancel; the only real nit is the stale heading. The foreman-only gating half IS genuine (every setIsCameraOpen(true) trigger is in foreman-only components; the lone general QuickPhotoCapture is unmounted), so site_manager + subbie portal get no fast camera path. Real but minor → P3.

---

## Microcopy

### microcopy-01 — Subbie portal labels compliance objects with bare acronyms; in-app glossary unreachable there
- **Severity:** P3 · **Effort:** S · **Cross-ref:** `heuristics-01` (MG-3)
- **Location:** `frontend/src/pages/subcontractor-portal/SubcontractorITPsPage.tsx:167` (h1 "ITPs"); `SubcontractorHoldPointsPage.tsx:167`; `SubcontractorNCRsPage.tsx:186`; `SubcontractorTestResultsPage.tsx:172`; vs `frontend/src/components/ContextHelp.tsx`
- **Standard:** self-explanatory taxonomy; subbies are the least-trained role.
- **Evidence:** Subbie portal h1s are raw acronyms ("ITPs", "Hold Points", "NCRs"). The main app expands these (ITPPage "Inspection & Test Plans", NCRPage "Non-Conformance Reports") and a glossary exists in ContextHelp, but grep across the subbie-portal folder for ContextHelp/HelpTooltip returns essentially nothing. The acronym is expanded for a subbie only in empty states + dashboard tiles.
- **Recommendation:** Expand the acronym at least once on each subbie page header; add a small info affordance reusing HELP_CONTENT. Keep empty-state expansions in the populated state too.
- **Verifier note:** Locations confirmed (167/167/186; ContextHelp glossary itp:41/hold-points:60/ncr:103 never imported in the portal; main app expands at ITPPage.tsx:225 / NCRPage.tsx:110). Premise exaggerated: portal tiles do NOT vanish on data — PortalQuickLinks (SubcontractorDashboardSections.tsx:46-101) gates each tile only on isPortalModuleEnabled and renders "ITPs — Inspection & Test Plans" / "NCRs — Non-conformance reports" every visit; "Test Results" isn't an acronym. Genuine residual gap (detail-page headers + no in-portal help affordance) → minor polish, P3.

### microcopy-02 — Foreman photo/NCR capture shows a bare "Failed to save" toast (hides reason, no recovery)
- **Severity:** P2 · **Effort:** S · **Cross-ref:** `field-ergonomics-06`
- **Location:** `frontend/src/components/foreman/CaptureModal.tsx:180` and `:221`
- **Standard:** NN/g form-error guidelines (identify + suggest a fix); WCAG 3.3.3 (AA); never lose a half-finished record.
- **Evidence:** Both catch blocks in the primary capture flow do `logError('Failed to save:', error); toast({ description: 'Failed to save', variant: 'error' })`. This throws away the server message — the codebase has `extractErrorMessage(error, fallback)` (lib/errorHandling.ts) used by nearly every other surface. "Failed to save" gives a gloved foreman no cause (offline? too big? permission?) and no next step.
- **Recommendation:** Use `extractErrorMessage(error, 'Could not save your photo. Check your connection and try again.')`; distinguish offline (queued — reassure) from a true failure (keep the file so the foreman can retry).
- **Verifier note:** Confirmed (handleSave catch 179-180; handleQuickSave catch 220-221). extractErrorMessage exists at errorHandling.ts:73, used across 84 files incl. the near-identical sibling QuickPhotoCapture.tsx (204-210/401-407) + DiaryFinishFlow.tsx:207 — CaptureModal is the lone outlier. Downgraded P1→P2: the dominant offline case is already handled (capturePhotoOffline writes to IndexedDB + reassuring NCR offline copy 158-174), so the bare toast only fires on a true storage/write failure.

### microcopy-04 — Foreman "Today" worklist collapses every backend error to "Unable to connect. Check your connection."
- **Severity:** P2 · **Effort:** S
- **Location:** `frontend/src/components/foreman/TodayWorklist.tsx:119`
- **Standard:** WCAG 3.3.1 (A) / actionable errors; offline vs server-error must be distinguishable.
- **Evidence:** Any `queryError` (403 no-access, 404 wrong project, 500 server fault, or a network drop) becomes "Unable to connect. Check your connection." A foreman removed from the project, or hitting a 500, is told to check their connection — they'll pointlessly toggle wifi/data on site. Inconsistent with the rest of the app (extractErrorMessage).
- **Recommendation:** Branch: keep the connection wording only for a true offline/network failure (navigator.onLine / fetch TypeError); else `extractErrorMessage(queryError, 'Could not load your worklist. Pull to refresh or try again.')`.
- **Verifier note:** Confirmed (119 is the sole occurrence app-wide; flattens any ApiError; the isOnline check 229-233 only appends a secondary offline line, so an online foreman hitting 403/500 still gets "check your connection" as the headline). Inconsistent with sibling ForemanDashboard.tsx:110 + 84 files using extractErrorMessage. P2 (misleading but read-only, retry affordance present, no data/security impact).

### microcopy-05 — Subbie ITP stat "Total ITPs" counts lots-with-an-ITP, not ITPs
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/pages/subcontractor-portal/SubcontractorITPsPage.tsx:175-177` (`<p>{lots.length}</p><p>Total ITPs</p>`); lots filtered at 102-104 to lots with ≥1 itpInstance
- **Standard:** labels must accurately name the value; don't mislabel aggregates.
- **Evidence:** `lots` is the list of lots containing ≥1 ITP instance, then the card renders `{lots.length}` under "Total ITPs". A lot can hold multiple instances, so the count is really "lots with ITPs". The same card set labels others "In Progress"/"Completed" off the same lot filter.
- **Recommendation:** Rename to "Lots with ITPs" (cheapest, accurate) or compute the real ITP-instance count; align In Progress/Completed.
- **Verifier note:** Confirmed (filter 102-104; value 175, label 176). Lot can hold multiple instances (112-118). Downgraded P2→P3: display-only on one mobile card, undercount only when a lot has 2+ ITPs, the In Progress/Completed labels are ambiguous rather than clearly wrong, and the "different number than the HC" claim is speculative.

### microcopy-06 — Subbie ITP "view only" notice abbreviates the role as "PM"
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/pages/subcontractor-portal/SubcontractorITPsPage.tsx:273` ("View only - contact PM for completion access")
- **Standard:** plain-language microcopy / no internal acronyms; subbies are champions, not power users.
- **Evidence:** On a subbie ITP card with no completion permission the copy uses "PM" — internal shorthand a subbie tradesperson may not parse. No expansion/tooltip. Elsewhere the portal correctly says "head contractor" (AcceptInvitePageSections.tsx:33).
- **Recommendation:** Replace "PM" with "the head contractor" or "the project manager".
- **Verifier note:** Confirmed verbatim (273, shown only when canComplete is false). Grep proves this is the ONLY bare "PM" in the whole portal; siblings spell it out — "Contact your project manager" (AssignedWorkPage.tsx:212, DocketEditPagePanels.tsx:186, SubcontractorDashboard.tsx:373/467) and "head contractor" (AcceptInvitePageSections.tsx:33). P3 ceiling; the dominant existing term is "project manager" (most consistent replacement).

### microcopy-09 — "Mark as Completed" project copy contradicts itself on whether a completed project is editable
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/pages/projects/settings/components/DangerZone.tsx:195` and `:396` vs `:189-211` the Reactivate path
- **Standard:** Nielsen H4 consistency; confirmation copy must state the real consequence.
- **Evidence:** The Complete section/dialog say "Completed projects remain accessible" / "remain accessible but indicate all work is finished" but never state whether completing locks editing (Archive explicitly says "read-only"). Because the same panel offers "Reactivate Project" to make it "active and editable again", the user is unsure whether completing restricts editing.
- **Recommendation:** State the exact effect (e.g. "Completed projects stay fully accessible and editable; this only flags the project as finished"), mirroring Archive's "read-only".
- **Verifier note:** Confirmed (195/396; Archive "read-only" 226/334; Reactivate "active and editable again" 194/390). Verified the backend PATCH (backend/src/routes/projects/writeRoutes.ts:236-322) only stores the status string and NO write path enforces read-only for EITHER archived or completed — "completed" is a soft flag with no functional effect. Cosmetic ambiguity on a rare admin-only action → P3 (borderline won't-fix).

---

## First-run journeys

### journeys-01 — First-run owner gets ZERO guided onboarding after creating a company — the built 9-step tour is hard-disabled
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `journeys-04`, `heuristics-09`
- **Location:** `frontend/src/components/layouts/ProtectedAppShell.tsx:15,40-45,51` (AUTO_SHOW_GENERAL_ONBOARDING=false → `<OnboardingTour enabled={false}/>`); component at `frontend/src/components/OnboardingTour.tsx:17-65,160-217`
- **Standard:** B2B onboarding (persistent setup checklist + fastest path to aha; 07-onboarding §4.2 steps, action #5); first-week abandonment is the dominant churn driver.
- **Evidence:** OnboardingTour is a complete 9-step walkthrough (progress bar, "Step N of M", skip, localStorage flag, route-driving), but ProtectedAppShell hard-codes `AUTO_SHOW_GENERAL_ONBOARDING = false`, so it mounts with `enabled={false}`. Grep finds no other mount. A brand-new owner is dropped on /projects then /dashboard with no tour, checklist, or "what to do next".
- **Recommendation:** Ship a first-run activation path: re-enable a trimmed tour or a short outcome-framed checklist (Create company ✓ → Create first project → Create first lot → Assign an ITP → Complete one checklist item) gated on `companyId && projectCount===0`. Measure first ITP completion, not tour completion. The component exists — wiring + a checklist.
- **Verifier note:** Confirmed (15/40-45/51; tour 17-65,160-217; the disabled mount is the only one; forceShow/useOnboarding have zero callers — dead code). Doc cite accurate (07-onboarding §4.2 step 17 + action #5/P1). Overstates "ZERO": after company creation the owner lands on /projects which shows a deliberate empty-state CTA ("No projects found / Create Project", ProjectsPage.tsx:472-479). What's missing is the guided multi-step checklist, not all guidance. Downgraded to P2: pre-launch, partial next-step path exists, no workflow/data/security harm; the doc's "P1" is a product-priority label, not a UX-defect severity.

### journeys-04 — New project's landing dashboard shows emptiness as metrics, buried setup CTA, misleading green 'all clear'
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `heuristics-09`, `journeys-01`
- **Location:** `frontend/src/components/dashboard/ProjectDashboard.tsx:276-330` (zeros ribbon), `:351-357` ('Create your first lot' buried), `:424-428` (green 'No non-conformances recorded')
- **Standard:** NN/g empty-states (teach + one prominent CTA, don't look 'done'); 07-onboarding §4.2 makes 'create first lot' the day-5 milestone.
- **Evidence:** After creating a project the user lands on ProjectDashboard (ProjectDetailPage.tsx:38). For zero-data it renders an 8-tile ribbon of 0/0%, a Lot Progress card whose ONLY CTA is a small inline text link 'Create your first lot' (354), a green checkmark 'No non-conformances recorded' (426 — semantically wrong: nothing to be conformant about yet), and 'No recent activity'. The critical first action is the least prominent element.
- **Recommendation:** For `lots.total===0`, promote a prominent primary 'Create your first lot' (+ secondary 'Assign ITP templates') to the top, and suppress/relabel the green 'No non-conformances' state until a lot exists ("Quality tracking starts once you add a lot").
- **Verifier note:** Verified all three locations (276-330, 351-357, 424-428; entry ProjectsPage.tsx:168 → /projects/{id} → ProjectDetailPage.tsx:38 → ProjectDashboard). The fix is in-repo-proven (the Lots page already renders this action as a real primary button with helper copy in LotTableSections.tsx:36-43); no design-doc contradicted. Downgraded P1→P2: path is non-blocking (lots reachable via the ribbon/sidebar; the link works) — a first-use activation/IA polish issue, not a broken flow.

### journeys-05 — Post-registration success screen doesn't tell the new owner the next step is to set up a company
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/pages/auth/RegisterPage.tsx:95-129` (success state: 'You can sign in now' + Go to Login); gate at `frontend/src/components/layouts/ProtectedAppShell.tsx:23`
- **Standard:** B2B onboarding (set expectations / reduce decision fatigue); WCAG 2.2 SC 3.2.6.
- **Evidence:** Registration returns the 'Account created' screen (verificationRequired=true by default, registrationRoutes.ts:244-247) offering only 'Go to Login' / 'Resend Verification', saying nothing about what happens after login. After login, CompanyOnboardingGate silently redirects to /onboarding (a screen they've never been told about). The 'account created' → 'create your company' → 'create your first project' handoff is undocumented.
- **Recommendation:** Add one line ('Next: sign in and set up your company — it takes about a minute') and/or a 'Continue to set up your company' primary button.
- **Verifier note:** Confirmed (success 95-129; verificationRequired default registrationRoutes.ts:247; user created with no companyId 162-177; CompanyOnboardingGate auto-redirects ProtectedAppShell.tsx:21-25 to the labelled CompanyOnboardingPage). Real expectation-setting gap, but the redirect is automatic and the destination is a clearly-labelled "set up your company" form → minor polish, P3.

---

## Forms & data entry

### forms-02 — Daily docket entry (the core daily-habit loop) is online-only — offline persistence exists but is NOT wired in (P1)
- **Severity:** P1 · **Effort:** L
- **Location:** `frontend/src/pages/subcontractor-portal/DocketEditPage.tsx:138-312` (ensureDocket/addLabourEntry/addPlantEntry go straight to apiFetch); unused module `frontend/src/lib/offline/dockets.ts:19-99` (createDocketOffline/submitDocketOffline/updateDocketOffline)
- **Standard:** offline-first default (Fieldpoint/FieldBoss; CLAUDE.md "#313 Offline Docket Creation"); offline is the default state; silent-data-loss failure mode.
- **Evidence:** createDocketOffline/submitDocketOffline/updateDocketOffline are fully implemented with a Dexie sync queue, but a grep for offline imports across src returns 24 files and NONE of the docket UI is among them — DocketEditPage never imports `@/lib/offline`. Every add-labour/add-plant/create/submit is a bare `await apiFetch(...)`. On a no-signal 7am site, `ensureDocket` throws and `addLabourEntry` shows 'Failed to add labour entry'. Photos (CaptureModal) and ITP completion (LotEditPage) ARE offline-wired; the gap is specifically the pay-affecting daily docket.
- **Recommendation:** Wire DocketEditPage's create/add/submit handlers through the existing offline functions when `!navigator.onLine` (or always, optimistic-first), surfacing a per-docket 'Saved on device / Syncing / N pending' state. The queue/conflict/sync worker is already built — integration, not new infra.
- **Verifier note:** Confirmed (ensureDocket 138-169, addLabourEntry 209-255, addPlantEntry 258-312 all bare apiFetch; offline funcs dockets.ts:19-99 referenced ONLY by their own test + the offlineDb barrel, never UI; apiFetch api.ts:132-167 has no offline path; with no signal addLabourEntry hits handleApiError and ensureDocket re-throws). Understates how built the rest is: syncWorker.ts:208-254 has a full syncDocket executor dispatched (459-462) via syncOfflineDocketDraft — pure UI integration. Downgraded P0→P1: online entry works and no data is lost/corrupted (just never captured). **Fix caveat: docket_submit deliberately does NOT auto-submit offline (forces online review) — wire create/add-draft offline but keep that submit constraint.**

### forms-03 — Diary add-row handlers swallow ALL failures with only logError — a failed row vanishes with zero feedback
- **Severity:** P2 · **Effort:** S · **Cross-ref:** `states-04`, `microcopy-02`
- **Location:** `frontend/src/pages/diary/components/ActivitiesTab.tsx:59-61`, `DelaysTab.tsx:59-61`, `PlantTab.tsx:50-52`, `PersonnelTab.tsx:133-135` (add); plus all four remove* handlers (e.g. ActivitiesTab.tsx:75-77)
- **Standard:** WCAG 3.3.1 (A); never lose a half-finished record / communicate failure; silent-data-loss anti-pattern; Nielsen H1.
- **Evidence:** Every diary add/remove handler ends with `catch (err) { logError('Error adding activity:', err); }` and nothing else — no toast, no inline error, no rollback flag. On a 500/network drop the form only clears on success (line 58), so the textarea looks 'stuck' and the user has no idea it didn't save. The same page's DiarySubmitSection.tsx (93-99,212-218) and PersonnelTab.copyPersonnelFromPreviousDay (209-216) DO toast — the pattern is known and omitted here. For a legal site record a silently-dropped row is a trust/compliance failure.
- **Recommendation:** Add an error toast (`toast({title:'Failed to add activity', description: extractErrorMessage(err,...), variant:'error'})`, already imported in PersonnelTab) to every add*/remove* catch; optionally keep the typed row on failure.
- **Verifier note:** Confirmed (all 8 handlers end with only logError — ActivitiesTab 59-61/75-77, DelaysTab 59-61/75-77, PlantTab 50-52/66-68, PersonnelTab 133-135/149-151). Inconsistency provable (PersonnelTab already uses toast+extractErrorMessage at 194-215; DiarySubmitSection toasts 95-99,214-218). No offline-queue wraps these (grep found none in diary). Downgraded P0→P2: error-path-only (happy path unaffected, no server-side corruption, typed input retained because the form only resets on success).

### forms-04 — No numeric keyboard on any diary number field
- **Severity:** P2 · **Effort:** S
- **Location:** `frontend/src/pages/diary/components/ActivitiesTab.tsx:170-178` (quantity), `DelaysTab.tsx:166-174` (duration), `PlantTab.tsx:153-161` (hours), `PersonnelTab.tsx`; grep for inputMode across pages/diary returns 0
- **Standard:** MDN/CSS-Tricks inputmode; mobile form best practice; one-thumb numeric entry; "match keyboard to data".
- **Evidence:** Diary quantity/hours/duration are `<input type='number'>` with NO inputMode. On Android type=number is unreliable and on iOS it doesn't guarantee the numeric pad for decimals; grep confirms ZERO inputMode in the diary folder. The Claims module does it right: RecordPaymentModal.tsx:125 uses `inputMode='decimal'`.
- **Recommendation:** Add `inputMode='decimal'` (or `'numeric'` for whole counts) to all diary number inputs (quantity, hours, duration, temperature, rainfall), matching RecordPaymentModal.
- **Verifier note:** Confirmed (all six diary number inputs are bare type="number" with no inputMode — ActivitiesTab 171, DelaysTab 167, PlantTab 154, WeatherTab 260/271/283; grep 0 matches; RecordPaymentModal uses inputMode="decimal"). Two nits: PersonnelTab start/finish are type="time" (correct) and its hours field is read-only, so "PersonnelTab time fields" over-reaches; type="number" already yields a numeric-ish keypad on most browsers. Decimal-pad reliability/polish gap → P1 to P2.

### forms-05 — Diary inline delete buttons: unlabelled icon-only AND immediate destructive DELETE, no confirm/undo
- **Severity:** P2 · **Effort:** M
- **Location:** `frontend/src/pages/diary/components/ActivitiesTab.tsx:119-136`, `DelaysTab.tsx:114-131`, `PlantTab.tsx:99-116`, `PersonnelTab.tsx:260-277 & 315-332`; grep for confirm/AlertDialog in diary/components finds none
- **Standard:** WCAG 4.1.2 (A) + 2.5.8; protect destructive actions (confirm OR undo); accidental-tap guidance.
- **Evidence:** Each row's delete is `<button onClick={() => removeActivity(a.id)}><svg.../></button>` — no aria-label/text (4.1.2 fail), and it immediately calls `apiFetch(..., {method:'DELETE'})` with no confirm/undo. The trash glyph is h-5 w-5 (20px) inside a button with no explicit min size — at/below the 24px target floor for a destructive control.
- **Recommendation:** Add an aria-label (e.g. `Remove ${p.name}`), enlarge the hit area to ≥44px, and gate behind a confirm dialog or undo snackbar.
- **Verifier note:** Confirmed (all five buttons bare with h-5 w-5 trash, no aria-label; each removeX fires DELETE immediately; grep finds only the SUBMIT confirm + a beforeunload string). Downgraded P1→P2 because the headline 'fat-finger on a phone' scenario is largely wrong: at <768px DailyDiaryPage returns the mobile layout (DiaryMobileView timeline) and these Tab components are NOT mounted, and the mobile timeline delete IS gated by a ConfirmDialog (DailyDiaryPage.tsx:138); so this is a desktop/mouse path (PersonnelTab's mobile-card branch 260-277 is effectively dead on a real phone), where losing one re-addable diary line is lower-risk.

### forms-07 — Labour docket time silently wraps overnight (finish<start +24h), wrong pay-affecting hours
- **Severity:** P2 · **Effort:** M
- **Location:** `frontend/src/pages/subcontractor-portal/docketEditHelpers.ts:8-15` (calculateHours: `if (hours < 0) hours += 24`); UI `frontend/src/pages/subcontractor-portal/components/DocketEntrySheet.tsx:106-127` + `:232-244`
- **Standard:** WCAG 3.3.1/3.3.3; inline validation; minimise pay disputes.
- **Evidence:** calculateHours treats finish≤start as overnight and silently adds 24h, so 7:00 start + a mistyped 5:00 finish (meaning 17:00) bills 22 hours, and the preview (237 `{previewHours} hours`) shows '22 hours' with no warning. No inline check that finish>start; the Add button only disables on missing lot / saving. Dockets feed progress claims and pay.
- **Recommendation:** Show an inline confirm/warning when finish≤start ('Looks like an overnight shift — is 22h correct?') or require an explicit 'overnight' toggle before wrapping.
- **Verifier note:** Confirmed (docketEditHelpers.ts:13 wraps; previewHours via useDocketEntrySheetState.ts:68-72 → DocketEntrySheet.tsx:237; Add button 251-255 + addLabourEntry DocketEditPage.tsx:209-217 gate only on employee/lot/saving). Backend offers no safety net (entryCalculations.ts:17-18 repeats the wrap; client lotAllocation hours unvalidated; only plant hours 0-24 capped). Real pay-affecting correctness gap on a subbie surface feeding claims. Downgraded P1→P2: the wrong value IS visible in the preview before submit and dockets pass a foreman/HC approval gate.

### forms-08 — Diary fields use placeholder-as-label with no visible/associated `<label>`
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `accessibility-05`, `forms-11`
- **Location:** `frontend/src/pages/diary/components/ActivitiesTab.tsx:151-185`, `DelaysTab.tsx:146-206`, `PlantTab.tsx:131-161`, `PersonnelTab.tsx:376-417`
- **Standard:** WCAG 3.3.2 (A) + 1.3.1; "Placeholders in Form Fields Are Harmful"; labels above the field.
- **Evidence:** The diary add-row forms use bare `<input placeholder='Description *'>`, `<input placeholder='Quantity'>`, `<select>` with `<option>Delay Type *</option>` and no `<label>` — the placeholder is the only label. Placeholders vanish on focus, fail contrast, and are unreliable for AT, so these forms have effectively no accessible field names. Compare CreateNCRModal.tsx:166 / CreateLotModal.tsx:263 (shadcn `<Label>`).
- **Recommendation:** Add a visible `<Label>` (or at minimum `aria-label`) per input, keep the format hint as helper text — reuse the NCR/Lot/Claims `<Label>` pattern.
- **Verifier note:** Confirmed (all four forms bare input/select with only placeholder names; no label/htmlFor/aria-label — ActivitiesTab 151-185, DelaysTab 146-206 incl. `<option value="">Delay Type *</option>`, PlantTab 131-161, PersonnelTab 376-417; CreateNCRModal 166 / CreateLotModal 263 do it right, under pages/ncr/components & pages/lots/components). Genuine 3.3.2/1.3.1 (A); recommendation sound. P1 inflated — usable for sighted users with a placeholder hint → P2.

### forms-09 — Diary weather autosave is a 60s timer that doesn't fire on in-app navigation; other tabs no draft buffer
- **Severity:** P2 · **Effort:** M
- **Location:** `frontend/src/pages/diary/components/WeatherTab.tsx:163-192` (60000ms timer + beforeunload only)
- **Standard:** autosave drafts so interruptions don't cost work; persist-form-state; WCAG 3.3.4.
- **Evidence:** WeatherTab autosaves only every 60s (171) and the only other protection is a beforeunload handler (183), which does NOT fire on React-Router client-side navigation, so switching tabs/pages within the 60s window silently discards typed weather notes. The other diary tabs have no dirty-state/draft buffer — an in-progress row is lost on navigation (rows persist only once 'Add' succeeds).
- **Recommendation:** Reduce the debounce (~5-10s after last keystroke) and add a React-Router navigation block (useBlocker/prompt) mirroring the beforeunload guard.
- **Verifier note:** Confirmed (60s setTimeout 171; beforeunload 183-192 doesn't fire on SPA nav; no useBlocker/usePrompt in the diary tree). DailyDiaryPage 204-254 conditionally renders tabs, so switching off weather unmounts WeatherTab and cleanup clears the timer; navigating off the diary page entirely loses unsaved notes with no prompt. Activities/Personnel/Plant/Delays hold the in-progress row in local useState + persist per-row. Bounded data-loss-on-interruption; explicit manual Save exists, loss capped at ~60s/one row → P2.

### forms-10 — Default Input height (h-9 / 36px) below the 44px field touch-target
- **Severity:** P3 · **Effort:** S · **Cross-ref:** `field-ergonomics-08`
- **Location:** `frontend/src/components/ui/input.tsx:11` (`h-9`); inherited by CreateNCRModal, CreateLotModal, all Claims modals; diary raw inputs use py-2 (~40px)
- **Standard:** WCAG 2.5.8 (24px floor) / 2.5.5 (AAA 44px); ≥44px for gloved hands.
- **Evidence:** The shared Input is h-9 (36px), the base control for every RHF form audited. 36px clears the 24px floor but is under the 44px field norm; the docket entry sheet had to override to h-12 (DocketEntrySheet.tsx:114) precisely because 36px is too small for gloved time entry. Diary raw inputs at px-3 py-2 are ~40px.
- **Recommendation:** Add a field/mobile size variant (h-10/h-11) and apply it on foreman/subbie-facing forms, so screens stop hand-overriding to h-12. Don't blanket-bump desktop management views.
- **Verifier note:** Confirmed (input.tsx:11 h-9, used in 49 files; DocketEntrySheet overrides to h-12 at 114/124/163/190/257; diary raw ~36-40px). Real gap vs the app's own 44px standard (design-system.md 161 & 252; .touch-target = min-h-[44px] index.css:204). Downgraded P2→P3: 36px clears the 24px floor, the most field-critical surface (docket entry) is already fixed, and a blanket bump on all 49 forms would fight the documented "Linear density, 40px rows" ethos — only the field/mobile variant path is sound.

### forms-11 — Required-field marking inconsistent across forms; several Zod errors not aria-live announced
- **Severity:** P3 · **Effort:** M · **Cross-ref:** `accessibility-05`, `forms-08`
- **Location:** Inconsistency: `MarkAsFailedModal.tsx:86` / `CreateLotModal.tsx:264` use a styled red span; `CreateNCRModal.tsx:166` uses a plain '*'; diary uses 'Description *' in the placeholder; `CreateNCRModal` error `<p>` at 174/195/279 have role='alert' but no aria-live (`CreateLotModal.tsx:278` does add aria-live='assertive')
- **Standard:** WCAG 3.3.1/3.3.2 + 4.1.3; Nielsen consistency; token consistency.
- **Evidence:** No single required-field convention: styled red asterisk via `<Label>`, unstyled inline '*' (NCR), or asterisk buried in the disappearing placeholder (diary). Error announcement is uneven — NCR error `<p>`s use role='alert' without aria-live; CreateLotModal adds aria-live='assertive'; diary error `<p>`s use aria-live but the fields aren't programmatically linked (no aria-describedby).
- **Recommendation:** Standardise a required marker (styled asterisk in `<Label>` + sr-only 'required'); ensure every dynamic message uses role='alert'/aria-live + aria-describedby+aria-invalid. Codify in design-system.md and the shared `<Label>`/`<Input>`.
- **Verifier note:** Confirmed (three conventions: styled red span MarkAsFailedModal 86 / CreateLotModal 264, ~13 uses across 10 files; unstyled '*' CreateNCRModal 166/180/267; placeholder asterisks ActivitiesTab 155 / DelaysTab 162 / PlantTab 135 / PersonnelTab 380; error announcement uneven; shared label.tsx has no required convention; design-system.md silent). One caveat: role='alert' already implies assertive live-region semantics, so the 'unannounced' framing is mildly overstated; the concrete defect is the inconsistency + placeholder-only marker. Cross-cutting polish/a11y, no broken flow → P3 (not the claimed P2).

---

## States (loading / error / empty)

### states-01 — Two divergent error-banner styles; the dominant one is light-only (broken in dark mode)
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `states-04`, `states-07`
- **Location:** `frontend/src/pages/lots/LotsPage.tsx:300-318`; `frontend/src/pages/projects/ProjectsPage.tsx:443-460`; `frontend/src/pages/ncr/NCRPage.tsx:131-153`; `frontend/src/pages/claims/ClaimsPageSections.tsx:60-80` (vs the token style in `frontend/src/pages/dockets/DocketApprovalsPage.tsx:349-361` and `frontend/src/pages/tests/TestResultsPage.tsx:359-373`)
- **Standard:** Nielsen H4; WCAG 1.4.3 / dark-mode legibility; design-system semantic-token rule.
- **Evidence:** Newer Query-pattern pages use dark-mode-aware tokens (`border-destructive/30 bg-destructive/10 text-destructive`), but high-traffic core pages hardcode light-only literals (`bg-red-50 border-red-200 text-red-700`). A grep found ~231 hardcoded light status backgrounds across ~96 page files. In dark mode these render as bright near-white blocks on a near-black page.
- **Recommendation:** Extract one shared `<LoadErrorAlert message onRetry/>` using the destructive-token style already in DocketApprovals/TestResults; replace the bg-red-50 banners in LotsPage, ProjectsPage, NCRPage, ClaimsPageSections.
- **Verifier note:** Confirmed exactly (LotsPage 302, ProjectsPage 446, NCRPage 134, ClaimsPageSections 65 hardcode light reds; DocketApprovalsPage 351 + TestResultsPage 361 use tokens). Dark mode is fully shipped/reachable (ThemeProvider main.tsx, Header toggle, Settings Appearance, system-pref; .dark near-black). Fix doc-endorsed (--destructive defined for both modes). Downgraded P1→P2: cosmetic in dark mode, blocks no workflow, light mode unaffected. The "231/96" count is slightly off (verifier reproduced 244/118 across all of src) but directionally accurate.

### states-02 — Core pages show a bare centred spinner instead of a skeleton (blank flash + layout jump)
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `states-03`, `heuristics-04`
- **Location:** `frontend/src/pages/DashboardPage.tsx:255-265`; `frontend/src/pages/ncr/NCRPage.tsx:92-103`; `frontend/src/pages/tests/TestResultsPage.tsx:346-356`; `frontend/src/pages/lots/components/LotDetailPageStates.tsx:8-18`; `frontend/src/pages/claims/ClaimsPageSections.tsx:82-88`
- **Standard:** NN/g skeletons-over-spinners; Nielsen H1.
- **Evidence:** The post-login DefaultDashboard returns only a centred `animate-spin` (256-263) — the whole header, KPI tiles and widgets vanish then pop in. NCRPage, TestResultsPage, LotDetailPage, Claims do the same. Contrast with LotsPage/ProjectsPage (header + skeleton rows) and the foreman docket view (MobileDataCardSkeleton ×3). The dashboard is the first screen post-login.
- **Recommendation:** Use the existing StatCardsSkeleton + table/card skeletons for the Dashboard, and a table/row skeleton for NCR/TestResults/Claims, keeping the page header rendered during load. LotDetailPage shows a header + tab skeleton.
- **Verifier note:** All 5 locations confirmed verbatim (DefaultDashboard returned at 107). Contrast claims true (LotsPage 273-297 header+skeleton; DocketApprovalsMobileView 249-251 MobileDataCardSkeleton ×3). Recommendation sound — the suggested components already exist unused in components/ui/Skeleton.tsx (StatCardsSkeleton 125, LotsTableSkeleton, PageSkeleton, TableRowSkeleton). Cheap fix, but blocks nothing and spinners have role=status+aria-labels → P2.

### states-03 — A complete shared skeleton kit exists but is almost entirely dead code
- **Severity:** P2 · **Effort:** M · **Cross-ref:** `states-02`, `heuristics-04`
- **Location:** `frontend/src/components/ui/Skeleton.tsx:17-141` (TableRowSkeleton, CardSkeleton, ListItemSkeleton, LotsTableSkeleton, ProjectsGridSkeleton, StatCardsSkeleton — all unused); only PageSkeleton (App.tsx:9, appProjectRoutes.tsx:5) and base Skeleton are referenced
- **Standard:** Nielsen H4; DRY / single source of truth for loading states.
- **Evidence:** Skeleton.tsx exports purpose-built skeletons for exactly the surfaces that flash (StatCardsSkeleton, LotsTableSkeleton, ProjectsGridSkeleton, ListItemSkeleton). A grep found zero usages outside Skeleton.tsx (only PageSkeleton is used). Meanwhile ProjectsPage and LotsPage hand-roll near-identical inline skeletons (ProjectsPage 248-263, LotsPage 274-296) and Dashboard/NCR/TestResults use bare spinners.
- **Recommendation:** Adopt the exports: ProjectsPage → ProjectsGridSkeleton, LotsPage → LotsTableSkeleton, Dashboard → StatCardsSkeleton + a list skeleton, list-detail rows → ListItemSkeleton. Delete genuinely homeless variants.
- **Verifier note:** Confirmed (6 exports; none imported outside Skeleton.tsx besides PageSkeleton + base; ProjectsPage 248-263 / LotsPage 273-296 hand-roll duplicates; Dashboard 262 + TestResults 353 use full-page spinners). Strongly supported by design-system.md:233 ("Loading states: skeleton … no spinners except inline buttons") — so the spinner pages violate the design system. Minor overstatement: StatCardsSkeleton + LotsTableSkeleton are rendered transitively by PageSkeleton; TableRow/Card/ListItem/ProjectsGrid are genuinely dead. P2 (consistency/DRY + design drift, cosmetic).

### states-04 — Subbie dashboard collapses load failures into 'empty' (silent failure)
- **Severity:** P2 · **Effort:** S · **Cross-ref:** `field-ergonomics-01`, `forms-03`
- **Location:** `frontend/src/pages/subcontractor-portal/SubcontractorDashboard.tsx:143-177` (dockets/assignedLots/notifications queries have no isError), rendered at 489-512 ('No previous dockets') and 465-469 ('No lots assigned yet')
- **Standard:** Nielsen H1; empty-state guideline (distinguish errored from empty); never silently drop work.
- **Evidence:** Only `companyLoading` drives the page's loading/empty logic (`const loading = companyLoading`, 209). The dockets/assignedLots/notifications useQuery calls expose no isError, so if `/api/dockets` or `/api/lots` fails, the dashboard renders genuine-empty UI: 'No previous dockets' (511) and 'No lots assigned yet. Contact your project manager.' (467). A subbie whose data failed to load is told they have no work — for a docket-sign-off product, a trust failure.
- **Recommendation:** Surface isError on the dockets/assignedLots/notifications queries and render a small inline 'Couldn't load — Try again' (reuse the shared LoadErrorAlert from states-01) instead of the empty copy.
- **Verifier note:** Confirmed (209 drives all logic; queries 143-152/159-168/170-177 destructure only `data`, zero isError; empty copy 467/511; failed dockets fetch also nulls todaysDocket). Real silent-failure for a docket-signoff product. Downgraded P1→P2: the company/auth query gates the page so the most common failure is caught, the top-right Refresh (270-281) re-runs all queries, and "Start Today's Docket" still works. The recommended LoadErrorAlert doesn't yet exist (proposed as a companion, not claimed existing).

### states-05 — Opacity-reduced muted text (`/70`, `/50`) fails 1.4.3 on foreman outdoor surfaces
- **Severity:** P2 · **Effort:** S · **Cross-ref:** `field-ergonomics-05`, `accessibility-08`
- **Location:** `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:285` and `:301` (empty-state subtext, text-muted-foreground/70); `frontend/src/components/ui/SignaturePad.tsx:213` ('Sign here', text-muted-foreground/50)
- **Standard:** WCAG 2.2 SC 1.4.3 (AA, 4.5:1); push toward 1.4.6 (7:1) for sunlight.
- **Evidence:** Base --muted-foreground is 4.83:1 on card / 4.63:1 on page bg (passes AA, below 7:1). Reducing to 70% opacity over card yields 2.73:1 (fails AA). That /70 text is the explanatory subtext in the foreman 'No subcontractor dockets yet' / 'No dockets waiting' empty states — the 7am sunlit path. SignaturePad's /50 'Sign here' (~2.0:1) is the prompt on a sign-off canvas.
- **Recommendation:** Drop the opacity modifiers: solid text-muted-foreground (or text-foreground) for any real body/prompt text. Reserve /40-/50 for decorative icons (need only 3:1). Consider darkening --muted-foreground for field legibility.
- **Verifier note:** Confirmed all three (285/301 /70 on body subtext; SignaturePad 213 /50 over white). Recomputed: base 4.83:1, /70 = 2.74:1 (fails AA), /50 = 1.98:1 — match. Genuine 1.4.3 AA failure on body/prompt text; corroborated by design-system.md:68. Downgraded P1→P2: affected text is non-blocking supplementary content (paired headings use solid passing tokens; 'Sign here' disappears on first touch), though it's a systemic 24-occurrence pattern worth an app-wide fix.

### states-06 — Documents list shows a bare 'Loading documents...' text node (no skeleton, no role=status)
- **Severity:** P3 · **Effort:** S
- **Location:** `frontend/src/pages/documents/components/DocumentGrid.tsx:57-58`
- **Standard:** Nielsen H1; skeletons-over-spinners; consistency with surfaces using MobileDataCardSkeleton.
- **Evidence:** DocumentGrid renders `{loading ? <div className='p-8 text-center text-muted-foreground'>Loading documents...</div> : ...}` (57-58). No skeleton, no role=status, and the muted text is low-contrast for outdoor use. Documents is a customer-facing upload surface, yet its load state is among the weakest — a plain grey line that flashes then replaces with rows (layout shift).
- **Recommendation:** Replace with 4-6 ListItemSkeleton rows (the unused export from states-03) wrapped in role='status' aria-label='Loading documents', matching the document row layout.
- **Verifier note:** Confirmed verbatim (57-58; no skeleton/role=status; ListItemSkeleton Skeleton.tsx:51-62 exists, unused, matches the row markup `flex items-center gap-4 p-4 border-b`). The 'weakest in the app' framing is overstated: DrawingRegisterTable.tsx:56 is byte-identical and many surfaces use the same plain Loading-text pattern — a widespread cosmetic inconsistency, not a unique outlier. P2 inflated → P3.

### states-07 — Success/failure feedback mixed: standardized toasts on most pages, but NCR uses ad-hoc inline banners
- **Severity:** P3 · **Effort:** S · **Cross-ref:** `states-01`
- **Location:** `frontend/src/pages/ncr/NCRPage.tsx:155-172` (green successMessage banner + amber 'role' banner) vs the toast() pattern in `DocketApprovalsPage.tsx:158/184/284`, TestResultsPage, HoldPointsPage, DocumentsPage
- **Standard:** Nielsen H4; single feedback channel (the sonner toaster wrapper `frontend/src/components/ui/toaster.tsx`).
- **Evidence:** There's a backward-compatible toast() wrapper over sonner (toaster.tsx:22-38) and most pages route success/failure through it. NCRPage instead renders a persistent inline `bg-green-50 text-green-700` successMessage banner (155-162) and a separate `bg-primary/5` role banner (165-172) embedding `text-green-600`. So the same lifecycle event is communicated two ways, and the NCR banner uses the light-only literal from states-01.
- **Recommendation:** Route NCR action success through `toast({variant:'success'})` like the other modules and remove the inline banner; if the role/QM note must stay, give it dark-mode tokens.
- **Verifier note:** Confirmed (NCR banners 155-162 light-only + 165-172 role banner with text-green-600; DocketApprovalsPage uses toast at pages/dockets/DocketApprovalsPage.tsx 158/184/284 — NOT the cited docket-approvals/ dir). But overstated two ways: (1) the banner is NOT persistent — useNCRActions.ts showSuccess() auto-clears after 3000ms (71-74); (2) NCR is not the lone outlier — the same inline bg-green-50 success-banner pattern is used by VerifyEmailPage 149/245, CompanyTeamMembersSection 281, CompanySettingsSections 182, DiarySubmitSection 290. Purely cosmetic → P2 to P3.

### states-08 — Status badges/icons across pages encode meaning with colour; inconsistent dark-mode handling
- **Severity:** P3 · **Effort:** M · **`codeConfirmed: false`** (one sub-claim was a misread) · **Cross-ref:** `design-system-conformance-04`, `heuristics-03`
- **Location:** `frontend/src/pages/subcontractor-portal/SubcontractorDashboard.tsx:100-115` (getDocketStatusIcon); `frontend/src/pages/dockets/components/DocketApprovalsTable.tsx:142-147` (statusColors chip, no dark variants) vs `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:47-53` (full dark-aware map)
- **Standard:** WCAG 2.2 SC 1.4.1 (A); 1.4.11 (AA); "never encode table status by colour alone".
- **Evidence (as filed):** (1) colour-only cues: getDocketStatusIcon allegedly returns the same Clock icon tinted amber for both 'pending_approval' and 'queried'. (2) inconsistent dark support: the desktop chip uses `statusColors[status]` with no dark: variants (143) while the mobile view defines a full light+dark map (47-53), so the identical status can be washed-out in desktop dark mode.
- **Recommendation:** Give the docket chips one shared light+dark colour map (reuse the mobile one) and ensure status icons differ by shape/glyph, not just hue. Audit per-status maps in dockets/diary/holdpoints for missing dark: variants.
- **Verifier note:** Mixed. The dark-mode-inconsistency half is real and confirmed — desktop statusColors (DocketApprovalsTable.tsx:143 from docketActionData.ts:18-24) has NO dark: variants while DocketApprovalsMobileView 47-53 AND subcontractorDashboardHelpers.ts:45-51 define full light+dark maps (three divergent maps; desktop yellow vs others' amber), so the desktop pill is washed-out in dark mode. But the headline 1.4.1 'colour alone' claim is a MISREAD: getDocketStatusIcon returns Clock+amber for pending_approval (105) but MessageSquare+amber for queried (111) — different glyphs — and every icon is paired with a text-label badge (498+506, 315). So no colour-alone violation. Legitimate defect is cosmetic dark-mode consistency on a low-traffic admin table with always-legible labels → P3. (Retained for the dark-mode half; the 'distinct icons' recommendation is already satisfied.)

### states-09 — Swipe approve/reject gives no optimistic feedback or undo; card unchanged until refetch
- **Severity:** P3 · **Effort:** M · **Cross-ref:** `field-ergonomics-09`
- **Location:** `frontend/src/components/foreman/DocketApprovalsMobileView.tsx:312-366` (SwipeableCard onSwipeRight→onApprove / onSwipeLeft→onReject) wired to `DocketApprovalsPage.tsx:309-311` openActionModal, settled via refetchDockets() at 428-432; mutation in `frontend/src/pages/dockets/components/DocketActionModal.tsx:88-118`
- **Standard:** swipe + destructive-action safety (confirm OR salient undo); optimistic UI + per-item state; Nielsen H1.
- **Evidence:** The mobile approve flow advertises a swipe gesture but onApprove/onReject just open DocketActionModal; there's no optimistic move to 'Approved/Rejected' and no Undo snackbar. After the modal action, the page calls refetchDockets() (431) so the list only updates once the round-trip returns — on a slow connection the just-actioned docket lingers in Pending, inviting a duplicate tap.
- **Recommendation:** After a successful approve/reject, optimistically update that docket's status in the cached list (setQueryData) + a time-boxed Undo toast, then reconcile on refetch; keep the rollback-on-error toast.
- **Verifier note:** Confirmed (SwipeableCard 316-329 → onApprove/onReject → openActionModal 200-204,309-311; mutation 88-118 is a plain await + toast settling only via refetchDockets 428-432; grep shows zero setQueryData/onMutate/optimistic/Undo). But severity inflated: swipe routes through a full confirm modal with a disabled 'Approving...' button + an actionInProgressRef double-submit guard, and onActionComplete closes the modal before refetching, so the 'lingers/duplicate tap' risk is overstated and the destructive-safety standard is already met — the only real gap is a brief refetch-latency flicker → P3 polish.

### states-10 — Filtered-empty vs first-use-empty conflated on Documents (no 'Clear filters')
- **Severity:** P3 · **Effort:** S
- **Location:** Good: `frontend/src/pages/dockets/components/DocketApprovalsTable.tsx:68-99`, `frontend/src/pages/ncr/NCRPage.tsx:178-201`. Weak: `frontend/src/pages/documents/components/DocumentGrid.tsx:59-84`
- **Standard:** NN/g empty states — differentiate first-use / user-cleared / no-results; provide one-click clear-filters.
- **Evidence:** DocketApprovalsTable and NCRPage branch their empty copy on unfiltered-empty vs filter-excluded-everything. DocumentGrid only special-cases the favourites toggle (75-82); when active type/category/lot/date/search filters produce zero rows it shows the generic first-use empty state ('Drag and drop files here…', 79-83) with no Clear-filters — even though DocumentsPage already has an onClearAll (361-370).
- **Recommendation:** When `documents.length>0` but visible is empty due to active filters, show 'No documents match your filters' + a Clear filters button wired to onClearAll. Apply the dockets-table first-use-vs-no-results split.
- **Verifier note:** Confirmed (DocumentGrid 59-84 only special-cases favourites; sibling DocketApprovalsTable 68-99 + NCRPage 193-200 differentiate; onClearAll exists DocumentsPage 361-370). Caveat: the finding implies client-side filtering — actually type/category/lot/date/search are applied server-side (DocumentsPage 97-127), so `documents` IS the filtered set; the recommended `documents.length>0 && visible===0` condition won't fire for those filters. Correct fix is to pass a `hasActiveFilters` flag into DocumentGrid (the page holds all filter state) and branch like NCRPage. Conclusion sound, mechanism slightly misread. P3.
