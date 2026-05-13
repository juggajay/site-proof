# SiteProof v3 — Design System

> **Upload this file to Claude Design as the design-system input.** Re-paste at the top of every Claude Design session — sessions don't persist context.

---

## 1. Product context

**SiteProof v3** is a construction quality management platform for **Australian civil contractors**. The buyer is a head contractor (HC); the daily user is a foreman approving subcontractor dockets on a phone at 7am on a worksite. The product manages lots, ITPs, hold points, NCRs, daily diaries, dockets, progress claims, and documents.

**Three workflow loops:**
- **Quality compliance** (ITPs / hold points / tests) — regulator-facing, legal touchpoint with the principal/superintendent
- **Daily cost** (dockets → diary) — the daily-habit hook; foreman approves subbie hours each shift
- **Revenue** (lots → progress claims) — monthly billing with SOPA statements

**Tenancy:** Head contractors pay (subscription tiers: basic / professional / enterprise / unlimited). Subbies are free, accessing the HC's tenant via invitation.

---

## 2. Aesthetic direction — commit to this, do not hedge

**Industrial-utilitarian, Linear-density.** Closer to Linear than Stripe. Closer to Vercel than Notion. Confident, dense, restrained. Bias toward functional clarity over decorative warmth.

**Reference sites for visual feel:**
- **Linear** — monochrome density, tight type scale, no decorative shadows
- **Vercel dashboard** — restrained palette with one strong accent
- **GitHub Primer** — dense data tables, status pills

**The one thing someone will remember:** *"It looks like the construction industry deserves serious tooling, not a B2C wellness app."*

---

## 3. Banned defaults (these will produce AI slop — never use)

**Typography:**
- ❌ Inter / Inter Tight (overused AI default)
- ❌ Roboto / Arial / system stack
- ❌ Space Grotesk (overused in 2024-2025 AI generations)
- ❌ Poppins / Nunito / DM Sans

**Color:**
- ❌ Purple primary (`#7c3aed` family) — the #1 AI-slop signal
- ❌ Purple-to-blue gradients on white
- ❌ Pastel accent palettes
- ❌ Soft pink / lavender / mint backgrounds

**Layout:**
- ❌ Generic SaaS landing-page hero with "Get started free" + dashboard screenshot
- ❌ Three-column feature grids with rounded icon squares
- ❌ Card-on-white-background with soft drop shadows

**Iconography:**
- ❌ Default Heroicons in muted greys at 24×24 with `mr-2` next to text — the universal AI-output signature
- ❌ Lucide icons sized inconsistently across components

---

## 4. Color palette

### Primary system (semantic tokens — these go in `index.css`)

```css
:root {
  /* Neutrals — true zinc, no chromatic tint */
  --background: 0 0% 100%;          /* pure white */
  --foreground: 240 10% 3.9%;       /* zinc-950, near-black ink */
  --muted: 240 4.8% 95.9%;          /* zinc-100 */
  --muted-foreground: 240 5% 34%;   /* zinc-600 — darker than current for outdoor readability */
  --border: 240 5.9% 88%;           /* slightly darker than current for tighter grid feel */
  --input: 240 5.9% 88%;
  --card: 0 0% 100%;
  --card-foreground: 240 10% 3.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 240 10% 3.9%;

  /* Primary — near-black for confident chrome (NOT violet) */
  --primary: 240 10% 3.9%;          /* zinc-950 — actions, links, focus */
  --primary-foreground: 0 0% 100%;

  /* Accent — safety amber for "needs attention" / pending */
  --accent: 38 92% 50%;             /* amber-500 — leverages construction visual language */
  --accent-foreground: 240 10% 3.9%;

  /* Status semantics */
  --success: 142 71% 35%;           /* emerald-700 — approved, conformed */
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;            /* amber-500 — pending, hold-point waiting */
  --warning-foreground: 240 10% 3.9%;
  --destructive: 0 72% 45%;         /* red-700 — rejected, NCR open, failed */
  --destructive-foreground: 0 0% 100%;
  --info: 217 91% 50%;              /* blue-600 — informational, drafts */
  --info-foreground: 0 0% 100%;

  --ring: 240 10% 3.9%;             /* matches primary */
  --radius: 0.375rem;               /* 6px — slightly tighter than current 8px */
}
```

### Dark mode (worksite shed / night use)

```css
.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --muted: 240 4% 14%;
  --muted-foreground: 240 5% 65%;
  --border: 240 4% 18%;
  --primary: 0 0% 98%;
  --primary-foreground: 240 10% 3.9%;
  --accent: 38 92% 55%;             /* amber-500 brighter for dark bg */
}
```

### Status semantics — apply consistently

