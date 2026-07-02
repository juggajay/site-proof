# SiteProof v3 — Design-System Conformance Gap Analysis

**Audited commit:** `origin/master @ 3cc0d37`
**Date:** 2026-06-08
**Standard:** `docs/design-system.md` (the committed SiteProof v3 design system — "industrial-utilitarian, Linear-density", zinc-950 primary, no purple, no Inter, semantic tokens, sacred status colours).

**Bottom line:** the shipped frontend is still running the **unmodified shadcn "Violet + Zinc" starter theme**. None of the design-system token rewrite has landed. The good news: the highest-impact gap is a single-file token swap, and the semantic-token scaffolding the rest depends on is the same change. Everything in §1–§4 below should land in roughly one PR; §5 (the 239-file colour codemod) is the multi-day tail that depends on §1.

Legend: ✗ = not conformant · ◐ = partially conformant · ✓ = conformant.

---

## 1. Primary / ring / chart tokens — the violet anti-pattern (P0)

`frontend/src/index.css` line 6 literally comments the theme as `High-Growth Startup: Violet + Zinc`. The spec (§3, §4, §13) bans purple `#7c3aed` as "the #1 AI-slop signal" and "the violet anti-pattern in the current code we're replacing", and mandates a zinc-950 primary.

| Token | Current (`index.css`) | Spec target (§4) | Status | Notes |
|---|---|---|---|---|
| `--primary` | `262.1 83.3% 57.8%` (violet-600) `:17` | `240 10% 3.9%` (zinc-950) `§4:77` | ✗ | Drives every `bg-primary`/`text-primary`/`ring-primary`/`border-primary` (`tailwind.config.js:18-26`) — 111+ usages across 40+ files. |
| `--ring` | `262.1 83.3% 57.8%` `:34` | `240 10% 3.9%` (matches primary) `§4:94` | ✗ | Global focus ring is violet. |
| `.dark --primary` | `258.3 89.5% 66.3%` `:55` | `0 0% 98%` `§4:108` | ✗ | Also fails WCAG 4.5:1 as link text in dark mode (4.19:1) — see `accessibility-08`. |
| `--chart-1..5` | violet family (`:38` etc.) | recolour off violet | ✗ | Charts render violet; spec gives no exact chart palette — recolour to zinc + the new accent/status hues. |

**Action:** replace `--primary`, `--ring`, `.dark --primary`, and the 5 `--chart-*` vars. Update the line-6 comment. This one change repaints the landing hero, every default Button, links, the focus ring, the foreman capture FAB, and the ITP progress bar.

---

## 2. Missing semantic status tokens (blocks everything downstream)

The spec §4 defines a full status-token set. The shipped `:root` defines **only `--destructive`** — there is no `--success`, `--warning`, `--info`, and `--accent` is the wrong colour. Until these exist, `bg-success`/`bg-warning`/`bg-info` resolve to nothing and the colour codemod (§5) has no target.

| Token | Current | Spec target (§4) | Status | Notes |
|---|---|---|---|---|
| `--accent` | `240 4.8% 95.9%` (zinc-100 grey) | `38 92% 50%` (amber-500) `§4:81` | ✗ | Spec wants safety-amber accent; current is a neutral grey, so `bg-accent` is grey today. |
| `--success` | *(absent)* | `142 71% 35%` (emerald-700) `§4:85` | ✗ | Add token + `--success-foreground`. |
| `--warning` | *(absent)* | `38 92% 50%` (amber-500) `§4:87` | ✗ | Add token + `--warning-foreground`. |
| `--info` | *(absent)* | `217 91% 50%` (blue-600) `§4:91` | ✗ | Add token + `--info-foreground`. |
| `--destructive` | present (light + dark) | `0 72% 45%` (red-700) `§4:89` | ◐ | Exists; verify it matches the spec's red-700 value and has a dark variant. |
| Tailwind colour map | maps `accent` only (`tailwind.config.js`) | map `success`/`warning`/`info`/`accent` | ✗ | Add the four colour keys so `bg-success` etc. compile. |

**Action:** add the four token pairs to `:root` and `.dark`, and add matching colour keys in `tailwind.config.js theme.extend.colors`. This is the prerequisite for §5.

