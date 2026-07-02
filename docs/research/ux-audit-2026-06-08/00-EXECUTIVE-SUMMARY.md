# SiteProof v3 — UI/UX Launch-Readiness Audit — Executive Summary

**Audited commit:** `origin/master @ 3cc0d37`
**Audit date:** 2026-06-08
**Scope:** Heuristics, accessibility (WCAG 2.2), design-system conformance, field ergonomics, microcopy, first-run journeys, forms, and loading/error/empty states across the React + Vite frontend (`frontend/src`).
**Method:** Findings were independently confirmed against the code at `3cc0d37`, each carries a verifier note, and severities are post-verification (several were downgraded from the original triage).

> **This run supersedes an earlier draft in this same directory.** The previous files were generated against a stale local branch by mistake. Everything here is re-grounded against `origin/master @ 3cc0d37`. The five files in `docs/research/ux-audit-2026-06-08/` replace that earlier run in full.

---

## Headline verdict

**Functionally launch-capable, visually off-brand, and accessibility-thin — with two genuine field-workflow gaps to close first.**

The app works: nothing here is a broken or data-destroying defect on the happy path. The launch-readiness story is dominated by three themes, in priority order:

1. **The shipped theme is still the banned violet shadcn starter.** `frontend/src/index.css` is the unmodified "High-Growth Startup: Violet + Zinc" token set. The project's own `docs/design-system.md` names purple `#7c3aed` "the #1 AI-slop signal" and the violet anti-pattern "we're replacing". It renders on the first screen a head-contractor prospect sees (landing hero, every primary button, focus ring, ITP progress bar, the foreman capture FAB). This is a one-file fix with outsized brand impact, so it is the single P0.

2. **Two field-workflow gaps undercut the product's stated daily-habit and field-first positioning.** The daily docket entry flow is online-only despite a fully-built offline queue sitting unused (`forms-02`), and the field-facing daily-diary capture sheet has no dialog semantics or focus management (`accessibility-03`). Both are the surfaces the design system calls "the hero use case".

3. **Accessibility and design-system consistency are broad-but-shallow debt.** Faint borders (1.27:1), white-on-saturated status pills below 4.5:1, error messages not wired to their inputs, hand-rolled menus/sheets without focus management, 1,468 raw Tailwind colour utilities bypassing semantic tokens, and no font declared at all. Individually most are P2/P3; collectively they are the difference between "works" and "looks like serious tooling".

For a pre-launch product with 0 live users (per project memory: 22 projects, 0 live; beta users are bug-report sources), the correct move is to fix the cheap, high-leverage token and field-workflow items and ship — not to clear the entire P2/P3 backlog first.

---

## Per-dimension scorecard

| Dimension | Grade | One-line note |
|---|---|---|
| Design-system conformance | **D** | Shipped theme is still the banned violet+zinc starter; no fonts; 1,468 raw colour utilities; semantic success/warning/info tokens don't exist yet. Biggest brand gap, mostly one-file + codemod fixes. |
| Accessibility (WCAG 2.2) | **C-** | One Level-A field-path failure (diary bottom-sheet: no dialog role/focus trap). Pervasive sub-AA contrast (borders 1.27:1, status pills 2.1–3.8:1), errors not linked to inputs, hand-rolled menus without focus management. Broad but fixable at the primitive layer. |
| Field ergonomics | **C** | Banned violet on every field action; two divergent offline indicators showing contradictory counts; offline pill obscures a bottom-nav tab; GPS feedback success-only; sunlight-contrast misses on swipe/status text. |
| Forms & data entry | **C** | Daily docket entry is online-only (built offline layer unused); diary add/remove handlers swallow errors silently; no numeric keyboard on diary number fields; placeholder-as-label; overnight time auto-wrap with no warning. |
| States (loading/error/empty) | **C+** | A complete skeleton kit exists but is dead code; core pages flash bare spinners; two divergent error-banner styles (one light-only in dark mode); subbie dashboard masks load failures as "empty". |
| Heuristics (Nielsen) | **B-** | Context-help built for 14 pages, mounted on one; onboarding promises help that isn't there; "Raise NCR" styled destructive-red; dashboard "Team Members" tile is a permanent em-dash. Mostly polish + wiring. |
| Microcopy | **B-** | Foreman capture shows bare "Failed to save"; "Today" worklist flattens all errors to "check your connection"; subbie ITP "Total ITPs" mislabels a lot count; bare "PM"/acronyms to the least-technical role. |
| First-run journeys | **B** | The built 9-step onboarding tour is hard-disabled; new-project dashboard shows emptiness-as-metrics with a buried CTA and a misleading green "all clear". Projects page already provides a real first-run launchpad, so impact is bounded. |

---

## Severity counts (post-verification)

| Severity | Count |
|---|---|
| **P0** | 1 |
| **P1** | 3 |
| **P2** | 27 |
| **P3** | 24 |
| **Total** | **55** |

(Plus 4 merge-groups consolidated; see `01-prioritized-roadmap.md`. One finding, `states-08`, is retained but marked `codeConfirmed:false` — the dark-mode half is real, the "colour-only" half was a misread, so it is treated as P3.)

---

## P0 + P1 launch-blockers

### P0 — fix before any external eyes