| Concept | Token | Light hex | When |
|---|---|---|---|
| Approved / Conformed / Released | `bg-success` | `#15803d` | Final positive states |
| Pending action / Awaiting review | `bg-warning` | `#f59e0b` | Anything blocking the user's day |
| Rejected / Failed / NCR Open | `bg-destructive` | `#b91c1c` | Final negative states |
| Draft / Informational | `bg-info` | `#2563eb` | Non-blocking, in-progress |
| Closed (done, no further action) | `bg-muted` | `#f4f4f5` | Inactive/archived |

**Status pills** use `100`-shade background + `800`-shade text, e.g. `bg-emerald-100 text-emerald-800`. **Status borders/buttons** use the saturated value above.

---

## 5. Typography

### Fonts — distinct from AI defaults

**Display (headlines, page titles, dashboard numbers):** **`Söhne Breit`** (preferred, paid) OR **`Geist Mono`** (free Vercel font, monospace for data) OR **`JetBrains Mono`** (free, distinctive engineering aesthetic).

**Body / UI (default text, forms, tables):** **`Geist`** (Vercel, free, distinctive enough to pass the AI-default test) OR **`IBM Plex Sans`** (industrial heritage, free).

**Recommended combo:** `Geist Mono` (display) + `Geist` (body) — coherent family, free, distinctive, signals engineering tool, not consumer SaaS.

### Type scale (3× ratio between display tiers, not 1.25)

| Role | Size | Weight | Usage |
|---|---|---|---|
| Display | 36px / 2.25rem | 700 | Page hero, dashboard metric numbers |
| H1 | 24px / 1.5rem | 700 | Page titles |
| H2 | 18px / 1.125rem | 600 | Section headers |
| H3 | 14px / 0.875rem | 600 | Subsection / card titles |
| Body | 14px / 0.875rem | 400 | Default text |
| Small | 13px / 0.8125rem | 400 | Table cells, dense data |
| Micro | 11px / 0.6875rem | 500 | Status pills, uppercase labels (`tracking-wide uppercase`) |

**Numerical data uses `tabular-nums` always** — column alignment is non-negotiable for hours, costs, dates.

---

## 6. Spacing and density

**Linear density, not Stripe density.** Foremen scan; they don't browse.

- **Card padding:** `p-4` mobile, `p-6` desktop (NOT `p-8`+)
- **Stack spacing:** `space-y-3` for related items, `space-y-6` for sections
- **Page padding:** `p-4` mobile, `p-6` desktop max
- **Touch targets:** minimum 44×44px on mobile (already encoded as `.touch-target` utility)
- **Table row height:** 40px (denser than default shadcn 48px) — worksite use needs more rows visible

---

## 7. Components

### Use shadcn primitives, customize via tokens, don't replace

The codebase has shadcn `new-york` style with lucide icons. Don't propose Material UI, Chakra, or hand-rolled components. Customize the existing primitives.

### Buttons

- **Primary:** `bg-primary text-primary-foreground` — near-black, used sparingly (one per view)
- **Secondary:** `bg-muted text-foreground` — most actions
- **Outline:** `border border-border bg-transparent` — destructive actions, cancel
- **Destructive:** `bg-destructive text-destructive-foreground` — final delete confirmations
- **Success:** `bg-success text-success-foreground` — final approval CTA on docket flow
- No "ghost" buttons except for `<X>` icon dismissals
- **Border radius:** `rounded-md` (`6px`) — tighter than default `rounded-lg`

### Status pills

```jsx
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide bg-amber-100 text-amber-800">
  Pending
</span>
```

Always uppercase, always tracking-wide, always tight padding.

### Cards (mobile docket card pattern)

```jsx
<div className="bg-card border border-border rounded-md p-4 space-y-3 active:scale-[0.98] transition-transform">
  {/* Header: title + status pill */}
  {/* 3-col grid: date / labour / plant */}
</div>
```

Border, not shadow. Active-press scale, not elevation. Tight grid for primary fields.

### Tables (desktop docket approvals pattern)

- Header: `bg-muted/50` + `text-xs uppercase tracking-wide text-muted-foreground`
- Row: 40px tall, hover `bg-muted/30`
- Numerical columns right-aligned with `tabular-nums`
- Status pills in their own narrow column

---

## 8. Depth and elevation

**Mostly flat. Borders define structure, not shadows.**

- Modals: `shadow-xl` (the only place dramatic shadow is allowed)
- Cards: `border` only
- Buttons: no shadow
- Dropdowns/popovers: `shadow-md` + `border`
- Hover states: change background, not elevation

---

## 9. Motion

**Sparse and purposeful.**