---

## 3. Background / radius / depth

| Token / rule | Current | Spec target | Status | Source |
|---|---|---|---|---|
| `--background` | `0 0% 98%` (off-white) `:8` | `0 0% 100%` (pure white) `§4:65` | ✗ | Spec's bordered-card-on-pure-white model needs a true-white canvas. |
| `--radius` | `0.5rem` (8px) `:36` | `0.375rem` (6px) `§4:95` | ✗ | Spec explicitly calls 8px "the current too-loose default". |
| `--border` / `--input` | `240 5.9% 90%` `:32-33` | `240 5.9% 88%` `§4:69-70` (and darker for 3:1) | ✗ | Spec wants slightly darker; WCAG needs darker still (~zinc-400/500) for 3:1 — see `accessibility-01`. |
| `--muted-foreground` | `240 3.8% 46.1%` `:24` | `240 5% 34%` (zinc-600) `§4:68` | ✗ | Spec darkens it "for outdoor readability"; current only just clears AA (4.63:1). |
| Button shadow | `shadow`/`shadow-sm` on variants (`button.tsx:12-18`) | "Buttons: no shadow" `§8:222` | ✗ | Drop shadow on non-modal button variants. |
| Card elevation | borders used | "Border, not shadow" `§8:214` | ✓ | Cards use `border` per spec. |
| Modal shadow | `shadow-xl` | only place dramatic shadow allowed `§8:216` | ✓ | Conformant. |

**Action:** fold all of these into the §1 token PR — they are the same file.

---

## 4. Typography — no fonts declared at all (P3, but a brand tell)

The whole-frontend grep for `font-family` / `fontFamily` / `@font-face` returns **zero design declarations** (only two print-only Arial strings in `PrintLabelsModal.tsx:127` and `LotQRCode.tsx:108`). `font-sans` therefore resolves to Tailwind's default `ui-sans-serif/system-ui` stack — the exact system/Inter-class stack §3 and §13 ban.

| Item | Current | Spec target (§5) | Status |
|---|---|---|---|
| Body font | Tailwind default system stack | `Geist` (or IBM Plex Sans) `§5:134` | ✗ |
| Display/mono font | none | `Geist Mono` (or JetBrains Mono) `§5:132` | ✗ |
| `theme.extend.fontFamily` | absent (`tailwind.config.js:16-106`) | `{ sans: ['Geist',…], mono: ['Geist Mono',…] }` | ✗ |
| `@font-face` | none in `index.css` | self-hosted woff2 | ✗ |
| `tabular-nums` on numeric columns | not used anywhere | "Numerical data uses `tabular-nums` always" `§5:150`, `§12:265` | ✗ |

**Action:** self-host Geist + Geist Mono, add `@font-face` to `index.css`, set `theme.extend.fontFamily`, and apply `tabular-nums` (+ `font-feature-settings`) on hours/cost/date columns. ~half a day. Promote alongside the §1 PR for a single visible "rebrand" diff.

---

## 5. Raw-colour offenders — the codemod (P1, multi-day)

The spec (§12 "use semantic tokens", §13 "status colours are sacred") requires status to flow through tokens. A repo-wide grep for raw palette utilities (`bg-/text-/border-` + `green|red|amber|blue|yellow|orange|emerald|gray|slate-NNN`) returns **1,468 occurrences across 239 files** (verifier-reproduced; the original triage said 1,453). These cannot be migrated until §2 lands the tokens.

### 5a. Source-of-truth maps (migrate first — fixing these covers most pills)

| File | What's hardcoded | Lines |
|---|---|---|
| `frontend/src/pages/lots/constants.ts` | `lotStatusColors`, `testPassFailColors`, `testStatusColors`, `ncrStatusColors`, `severityColors` (incl. `severityColors.major: 'bg-red-500 text-white'` at `:75`) | `41-76` |
| `frontend/src/pages/ncr/constants.ts` | `ncrStatusColors` (duplicates the lots map) | `7-13` |
| `frontend/src/pages/tests/constants.ts` | test status/pass-fail maps | `6-18` |
| `frontend/src/pages/dockets/docketActionData.ts` | desktop docket `statusColors` (yellow/green, no dark variants) | `18-32` |
| `frontend/src/components/foreman/DocketApprovalsMobileView.tsx` | private mobile `statusColors`/`statusLabels` (amber/emerald, has dark variants) | `47-61` |
| `frontend/src/pages/lots/lotsPageDisplay.ts` | Okabe-Ito lot palette | `2-8` |
| `frontend/src/pages/subcontractor-portal/subcontractorDashboardHelpers.ts` | third docket status map (light+dark) | `45-51` |