| id | Title | Location | Fix |
|---|---|---|---|
| `design-system-conformance-01` | Primary/ring/chart tokens are violet — the exact AI-slop signal the spec bans; on every `bg-primary` app-wide and the landing hero | `frontend/src/index.css:6-43` (`:root` violet 262/258), `frontend/src/components/landing/Hero.tsx:23,34`; mapped in `frontend/tailwind.config.js:18-26` | Replace the `:root`/`.dark` token block with the spec's §4 zinc-950 values; add the missing `--accent`/`--success`/`--warning`/`--info` tokens; recolour the 5 chart vars. One file, propagates app-wide. |

### P1 — fix before the first beta HC

| id | Title | Location | Fix |
|---|---|---|---|
| `forms-02` | Daily docket entry (the daily-habit loop) is online-only — a complete offline layer exists but is not wired into the docket UI | `frontend/src/pages/subcontractor-portal/DocketEditPage.tsx:138-312`; unused `frontend/src/lib/offline/dockets.ts:19-99`; executor already built in `frontend/src/lib/offline/syncWorker.ts:208-254` | Route create/add-labour/add-plant through the existing offline functions when offline (optimistic-first), with a per-docket "Saved on device / Syncing / N pending" state. Integration, not new infra. **Keep the deliberate constraint that `docket_submit` does NOT auto-submit offline.** |
| `accessibility-03` | Field-facing daily-diary bottom-sheet (all 6 entry sheets + ITP item sheet) has no dialog role, no focus trap, no focus restore, unlabelled close button | `frontend/src/components/foreman/sheets/BottomSheet.tsx:24-40` | Replace with the in-repo Radix `Sheet`/`Dialog`, or add `role="dialog"` + `aria-modal` + `aria-labelledby`, focus-in on open, Tab trap, focus-restore on close, and `aria-label="Close"`. Multiple WCAG Level-A failures on a field path. |
| `design-system-conformance-03` | Status colour is hardcoded as raw Tailwind palette in 239 files (1,468 occurrences), bypassing the semantic tokens the spec calls "sacred" — blocks any global retint/dark-mode pass | `frontend/src/pages/lots/constants.ts:41-76`, `frontend/src/pages/ncr/constants.ts:7-13`, `frontend/src/pages/tests/constants.ts:6-18`, +236 files | Depends on P0 (add the tokens first), then migrate the per-domain source-of-truth constants, then codemod the long tail. Treat as a multi-day incremental codemod, not one PR. |

---

## What to fix before the first beta HC (sequenced)

This is the minimum, ordered for leverage and dependency. Steps 1–4 are roughly a week; they convert the worst credibility and field-workflow gaps without chasing the whole backlog.

1. **Land the token rewrite (P0 `design-system-conformance-01` + the cheap token-drift riders).**
   One PR to `frontend/src/index.css` + `frontend/tailwind.config.js`: zinc-950 `--primary`/`--ring`, pure-white `--background`, `--radius` 6px, add `--accent`(amber)/`--success`/`--warning`/`--info` and their `-foreground` pairs, recolour chart vars, darken `--border`/`--input` to clear 3:1 (`accessibility-01`) and `--muted-foreground` toward the spec's zinc-600 (`accessibility-08`, `field-ergonomics-05`), bump dark-mode `--primary` to clear 4.5:1 (`accessibility-08`). This single file closes one P0 and meaningfully improves ~6 other findings. **Note:** target real 3:1 for borders (~L58-60% / zinc-400-500), not the loose "L80%" some triage notes suggested.

2. **Self-host fonts (`design-system-conformance-02`).** Add Geist + Geist Mono `@font-face` and `theme.extend.fontFamily`; add `tabular-nums` on numeric columns. Half a day; removes the system-stack AI-default tell.

3. **Wire offline docket entry (P1 `forms-02`).** The queue, conflict handling, and sync executor already exist — connect the three `DocketEditPage` handlers and add a per-docket sync chip. Keep `docket_submit` online-only.

4. **Fix the field-path Level-A accessibility items (P1 `accessibility-03` + `field-ergonomics-07`).** Replace the hand-rolled `BottomSheet` with the in-repo Radix dialog (gives role/modal/trap/restore for free); add the missing close-button label. Same component fixes both findings.

5. **Stop silent failures on legal/pay records.** `forms-03` (diary add/remove handlers swallow all errors), `field-ergonomics-06` (GPS feedback success-only), `microcopy-02`/`microcopy-04` (bare "Failed to save" / "check your connection") — all small, all route through the existing `extractErrorMessage`/`toast` patterns; all on compliance/pay surfaces.

6. **Shared-primitive a11y sweep (covers a cluster at once).** Add `aria-invalid`+`aria-describedby` wiring to the `Input`/`Textarea`/`NativeSelect` error path (`accessibility-05`, `forms-08`, `forms-11`); change `focus-visible:ring-1`→`ring-2` on `button.tsx`/`input.tsx`/`native-select.tsx` (`accessibility-06`, `design-system-conformance-10`); add the global `prefers-reduced-motion` reset (`accessibility-04`). One PR each, app-wide effect.

7. **Re-enable a trimmed first-run path (`journeys-01`) and the new-project launchpad (`journeys-04`).** The 9-step tour and the empty-state CTAs are built; this is activation wiring for the buyer's first session.

8. **Then** burn down the remaining cosmetic P3 backlog (status-colour shade divergence, skeleton adoption, banned palette deletion) opportunistically — much of it is unblocked once the tokens from step 1 land.

> Deferred deliberately: the full 239-file colour codemod (`design-system-conformance-03`) is real P1 debt but is a multi-day codemod that does not block a beta; do the source-of-truth constants in step 1's wake and schedule the long tail.