- **Press feedback:** `active:scale-[0.98]` on tappable cards (existing utility `.card-press`)
- **Page entry:** none. Pages render flat.
- **Modals:** fade-in + scale from 95% (existing `.zoom-in-95` + `.fade-in`)
- **Swipe-to-approve:** spring physics on `SwipeableCard` (existing)
- **Banned:** parallax, scroll-triggered animations, decorative loaders, shimmer effects
- **Loading states:** skeleton (`bg-muted animate-pulse`), no spinners except inline buttons

---

## 10. Iconography

- **Library:** Lucide (already installed, don't change)
- **Default size:** `h-4 w-4` (16px) for inline, `h-5 w-5` (20px) for buttons, `h-6 w-6` (24px) for navigation
- **Color:** match the surrounding text — `text-foreground` for primary, `text-muted-foreground` for secondary
- **Stroke width:** default `2` (Lucide default); for emphasis use `1.5` not `1`

---

## 11. Mobile-specific

The foreman docket-approval flow is the daily-habit hook. Optimize for it.

- **Outdoor readability:** body text minimum 14px, primary CTAs 16px
- **Touch targets:** 44×44px minimum (existing `.touch-target` utility)
- **Pull-to-refresh:** standard iOS-style indicator (existing `usePullToRefresh` hook)
- **Swipe-to-action:** right-swipe approves, left-swipe rejects (existing `SwipeableCard` component)
- **Bottom-safe-area padding:** required for notched devices (existing `pb-safe` utility)
- **Filter pills:** horizontal scroll, no wrap, `whitespace-nowrap`
- **Status pill on card header right side, never the card body** — scannable at thumb-distance

---

## 12. Do's

- ✅ **Commit to one strong direction.** Industrial-utilitarian. Don't hedge.
- ✅ **Use semantic tokens.** `bg-primary`, `text-foreground`, `border-border` — not raw `bg-zinc-900`.
- ✅ **Status colors are sacred.** Approved is always `success`, rejected always `destructive`.
- ✅ **Tabular-nums on every numerical column.**
- ✅ **Mobile is first-class, not a degraded desktop.** Foreman docket flow is the hero use case.
- ✅ **Density over whitespace.** Linear, not Stripe.
- ✅ **Border-defined structure.** Shadows only on modals/popovers.
- ✅ **Australian English in copy** — "subcontractor", "labour" (not "labor"), "colour", date formats `8 May 2026`.

## 13. Don'ts

- ❌ **Don't use Inter, Roboto, Arial, or Space Grotesk.**
- ❌ **Don't use purple primary or purple-to-blue gradients.** This is the violet anti-pattern in the current code we're replacing.
- ❌ **Don't add decorative gradients, mesh backgrounds, or grain textures.** Wrong vibe for B2B construction.
- ❌ **Don't soft-shadow cards.** Border or nothing.
- ❌ **Don't introduce new color systems.** Replace `civil`, `safety`, `lot` palettes with semantic tokens.
- ❌ **Don't propose Material UI / Chakra / Mantine.** We're shadcn.
- ❌ **Don't use cards-on-white-background.** Background is white; cards are bordered, not floating.
- ❌ **Don't write em-dash trios for emphasis.** UI copy stays terse.

---

## 14. Agent prompt guide (paste this when asking Claude to design a screen)

When you ask Claude to design a SiteProof screen, frame the prompt as:

> "Design `<screen name>` for `<role: foreman / project manager / subcontractor>` on `<device: mobile / desktop>`.
>
> **Goal:** `<what the user is trying to accomplish>`
>
> **Key data shown:** `<list of fields>`
>
> **Primary action:** `<the one thing they'll do>`
>
> **Secondary actions:** `<2-3 max>`
>
> **Visual reference:** Linear's `<specific-page>` for density, Vercel for restraint.
>
> **Follow the SiteProof DESIGN.md.** Specifically: industrial-utilitarian, no Inter, no purple, semantic tokens, tabular-nums on numbers, status pills uppercase tracking-wide.
>
> **Banned:** `<call out specific things to avoid for this screen>`
>
> Generate the React + Tailwind code using shadcn primitives."

---

## 15. Validation prompts (test the system before designing real screens)

Run these in Claude Design after uploading this DESIGN.md. If outputs look generic, the system isn't tight enough — harden it before continuing.

1. *"Design a marketing landing page for SiteProof, a construction quality management platform for Australian civil contractors."* (Should produce industrial-utilitarian, no purple, no Inter, dense.)
2. *"Design a settings page with a sidebar and three content sections: profile, notifications, billing."* (Should produce dense, bordered, monochrome with one accent.)

If either output drifts toward AI slop (purple, Inter, soft shadows, three-column feature cards), add a fresh banned-list line to this file.