There are **at least three divergent docket-status maps** (desktop `docketActionData`, mobile `DocketApprovalsMobileView`, subbie `subcontractorDashboardHelpers`) and the same status renders different hues by surface (e.g. `approved` = green-100/green-800 desktop vs emerald-100/emerald-800 mobile; `pending_approval` = yellow vs amber). `statusLabels.ts` already documents that these maps "mirror" a shared source — extend that single source to colours.

### 5b. Highest-volume long-tail files (illustrative, from the original grep)

| File | Approx. raw-colour occurrences |
|---|---|
| `frontend/src/pages/reports/components/LotStatusTab.tsx` | ~32 |
| `frontend/src/pages/portfolio/components/PortfolioSections.tsx` | ~40 |
| `frontend/src/components/dashboard/ProjectDashboard.tsx` | ~40 |
| `frontend/src/components/charts/ClaimsCharts.tsx` | ~18 (literal hex) |

> Caveat from verification: a slice of the 239 files are legitimately non-status raw colours (print CSS, chart strokes, AI-confidence borders, the DEV-only RoleSwitcher), so "essentially every status pill" is slightly loose — but the volume and the source-of-truth claims hold.

**Action:** (1) land §2 tokens; (2) build a token-keyed colour map alongside the existing `frontend/src/lib/statusLabels.ts`; (3) migrate the 5a source-of-truth files; (4) codemod the 5b long tail incrementally (one domain per PR). Do **not** weaken `.fallowrc.json` or any pinned-string E2E to make a slice pass.

---

## 6. Bespoke palettes to delete (P3)

Spec §13: "Replace `civil`, `safety`, `lot` palettes with semantic tokens."

| Palette block | File | Usage | Action |
|---|---|---|---|
| `civil` 50–900 blue ramp | `frontend/tailwind.config.js:52-75` | only `AuthLayout.tsx:5,9` (auth-screen background) | Migrate the two call-sites, then delete. |
| `safety.orange/yellow/green/red` | `frontend/tailwind.config.js` | **zero call-sites repo-wide** | Delete (Tailwind emits no CSS for unused tokens, so no current user-visible impact). |
| `lot.open/hold/closed/failed` | `frontend/tailwind.config.js` | **zero call-sites** | Delete. |

---

## 7. Component-level conformance

| Component rule | Current | Spec | Status | Source |
|---|---|---|---|---|
| Button `success` variant | `bg-green-600 … ring-green-600` (`button.tsx:18`) | `bg-success text-success-foreground` `§7:178` | ✗ | Can't retune the docket-approval CTA centrally until §2 token exists. |
| Button focus ring | `focus-visible:ring-1` (`button.tsx:8`) | strong ~2px ring `§8`/WCAG | ✗ | Also `input.tsx:11`, `native-select.tsx:12`, `Hero.tsx:34,41`. See `accessibility-06`. |
| "Raise NCR" create action | `variant="destructive"` (`NCRPage.tsx:122`) | destructive reserved for "final delete confirmations" `§7:177`; red is the sacred NCR-open status `§4:120` | ✗ | Conflates a create action with the negative status it produces. See `heuristics-06`. |
| `ghost` variant | defined + used (`button.tsx:19`) | "No ghost buttons except `<X>` icon dismissals" `§7:179` | ◐ | Sampled usages are overwhelmingly `variant="ghost" size="icon"` (already permitted) — light audit only. |
| Status pills | `100`-bg + `800`-text on most pills | `bg-amber-100 text-amber-800` etc. `§7:185` | ◐ | Pattern correct where used; the white-on-saturated pills (`accessibility-02`) violate it. |
| Mobile card radius | `rounded-xl` (`DocketApprovalsMobileView.tsx:108`) | `rounded-md` `§7:180` | ✗ | See `design-system-conformance-04`. |
| Landing arbitrary hex | `bg-[#f97316]`, `text-[#10b981]` (`Hero.tsx:18,52,56`) | semantic tokens `§12` | ✗ | 9 arbitrary `[#…]` across 5 landing files; needs amber/success tokens to exist first. See `design-system-conformance-07`. |
| Motion / reduced-motion | always-on keyframes, no `prefers-reduced-motion` | "sparse and purposeful"; loaders banned `§9` | ◐ | Motion is sparse per §9, but no reduce-motion gate. See `accessibility-04`. |
| Loading states | bare spinners on core pages | "skeleton … no spinners except inline buttons" `§9:233` | ✗ | Direct §9 violation. See `states-02`, `states-03`. |

