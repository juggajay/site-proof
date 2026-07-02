# SiteProof v3 — External UX Research Pack

**Compiled:** 2026-06-08 (companion to the `origin/master @ 3cc0d37` UI/UX audit)
**Purpose:** Standalone reference. Five research domains, each with the consensus principles, primary sources, and how each applies to SiteProof. Cite this when justifying a finding's severity or a remediation choice.

---

## Domain 1 — WCAG 2.2 AA practical conformance for data-dense B2B (web + mobile)

**Summary.** WCAG 2.2 AA is the de facto procurement/legal baseline (AU/EU) and is achievable for dense B2B apps without sacrificing density. Contrast numbers are unchanged from 2.1 (4.5:1 normal text, 3:1 large text and UI-component boundaries). WCAG 2.2 adds four criteria that bite hardest in dense, mobile, dialog-heavy apps: 2.5.8 Target Size (24px min), 2.4.11 Focus Not Obscured, 2.4.13 Focus Appearance (note: AAA, not AA), and the carried-over 4.1.2 / 3.3.1 / 3.3.3. The cheapest path is to fix these once at the token + shared-primitive layer (button/input/dialog) so one correction propagates everywhere.

### Principles

| Principle | Detail | Source |
|---|---|---|
| Text contrast 4.5:1 (3:1 large), never round up | Body/UI label ≥4.5:1; large text (≥24px, or ≥18.66px bold) ≥3:1. Governs placeholders, muted/secondary text, text over status fills, and brand-accent link text. Treat as hard thresholds. | [W3C SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) |
| 3:1 non-text contrast for every component/meaningful graphic | Control boundaries (input borders, button edges, focus rings), state-distinguishing parts, and meaningful icons/chart segments. A 1px near-grey hairline often fails. | [W3C SC 1.4.11](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html) |
| Pointer targets ≥24×24 CSS px (prefer 44×44), or earn an exception | Five exceptions: Spacing, Equivalent, Inline, UA default, Essential. The hit area (incl. padding) is measured, not the glyph. 44×44 is the iOS/Material norm and SC 2.5.5 (AAA). | [W3C SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| Visible AND strong focus indicator | 2.4.7 (AA) requires visible focus. 2.4.13 (AAA) defines "strong": ≥2px-equivalent perimeter at ≥3:1 between focused/unfocused. Don't let component overrides collapse the ring to 1px. | [W3C SC 2.4.13](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) |
| Sticky chrome must not fully hide the focused element | 2.4.11 (AA, new in 2.2): sticky headers/footers/bottom-nav/toasts/banners must not fully occlude a focused control. Fix with `scroll-margin`/`scroll-padding` equal to the sticky height, or make banners modal. | [W3C SC 2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |
| Trap + restore focus in dialogs (without a keyboard trap) | Modals must: move focus in on open, contain Tab/Shift+Tab (wrap), close on Escape, return focus to the trigger on close. This deliberate loop does NOT violate 2.1.2. Use `role="dialog"` + `aria-modal="true"` + an accessible name. | [ARIA APG Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) |
| Custom controls need name, role, value | 4.1.2 (A): every interactive element exposes a name, correct role, and current state. Icon-only buttons (edit/delete/sort) are the most common B2B failure — they need `aria-label`. | [W3C SC 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html) |
| Errors in text, with a fix, announced via live region | 3.3.1 (A) identify error in text; 3.3.3 (AA) suggest the fix. Programmatically link the message (`aria-describedby` + `aria-invalid="true"`); announce blocking errors via `role="alert"`/`aria-live="assertive"`, inline async via `aria-live="polite"`. | [W3C SC 3.3.1](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) / [3.3.3](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html) |
| Don't convey state by colour alone | 1.4.1 (A): status that matters must pair colour with a text label/icon/shape. Distinct from contrast — a perfectly-contrasting red chip still fails if "red = fail" is the only cue. | [W3C SC 1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) |

### How it applies to SiteProof
- **Fix focus once at the token layer.** `index.css` global `:focus-visible` is `ring-2 ring-offset-2` (good), but `button.tsx`/`input.tsx` hardcode `ring-1`. Standardise on one ≥2px ring token across button/input/dialog/select. → `accessibility-06`, `design-system-conformance-10`.
- **Audit the violet primary** against near-white background: verify primary link text and small button labels clear 4.5:1 and borders/disabled clear 3:1. Status chips must clear contrast AND carry a label. → `design-system-conformance-01`, `accessibility-02/08`.
- **Target size for row/toolbar icons.** `Button size="icon"` (36px) passes, but `size="sm"` (32px) and packed row icons risk <24px or <24px spacing. Apply 44×44 to primary field actions. → `field-ergonomics-08`, `forms-05/10`.
- **Sticky chrome vs Focus Not Obscured.** Add `scroll-margin`/`scroll-padding` equal to the sticky header + bottom-nav heights so tabbing a long ITP/diary form never parks focus behind fixed bars. → relates to `field-ergonomics-02`.
- **Name every icon-only control.** Sweep dense action clusters and the custom `NativeSelect`/segmented controls for accessible names + state. → `forms-05`, `accessibility-07`.
- **Wire form errors to fields + a live region.** RHF + Zod means messages exist; link them (`aria-describedby` + `aria-invalid`) and announce. → `accessibility-05`, `forms-08/11`.
- **Dialogs:** confirm the `Modal.tsx` Radix wrapper preserves focus-in/trap/Escape/restore; the hand-rolled `BottomSheet` and Header menus do NOT. → `accessibility-03/09`, `field-ergonomics-07`.
- **Test the field context:** Playwright `390×844` + an axe-core/keyboard pass over docket, ITP, lot-detail, and dialog flows as the regression net.

---

## Domain 2 — Mobile UX for field/industrial/construction apps used outdoors

**Summary.** For outdoor construction use, "accessible" baselines are a floor, not a target. Four compounding stressors — glare, gloves+motion, one-handed use, intermittent connectivity — should all be designed for at once. Push contrast to AAA (7:1 body) because glare subtracts contrast; size primary targets ~48–60px; keep frequent actions in the bottom thumb arc; be offline-first with calm persistent sync state; protect destructive actions with confirm OR undo; make capture single-tap, auto-stamped, fire-and-forget.

### Principles

| Principle | Detail | Source |
|---|---|---|
| Push contrast to AAA (7:1) for sunlight | Glare subtracts contrast, so target 1.4.6 (7:1 body / 4.5:1 large) on field surfaces; avoid grey-on-grey and thin weights. Also meet 1.4.11 (3:1) for borders/icons/rings. | [W3C 1.4.3/1.4.6](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); altersquare.io |
| Size primary targets 48–60px for gloves | 2.5.8 (24px) is the floor; 2.5.5 (44px) AAA; Apple 44pt / Material 48dp. Construction guidance: 48–60px for primary actions; NN/g anchors ~1cm physical. Form fields/toggles ≥44px. | [W3C 2.5.8/2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html); NN/g Touch Targets |
| Space targets so a 24px circle never overlaps | Size alone is insufficient; keep ≥8px between buttons, more for destructive/adjacent. Crowded toolbars are the top glove mis-tap cause. | W3C 2.5.8 spacing exception; NN/g |
| Put frequent actions in the bottom thumb arc | ~49% hold one-handed, ~75% of interaction is thumb-driven. Green (bottom)/yellow/red (top) zones; primary actions + bottom-nav in green, low-frequency in top. | Smashing "Thumb Zone"; Hoober (UXmatters) |
| Offline-first with calm persistent sync state | Apply edits optimistically, reconcile later; show a quiet always-present indicator with plain labels (Saved on device / Syncing / 3 pending / Failed — tap to retry); provide an Outbox; handle partial failures per-item; never silently drop queued work. | appmaster.io; LeanCode |
| Protect destructive actions: confirm OR salient undo | Rare/high-impact → named confirmation; repetitive → time-boxed Undo snackbar. Increase hit-area separation; don't place destructive next to common controls. | NN/g contextual swipe; uxmovement; Baymard |
| Don't rely on swipe-to-delete as the only path | Easy to trigger with gloves/while walking, undiscoverable, conflicts with scroll/tab swipes. Pair with Undo + an explicit non-swipe equivalent. | LogRocket swipe-to-delete; NN/g |
| Capture: single-tap, auto-stamped, fire-and-forget | One tap to a big button; auto GPS + timestamp + category; queue locally; defer classification to later; minimise required fields at capture. | Esri ArcGIS QuickCapture; FastField |
| Large body type + generous line-height outdoors | 16–18px min body (larger for key values); larger text also qualifies as "large" easing the contrast threshold. Avoid long lines/light weights/tight tracking. | altersquare.io; W3C 1.4.3 |
| Test on real devices, in sun, with gloves, one hand | Controlled-environment review misses field failures; validate in direct sun on real phones, gloved, one-handed, on degraded/no connectivity. | developerux.com; NN/g; Skedulo |

### How it applies to SiteProof
- **Promote the mobile palette to AAA (7:1 body / 4.5:1 large)** on ITP checklists, hold-point status, docket sign-off, NCR capture. The "sleek" low-contrast greys are the top sunlight risk. → `field-ergonomics-04/05`, `accessibility-02/08`, `states-05`.
- **Bump primary field actions to 48–60px with ≥8px separation, in the bottom thumb arc** (Approve hold point, Sign docket, Capture, Force Conform); keep destructive out of top corners. → `field-ergonomics-08`, `forms-05/10`.
- **Treat docket sign-off, ITP completions, NCR/photo evidence as offline-first writes** with a persistent plain-language sync chip; surface a per-item Outbox so nothing queued is silently lost. → `forms-02`, `field-ergonomics-01`, `states-04`.
- **Guard every destructive action** (delete NCR/diary/docket line, remove lot assignment) with named confirmation or prominent Undo; don't ship swipe-to-delete as the sole path. → `forms-05`, `field-ergonomics-09`, `states-09`.
- **Single big-button capture, auto-stamped GPS + timestamp, queued immediately**, deferring which-lot/which-ITP/NCR-category to a tidy-up step; mirror QuickCapture in the shared `CaptureModal`. → `field-ergonomics-06/11`, `microcopy-02`.
- **Standardise mobile body text at 16–18px**; reuse `formatStatusLabel`/`STATUS_LABELS` so status text is legible and consistent; status colours meet 3:1 non-text. → `field-ergonomics-04`.
- **Differentiate by user type:** foremen (gloves/sun/one hand) get the largest targets/type/fastest capture; HC PMs/QMs indoors tolerate denser layouts — apply worst-case rules to field/portal mobile surfaces only.

---

## Domain 3 — B2B SaaS onboarding & activation (2025–2026)

**Summary.** First-week abandonment is the dominant failure mode (~75% churn in week one; ~37–38% median activation). The fix is not more tutorial content but engineering the fastest path to a real value milestone (the "aha moment"), per role, ideally in the first session. Highest-leverage tactics: define one activation event per role and instrument it; strip signup friction (~7% per extra field); design first-run empty states as launchpads with one CTA; pre-populate sample/seed data; layer features via progressive disclosure (never >2 levels); use a short outcome-framed checklist but measure value milestones not checkmarks.

### Principles

| Principle | Detail | Source |
|---|---|---|
| One activation "aha moment" per role, instrumented | Define the single retention-correlated action per role (admin/setup, daily user, exec) and accelerate to it in the first session. Track activation, time-to-value, core-feature adoption, completion, conversion. Median activation ~37–38%. | [AgileGrowthLabs 2025](https://www.agilegrowthlabs.com/blog/user-activation-rate-benchmarks-2025/); SaaSFactor |
| Treat first-week abandonment as the primary failure | ~75% churn in week one; 8/10 abandon because they can't figure it out. Healthy time-to-first-value ~1–3 days; day-7 return ≥7% = top quartile. | [Userpilot TTV](https://userpilot.com/blog/time-to-value-benchmark-report-2024/); DigitalApplied |
| Cut signup/setup friction — every field has a cost | ~7% conversion lost per extra field. Defer non-essential data (progressive profiling); sandbox so value comes before setup completes. | SaaSFactor; Appcues |
| First-run empty states are launchpads, not dead ends | Each must: explain why it's empty, show the value, present one primary CTA. Avoid "No data". Fix first-use states first. Well-designed empty states can lift activation ~60%. | [Eleken](https://www.eleken.co/blog-posts/empty-state-ux); SAP Fiori |
| Pre-populate sample/seed data + templates | A screen with sample data gives a template to reverse-engineer; faster than docs. Patterns: visual demo with sample records, structured templates, "sample metrics + connect your data", sandbox. | Appcues; Formbricks 2026 |
| Progressive disclosure — never exceed 2 levels | Show a few key options first, defer the rest; make level-switching obvious. >2 levels → users get lost. ~20–40% faster tasks, ~35% fewer onboarding tickets. | [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/); Lollypop |
| Short checklist, but measure value not checkmarks | Checklists boost momentum (one case: 75% completion, +30% paid) but are a vanity trap — 98%+ still churn if they finish steps without hitting value. Keep items outcome-framed (each yields a real artifact); median checklist completion ~10%. | DigitalApplied; Userpilot |
| Role-specific onboarding (B2B = team adoption) | Map all stakeholder roles; each gets a tailored first-run path to its own milestone (setup vs workflow vs reporting). | Kalungi; ProductFruits |
| Anchor first-run + forms to WCAG 2.2 | Targets ≥24×24 (2.5.8), prefer 44×44 (2.5.5); don't re-key data (3.3.7 Redundant Entry); don't gate login on memory alone (3.3.8); consistent help location (3.2.6). | [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) |
| Offline-first field onboarding | Job-critical data on device; complete forms/status/photos/time offline; queue + auto-sync on reconnect; large gloved targets; auto-GPS; sunlight legibility. View-only offline is insufficient. | Fieldpoint; FieldBoss |

### How it applies to SiteProof
- **Define one activation milestone per role and instrument each separately:** PM/QM = first project + first lot (or first ITP attached); foreman = first daily docket signed off on mobile (the stated adhesion point); subbie = first docket submitted / invite accepted. → `journeys-01`.
- **Replace blank first-run screens with launchpad empty states matching the data spine.** Projects/Lots/ITP/NCR/diary/dockets/claims/documents each need their own first-use state with one CTA, not a generic "No records". → `journeys-04`, `heuristics-09`.
- **Seed a sample/demo project** (one lot + ITP + hold points + signed docket + progress claim, clearly labelled sample, fully deletable) so a new HC sees "what working looks like". Lean on the existing additive/idempotent ITP seeders (`npm run seed:itp`) + AU/SA-DIT jurisdiction templates. (Cross-ref `07-onboarding-implementation.md` P0 item #1 and §5.3.)
- **Apply progressive disclosure to the complexity hotspots** (LotDetailPage orchestrator, hold-point trust boundary, jurisdictional PDF options): foremen see only the field actions they need; defer advanced config behind one clear secondary level (never >2). → relates to `heuristics-07`.
- **Make foreman/subbie first-run offline-tolerant + field-legible**, gating primary field buttons to 44×44. → `forms-02/10`, `field-ergonomics-08`.
- **Honour Redundant Entry (3.3.7) and Accessible Auth (3.3.8)** in invite/accept + setup; keep a consistently-placed help affordance (3.2.6). → `microcopy-01`, `journeys-05`.
- **Short outcome-framed admin checklist** (create project → add lot → invite subbie → set portal access), but define success as first signed docket / first claim, not checklist completion.
- **Tie to the launch-threshold pattern** (22 projects, 0 live; beta users = bug-report sources): prioritise getting a new tenant from signup to one signed docket in the first session over polishing config; instrument first-week return + first-docket time as the go-live signal.

---

## Domain 4 — UX of construction quality / site-management software (field-facing)

**Summary.** Across Procore, Fieldwire, SafetyCulture/iAuditor, Dashpivot, and CivilPro, field adoption is won or lost on three things: tap-count to finish a real task, offline reliability with visible sync state, and readability/touch-targets under jobsite conditions. The most powerful tool (Procore) is faulted for over-clicking and learning curve; the most-loved (Fieldwire/SafetyCulture) win on fast learnable mobile flows but still get burned by sync delays/crashes and confusing taxonomy. Dashpivot shows the silent-data-loss failure mode. CivilPro (the AU civil incumbent) wins on the lot → ITP → checklist → evidence spine and had to specifically invest in usable ITP revisions/approvals.

### Principles

| Principle | Detail | Source |
|---|---|---|
| Every primary field task finishable in <60s, gloved | Treat tap-count as a first-class metric: "if it takes 10 taps to clock in a worker, the crew gives up". Default obvious values (date/project/lot from context); avoid multi-screen wizards on the common path. | [ezo.io](https://ezo.io/ezofficeinventory/blog/construction-apps/); BuildOps |
| Avoid the Procore trap: power without learnability kills adoption | Most feature-complete yet most-criticised for usability (steep curve, slow, foreman-unfriendly; "every dropdown pulled up the keyboard"). Keep foreman/subbie surfaces ruthlessly narrow; use native pickers that don't summon a keyboard for fixed choices. | [Software Advice](https://www.softwareadvice.com/construction/fieldwire-profile/vs/procore/); Capterra |
| Offline is the default state, and sync must be visible | Spotty service is normal; Wi-Fi-assuming apps "buffer while crews wait". iAuditor faulted for hours-long sync + crashes. Let users work with changes queued transparently; show a subtle connectivity indicator; confirm when sync completes. | [SafetyCulture offline](https://help.safetyculture.com/en-US/002907/); Android offline-first |
| Never lose a half-finished record | Dashpivot's most damaging complaint: silent data loss (mobile entries never reaching desktop). Persist inputs locally continuously; never block on network mid-entry; raise an unmistakable (not subtle) alert if a record fails to sync. | [Software Advice Dashpivot](https://www.softwareadvice.com/construction/dashpivot-profile/reviews/); NN/g forms |
| Meet WCAG target sizes — 24px floor, 44–48px in field | 2.5.8 (24px) floor; 2.5.5 (44px) AAA; Apple 44 / Material 48. Audit checklist rows, pass/fail toggles, photo/signature buttons — crammed inline icon-buttons are the usual offenders. | [Silktide 2.5.8](https://silktide.com/accessibility-guide/the-wcag-standard/2-5/input-modalities/2-5-8-target-size-minimum/); BuildOps |
| Hold body-text contrast 4.5:1 to survive sunlight | "Subtle grey text that looks sleek on your monitor becomes unreadable on a phone in sunlight." Verify muted/secondary text, status chips, hint text clear 4.5:1. | [W3C 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| Single-column forms, inline validation, field-adjacent errors | Single-column ~15.4s faster; inline validation 42% faster, 22% fewer errors, 31% higher satisfaction. Validate after field completion (not first keystroke); anchor each error beside its field. | [ivyforms](https://ivyforms.com/blog/form-design-best-practices/); NN/g; UXPin |
| Conditional logic / progressive disclosure on ITP checklists | Present only relevant questions per prior answers; branch into detail only when a checkpoint fails. Shortens inspection time, reduces cognitive load. | [NN/g Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/); SBN Software |
| Self-explanatory navigation taxonomy | SafetyCulture users find "Assets/Issues/Sensors" confusing without tooltips; Fieldwire called "cluttered". Name field nav after the job-to-be-done ("Today's Docket", "Inspections", "Raise NCR"), keep bottom-nav to a few destinations, add first-use hints. | Workyard iAuditor; Software Advice |
| Win on the lot → ITP → checklist → evidence → approval spine | CivilPro's moat: digital ITPs linked to lots, auto field checklists, in-app capture + approvals, audit-ready records — and it invested specifically in usable ITP revisions/approvals (a known pain point). | [CivilPro lot QA](https://civilpro.zendesk.com/hc/en-us/articles/360056674454-Lot-based-Quality-Assurance) |

### How it applies to SiteProof
- **Daily docket sign-off is the adhesion point:** budget <60s gloved, default project/lot/date from context, use native fixed-choice pickers (avoid Procore's keyboard-on-every-dropdown). → `forms-02/04`, `field-ergonomics-08`.
- **Keep foreman/subbie surfaces narrow** (field execution only); reserve dense admin/commercial UI for PM/QM web sessions. → cross-cutting; supports `field-ergonomics-11` (don't over-scope), and the foreman-not-lot-setup-manager invariant in project memory.
- **Add explicit per-record sync state + a loud failure alert** on the IndexedDB offline flows so SiteProof never reproduces Dashpivot's silent data loss. → `forms-02`, `field-ergonomics-01`, `states-04`.
- **Autosave every inspection/diary/docket/NCR draft locally and continuously**; never block mid-entry. → `forms-02/03/09`.
- **Audit mobile touch targets** (24px floor, 44–48px on pass/fail/photo/signature). → `field-ergonomics-08`, `forms-05/10`.
- **Verify the zinc theme's muted text/status chips/hints clear 4.5:1** in sunlight. → `field-ergonomics-04/05`, `accessibility-02`, `states-05`.
- **Single-column forms, validate on blur, error beside field** for the RHF + Zod forms. → `forms-08/11`, `accessibility-05`.
- **Conditional disclosure on ITP/hold-point checklists** — keep the pass path short, reveal evidence/NCR-raise only on fail.
- **Label field navigation by job-to-be-done** + add first-use hints (avoid SafetyCulture's undescribed-section confusion). → `microcopy-01`, `heuristics-01`.
- **Compete with CivilPro on the lot → ITP → hold-point → NCR → approved-lot spine** with clean exportable evidence and approval states PMs/superintendents can read at a glance.

---

## Domain 5 — Data-heavy enterprise dashboards & tables (Nielsen's 10 heuristics applied)

**Summary.** Dense UIs succeed when density is deliberate, the system constantly reports its status, and high-frequency tasks (find/compare/edit/act) are cheap. NN/g frames tables around four tasks. Strongest patterns: order columns by decision relevance + let users control density; freeze headers/first column + zebra + hover; explicit time-aware status (0.1s/1s/10s) with skeletons not spinners; visible selection + a persistent count-labelled bulk-action bar; three distinct empty states; transparent sorting/filtering with a default sort + active-filter chips; never encode status by colour alone (1.4.1/1.4.3/1.4.11).

### Principles

| Principle | Detail | Source |
|---|---|---|
| Order columns by decision relevance; let users control density | Lead with a human-readable identifier (lot/NCR number), not an auto ID; put most-compared fields left. Offer a density toggle + column hide/reorder with a clear hidden-column indicator. | [NN/g Data Tables](https://www.nngroup.com/articles/data-tables/); Pencil & Paper |
| Freeze headers + first column; zebra + hover highlight | When wider/taller than screen, freeze the header row + identifier column; reinforce with borders/zebra/full-row hover; right-align numerics (align decimals). | NN/g Data Tables; MOZE Studio |
| Explicit time-aware status; skeletons for content | Anchor to 0.1s (instant), 1s (flow), >10s (determinate bar + multitask). Use skeletons over spinners for content fetches; reserve spinners for 2–10s actions. | [NN/g Heuristics for Complex Apps](https://www.nngroup.com/articles/usability-heuristics-complex-applications/); NN/g Response Times |
| Visible selection + persistent count-labelled bulk bar | Inline actions for 1–2 only; beyond that use checkbox + Select All; highlight the whole row; slide in a pinned "{n} selected" bar; wizard-confirm risky multi-record edits. | [Eleken bulk actions](https://www.eleken.co/blog-posts/bulk-actions-ux); Helios DS |
| Three distinct empty states | First-use = explain value + one Create CTA; user-cleared = confirm done; no-results = state the cause + one-click Clear filters. Avoid "No data". | [NN/g Empty States](https://www.nngroup.com/articles/empty-state-interface-design/); Carbon DS |
| Transparent sort/filter; default sort; active-filter chips | Sensible default sort + clear direction indicators; show applied filters as removable chips; don't auto-collapse filter panels; keep layout stable; server-side paginate beyond ~1,000 rows. | [Eleken filter UI](https://www.eleken.co/blog-posts/filter-ux-and-ui-for-saas); UX Patterns for Devs |
| Never encode status by colour alone | Pair colour with label/icon/shape (1.4.1); badge text ≥4.5:1 (1.4.3); badge graphic + control borders/rings ≥3:1 (1.4.11). Redundant icon+label+colour scans faster anyway. | [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/); WebAIM Contrast |
| Most important data top-left; reveal detail progressively | F/Z scanning: put North-Star metrics (open hold points, overdue NCRs, claims awaiting approval) top-left; show aggregated KPIs first, drill down on demand. | [NN/g F-Pattern](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/); Pencil & Paper |
| Prevent errors with previews; protect work with undo/confirm | Preview the effect of a bulk change before commit (which lots a status change hits; what a claim totals); provide undo + consequence-naming confirmation for high-impact compliance writes. | NN/g Heuristics for Complex Apps |

### How it applies to SiteProof
- **Lead each core table** (lots/NCR/dockets) with the human-readable identifier; order columns by what a PM compares; offer compact density + column hide/reorder. Justifies the planned LotsPage/LotDetailPage extraction.
- **Freeze header + identifier column on mobile tables**, keep targets large, and ensure every status badge uses icon+label+colour (reinforces `formatStatusLabel`/`STATUS_LABELS`). → `field-ergonomics-04`, `states-08`.
- **Replace generic spinners with determinate progress** for PDF gen / bulk release / claim assembly (>10s), and skeletons while panels fetch. → `states-02/03`, `heuristics-04`.
- **Daily docket approval = the habit loop:** checkbox multi-select + pinned "{n} selected — Approve" + confirm step; mirror for bulk NCR/hold-point. → `heuristics-11`, `states-09`.
- **Build all three empty states deliberately** (new project teaches + Create lot; all-approved confirms; filtered-no-match says why + Clear filters). → `journeys-04`, `states-10`, `heuristics-09`.
- **Encode compliance status redundantly** (label + icon + colour) at ≥4.5:1 text / ≥3:1 badge so auditors/PDF exports/cheap tablets never misread. → `accessibility-02`, `field-ergonomics-04`.
- **Surface overdue NCRs / open hold points / claims-awaiting-approval top-left** with drill-down, not every metric — keeps it scannable for a user juggling 15–20 projects. → `journeys-04`, `heuristics-09`.
- **High-stakes actions need a preview + undo/consequence-naming confirm** (force conform, bulk delete/status), paired with the existing `actualRole` gating so the safety net is both UX-visible and authorization-enforced. → `heuristics-07`, `forms-05`, `field-ergonomics-09`.
