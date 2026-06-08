# SiteProof v3 — Design System ("Quiet Authority")

> **Implemented source of truth.** This supersedes the aspirational `docs/design-system.md`.
> The live token set lives in `frontend/src/index.css` (`:root` + `.dark`) and is mapped in
> `frontend/tailwind.config.js`. Reference mockups: `docs/design-mockups/siteproof-premium.html`
> (HC desktop), `foreman-mobile.html`, `subbie-mobile.html` — each toggles light/dark.

## Aesthetic

Refined industrial minimalism. **Monochrome by default; colour is a scarce signal that means
"a human needs to decide here."** Premium comes from *material and warmth*, not colour:

1. **Warm greige neutrals**, never cold zinc or pure black (cold grey reads clinical/AI-default).
2. **Pure-white cards on a warm canvas** with imperceptible shadows — depth you feel, not see.
3. **One deep-amber brand signature** (`--brand`) used on the single most important affordance
   per view (active nav rail, mobile capture button). Never decoration.
4. **IBM Plex Sans / IBM Plex Mono** — engineering heritage, deliberately not the Inter/Geist
   AI-default cluster. Numbers, codes, IDs always in Plex Mono with `tabular-nums`.
5. **Hairlines define structure**, not drop shadows. Flat, crisp.

## Hard invariants (machine-checked in the rollout)

These are non-negotiable and are enforced as automated gates when the theme is applied across the app:

- **INV-1 — White text on dark surfaces.** Any text rendered on a dark (`.dark`) surface or on a
  saturated/dark colour fill MUST use a light foreground that clears WCAG AA (≥4.5:1 body, ≥3:1 large).
  No dark-on-dark. Secondary/muted text in dark mode is deliberately brightened for this reason.
- **INV-2 — No white-on-white in inputs/text boxes.** Every input, textarea, select, and editable
  surface MUST resolve to a readable bg/foreground pair in BOTH themes. No `bg-white` + light text.
  Inputs use `bg-background`/`bg-card` + `text-foreground` (token-driven), never hardcoded `bg-white`.
- **INV-3 — Colour means status, never decoration.** Default everything to neutral; introduce
  `--success/--warning/--destructive/--info/--brand` only where the colour carries meaning.
- **INV-4 — Status is never colour-alone.** Pair every status colour with a label/icon (WCAG 1.4.1).

## Tokens (HSL — as in `index.css`)

`--brand` is the amber signature; `--accent` stays a NEUTRAL grey (shadcn components consume it for
hovers — making it amber would scatter colour everywhere).

### Light
| Token | HSL | Note |
|---|---|---|
| `--background` | `40 14% 96%` | warm canvas |
| `--foreground` | `24 14% 9%` | warm near-black ink |
| `--card` / `--popover` | `0 0% 100%` | pure white, pops on canvas |
| `--primary` | `24 14% 9%` | near-black actions/buttons |
| `--primary-foreground` | `40 33% 98%` | warm white |
| `--secondary` / `--muted` / `--accent` | `40 15% 93%` | warm grey (hovers) |
| `--muted-foreground` | `30 8% 32%` | warm secondary text |
| `--border` / `--input` | `38 18% 89%` | warm hairline |
| `--ring` | `24 14% 9%` | near-black focus |
| `--brand` | `26 90% 37%` | deep-amber signature |
| `--success` | `142 72% 29%` | emerald-700 |
| `--warning` | `32 95% 44%` | amber |
| `--destructive` | `4 74% 40%` | red-700 |
| `--info` | `217 79% 45%` | blue |
| `--radius` | `0.5rem` | |

### Dark (warm charcoal, not cold black)
| Token | HSL | Note |
|---|---|---|
| `--background` | `30 16% 7%` | warm near-black canvas |
| `--foreground` | `40 30% 94%` | warm off-white (INV-1) |
| `--card` / `--popover` | `30 16% 10%` | raised surface |
| `--primary` | `40 30% 94%` | inverts to off-white |
| `--primary-foreground` | `30 16% 7%` | dark text on light button |
| `--secondary` / `--muted` | `33 14% 15%` | raised neutral |
| `--muted-foreground` | `36 16% 70%` | **brightened** for INV-1 |
| `--accent` | `33 14% 17%` | hover neutral |
| `--border` / `--input` | `33 15% 17%` | |
| `--brand` | `38 92% 50%` | brighter amber on dark |
| `--success` | `156 64% 52%` | brighter |
| `--warning` | `43 96% 56%` | brighter |
| `--destructive` | `0 88% 71%` | brighter |
| `--info` | `213 92% 68%` | brighter |

## Typography
- Body/UI: **IBM Plex Sans** (`font-sans`). Display headings 600–700, tight tracking.
- Data/codes/IDs/numbers: **IBM Plex Mono** (`font-mono`) + `tabular-nums`.
- Loaded in `frontend/index.html`; stacks set in `tailwind.config.js theme.extend.fontFamily`.
- *Production hardening follow-up:* self-host via `@fontsource/ibm-plex-sans` + `-mono` (currently
  loaded from Google Fonts to ship the rebrand quickly).

## Components (shadcn — customise via tokens, don't replace)
- **Primary button:** `bg-primary text-primary-foreground` (near-black light / off-white dark).
- **Brand signature:** `--brand` on active nav + mobile capture/new-docket button only.
- **Status pills:** `100`-bg + `800`-text family (light), token-driven; uppercase, `tracking-wide`.
- **Cards:** `bg-card border` + the subtle shadow utility; never heavy drop shadows.
- **Inputs:** token-driven bg/fg (INV-2). **Radius** `rounded-md`.

## Rollout (see chat strategy)
Phase 0 (this PR): token + font swap in `index.css` / `tailwind.config.js` — kills the violet
app-wide. Phases 1–4: discover → migrate per domain (worktree-isolated, one PR each) →
adversarially verify each surface in BOTH themes with INV-1/INV-2 as automated gates → completeness
critic. Do not weaken pinned E2E specs (`productionReadiness.spec.ts` etc.) — repoint.