---

## 8. Remediation checklist (token-by-token, copy-paste order)

**PR 1 — `frontend/src/index.css` `:root` + `.dark` and `frontend/tailwind.config.js`:**

- [ ] `--primary` → `240 10% 3.9%`; `--primary-foreground` → `0 0% 100%`
- [ ] `--ring` → `240 10% 3.9%`
- [ ] `.dark --primary` → `0 0% 98%` (clears 4.5:1 link text)
- [ ] `--background` → `0 0% 100%`
- [ ] `--radius` → `0.375rem`
- [ ] `--border` / `--input` → darken to clear 3:1 (target ~zinc-400/500, NOT L80%)
- [ ] `--muted-foreground` → `240 5% 34%`
- [ ] `--accent` → `38 92% 50%`; `--accent-foreground` → `240 10% 3.9%`
- [ ] ADD `--success` `142 71% 35%` + `--success-foreground` `0 0% 100%`
- [ ] ADD `--warning` `38 92% 50%` + `--warning-foreground` `240 10% 3.9%`
- [ ] ADD `--info` `217 91% 50%` + `--info-foreground` `0 0% 100%`
- [ ] Verify `--destructive` = `0 72% 45%` (+ dark variant)
- [ ] Recolour `--chart-1..5` off violet
- [ ] `tailwind.config.js`: add `success`/`warning`/`info` colour keys (accent already mapped)
- [ ] Update the `:root` comment (drop "Violet + Zinc")
- [ ] Drop `shadow`/`shadow-sm` on non-modal Button variants (`button.tsx`)
- [ ] Add global `@media (prefers-reduced-motion: reduce)` reset (`accessibility-04`)

**PR 2 — Fonts:**

- [ ] Self-host Geist + Geist Mono woff2; add `@font-face`
- [ ] `theme.extend.fontFamily = { sans: ['Geist',…], mono: ['Geist Mono',…] }`
- [ ] `tabular-nums` on numeric columns (hours/cost/date)

**PR 3 — Focus ring:**

- [ ] `button.tsx:8`, `input.tsx:11`, `native-select.tsx:12`: `ring-1` → `ring-2` (+ offset)
- [ ] `Hero.tsx:34,41`: `ring-1` → `ring-2`

**PR 4+ — Colour codemod (after PR 1):**

- [ ] Build token-keyed colour map next to `statusLabels.ts`
- [ ] Migrate `lots/constants.ts`, `ncr/constants.ts`, `tests/constants.ts`, `docketActionData.ts`, `DocketApprovalsMobileView.tsx`, `subcontractorDashboardHelpers.ts` onto it (kills the 3-map docket divergence + `design-system-conformance-04`)
- [ ] Button `success` → `bg-success`; "Raise NCR" → primary variant
- [ ] Mobile card `rounded-xl` → `rounded-md`
- [ ] Landing arbitrary hex → `bg-accent`/`text-success`; chart hex → chart vars
- [ ] Migrate `civil-*` (AuthLayout) then delete civil/safety/lot palette blocks
- [ ] Codemod the long-tail 239 files incrementally, one domain per PR

> Verification note for all of the above: `frontend/e2e/productionReadiness.spec.ts` and similar static-string specs pin exact markup/imports on some guarded pages. When a token/colour change touches a pinned string, **repoint the test, never weaken it** — and don't run `test:readiness` back-to-back with `lot-detail.spec.ts` (shared `:5174` reuse causes spurious failures, per project memory).
