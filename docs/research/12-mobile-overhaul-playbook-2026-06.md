# Mobile Overhaul Playbook — SiteProof v3 (June 2026)

Synthesis of four verified research streams (2026-06-11): (1) PWA case studies —
what made Pinterest/Twitter Lite/Flipkart/Tinder/Starbucks feel native;
(2) construction field-app review mining — what foremen reward and what makes
them quit (Fieldwire, Raken, SafetyCulture, CompanyCam, Procore, Dashpivot,
Assignar, HammerTech, PlanGrid, Buildertrend); (3) gesture-physics engineering
(WWDC18 fluid interfaces, vaul, Material 3, framer-motion patterns);
(4) PWA failure modes and iOS platform traps (state as of June 2026).

This is the **one-time** reference for the foreman mobile overhaul. Every
build PR in the wave should cite the section it implements.

---

## 0. The one-paragraph thesis

Every famous "feels native" PWA earned it in the same order: **(1) instant
paint and instant tap response (app shell + small JS + optimistic UI), (2)
skeletons matched to final layout — never spinners, (3) 60fps lists and
200–350ms platform-standard motion, (4) bottom nav + ≥48px targets + removal
of web "tells", (5) install + offline as the retention layer.** No case study
credits flashy animation; polish is the last 10% on top of an input-latency
foundation. For field workers specifically, the evidence is blunter: **losing
data once ends trust permanently** (Raken "loses my daily log", Assignar
reinstall wipes dockets, CompanyCam vanished photos → "couldn't get paid"),
and the second-worst sin is **non-deterministic sync** ("sometimes straight
away, other times hours"). SiteProof's overhaul must therefore harden the
offline/sync trust story *while* upgrading the feel.

---

## 1. What field workers reward (review-mined, cross-app)

1. **Capture-first home** — CompanyCam's camera-as-home-action; Raken's
   "tap +, dictate, ✓". Most-frequent action = zero navigations away. File
   (project/GPS/time/author) automatically AFTER capture, never before.
   SiteProof already has this shape in `CaptureModal` + the ForemanBottomNavV2
   center button — keep and tighten.
2. **Offline that's invisible, sync that's legible** — Fieldwire's task number
   appearing = "sync succeeded" signal; CompanyCam's explicit banner
   "*(#) items waiting to upload — waiting for connection*". Reward is never
   having to think about connectivity. SiteProof: make the sync queue state
   visible and deterministic (see §4).
3. **Voice-to-text on every notes field** — Raken's single most-praised
   feature. Foremen narrate, they don't type. (Web reality: rely on the
   keyboard mic key; ensure fields don't fight autocorrect/autocap; Web
   Speech API is unreliable on iOS Safari — don't build on it.)
4. **A definite "done" moment** — Raken's Sign-and-complete → locked PDF →
   auto-emailed. The day audibly closes. SiteProof's `DiaryFinishFlow` is the
   hook — make submission feel ceremonial (full-screen confirm, haptic on
   Android, then "diary sent to X").
5. **Pre-filled everything** — auto weather, yesterday's crew carried forward,
   GPS-matched project. Every prefilled field is one a tired foreman doesn't
   type at 4:30pm in the ute.
6. **One-thumb status gestures** — Fieldwire's swipe-to-advance is named in
   reviews. Walking + one hand free is the default posture.
7. **Big, unambiguous current-state display** — the inverse of Buildertrend's
   "which job am I clocked into?" confusion. Always show where data goes
   (project/lot banner in capture flows).
8. **Readable long names** — Dashpivot's truncated worklot IDs is a named
   complaint. Civil lot IDs are long; never ellipsize them into ambiguity.
9. **Escape hatches over data rules** — Procore's "can't log a one-day subbie
   because he's not in the master directory" is a top abandonment driver.
   Field gets free-text fallback; office reconciles later.
10. **Stability between updates** — surprise UI reshuffles and "glitches after
    updates" are universal complaints. Muscle memory is the real interface;
    batch layout changes, announce them in-app.

### What makes them abandon (ranked)
Data loss (once) > non-deterministic sync > failure at the signature moment >
login friction > desktop IA on a phone > office rules blocking field reality >
foreground-hostage uploads > perceived slowness > surprise reshuffles >
form-builder density. Every PR in the wave should be checked against this list.

---

## 2. Gesture engine spec (replaces hand-rolled SwipeableCard + BottomSheet)

framer-motion v12 is already installed — use its drag primitives.
`onDragEnd(e, info)` gives `info.velocity` in px/s; that alone fixes the
current "no velocity detection" gap.

### Canonical decision rule (everything uses this)
```
projected = offset + velocity / 2        // WWDC18 projection, decel 0.998
trigger   = |projected| past threshold   // a flick OR a slow drag both work
```
Always seed the settle spring with `info.velocity` — gesture-to-animation
velocity continuity is the #1 "feels native" trick.

### Parameter table (lift directly)
| Parameter | Value |
|---|---|
| **SwipeableCard** | |
| Reveal-open threshold | ½ of revealed action panel width (projected) |
| Full-swipe execute | projected past 50% of row width OR velocity > 400 px/s in direction |
| `dragElastic` | 0.15 (iOS-like resistance) |
| `dragMomentum` | `false` — drive the settle yourself |
| Settle spring | `{ type:'spring', stiffness:400, damping:40, velocity:info.velocity.x }` |
| CSS on row | `touch-action: pan-y` (or list scroll breaks) |
| **BottomSheet** | |
| Snap points | `[0.45, 0.92]` of *visual* viewport + 0 = closed |
| Dismiss | velocity.y > 450 px/s down OR dragged > 25% below lowest snap |
| Snap selection | nearest snap to projected endpoint (flicks may skip points) |
| Open/close | spring `{ stiffness:300, damping:30 }` seeded with velocity |
| Grab handle | 32–36×4px pill inside ≥48px touch target, `touch-action:none` |
| Backdrop | opacity tied to sheet position during drag (not separate anim) |
| Scroll-vs-drag | vaul's `shouldDrag`: sheet takes over only when inner scroller at `scrollTop===0` and gesture is downward; **100ms lockout** after scroller reaches top; ignore second touches |
| Keyboard | `maxHeight = visualViewport.height`, re-snap on `visualViewport` resize; `dvh` fallback |
| **Pull-to-refresh** (keep existing hook, retune) | |
| Resistance | indicator = 0.5 × drag |
| Trigger | 64–72px, **distance-only on release** (flicks must not trigger refresh) |
| Past-trigger tension | quadratic cap ~2× slingshot |
| Arm | only when `scrollTop===0` at touchstart + `overscroll-behavior-y: contain` |
| **Haptics** | |
| Android | `navigator.vibrate(5–15ms)` at gesture *commit points* only |
| iOS | none — `navigator.vibrate` unsupported; checkbox-switch hack patched in iOS 26.5. Pair every commit with a synchronized visual tick instead |

### Motion system (app-wide)
- Micro-interactions 100–200ms; in-screen transitions 250–350ms; nothing
  over ~500ms. Enter slower than exit. Easing: Material standard
  `cubic-bezier(0.2, 0, 0, 1)`; sheet curve `cubic-bezier(0.32, 0.72, 0, 1)`.
- Respect `prefers-reduced-motion` everywhere.
- Tab/page changes: View Transitions API where supported (progressive
  enhancement), else 250ms fade — never a blank flash.
- Library note: vaul / react-modal-sheet are the reference implementations,
  but both are NEW packages (AVG TLS blocks fresh npm fetches on this
  machine — see tasks/lessons.md). Hand-roll on framer-motion replicating
  vaul's `shouldDrag` + lockout + projection; it's ~60 lines per component.

### Remove the web "tells" (one CSS PR)
`overscroll-behavior-y: none` on html/body (kills browser PTR + rubber-band
chaining), `viewport-fit=cover` + `env(safe-area-inset-*)` on bottom bars
(partially done), `user-select:none` on UI chrome (not content), no tap
highlight, suppress long-press context menus on interactive elements,
`:active` states on everything tappable (100ms response rule — visible
feedback on EVERY tap within 100ms, via optimistic UI / TanStack `onMutate`).

---

## 3. Performance budget (the foundation feel comes from)

- **100ms** visible response to any tap (RAIL); optimistic UI for mutations.
- **16ms** frame budget (10ms practical): animate transform/opacity only;
  virtualize long lists (lots list with hundreds of rows); size images
  correctly (Twitter's 300ms→16ms decode win was their biggest jank fix).
- Skeletons matched to final layout (no layout shift when content lands) —
  never spinners on primary screens. Pinterest-style dominant-color photo
  placeholders are a cheap win for photo grids.
- Route-chunk budget: entry ≤ ~200KB gz, async route chunks 13–18KB
  (Pinterest's numbers). Audit with bundle analyzer before/after the wave.
- Test on a 3-year-old Android over throttled 3G — that's the site
  reality. Every successful team profiled on low-end hardware.

---

## 4. Offline trust hardening (iOS traps — severity-ranked)

Platform facts current as of June 2026; re-verify anything > 12 months old.

**SEV-1 (violates "never lose work"):**
1. **iOS evicts IndexedDB** (7-day rule in browser tabs; LRU under pressure;
   "Clear History and Website Data" wipes it; deleting the icon deletes data).
   → Treat Dexie as a short-lived **outbox**, not a store of record: flush on
   app open, `online`, `visibilitychange→visible`, and a foreground timer.
   Call `navigator.storage.persist()` early, verify with `persisted()`,
   surface the result. Drive home-screen install (installed apps get their
   own days-of-use counter + the persist() heuristic).
2. **No Background Sync API on iOS — ever (confirmed absent through iOS 26.5).**
   Queue flushes only while foregrounded. → Persistent "X items not synced"
   badge so the foreman knows to reopen on signal; warn when items stuck
   > N hours.
3. **Safari ↔ installed-app storage isolation** (iOS 14+): work queued in the
   Safari tab does not exist in the home-screen app; sessions don't carry.
   → Detect `display-mode`, steer foremen to exactly one surface (the
   installed app), warn on the other.
4. **`registerType: 'autoUpdate'` reloads mid-entry** — vite-plugin-pwa's own
   docs say form-heavy apps should use `'prompt'`. A foreman mid-diary losing
   the form is a "lost work" event. → Switch to `prompt` (mind the
   skip-waiting migration trap, vite-plugin-pwa #743) AND autosave drafts to
   Dexie continuously (sheet drafts already exist — extend coverage).

**SEV-2 (app breaks):**
5. **Stale HTML → lazy-chunk 404 → white screen after deploy.** → Verify SW
   precache globs cover every lazy chunk; keep previous deploys' hashed
   assets on the host; `vite:preloadError` catch-and-reload-once with loop
   guard; `index.html` served `no-cache`.
6. **Camera in iOS standalone**: permission not persisted (re-prompts),
   getUserMedia streams die after backgrounding. → Keep using
   `<input type="file" capture>` (current approach — correct); never build a
   live viewfinder on getUserMedia for iOS.
7. **iOS web push dies silently**: subscription killed after 3 pushes that
   don't call `event.waitUntil(showNotification())`; endpoints expire
   spontaneously. → Audit `sw-push.js` for the always-show rule; handle 410s
   server-side by prompting re-subscription; never make push the only channel.
8. **Stale-build stranding** (autoUpdate sometimes never reloads). → In-app
   version display + hourly/on-focus `registration.update()` + manual
   "check for updates".

**SEV-3 (adoption):**
9. **iOS install friction**: no `beforeinstallprompt` on iOS; 3 manual taps
   users don't know exist. → Onboarding-gated, bottom-anchored illustrated
   sheet (point at the Share icon at the bottom); for foreman/subbie roles
   treat install as effectively required ("install for offline mode").
   Chromium: handle `beforeinstallprompt` with an engagement-gated custom
   prompt (30%+ lift vs immediate). iOS 26 opens home-screen sites as web
   apps by default — discovery unchanged, so the nudge still matters.
10. **Quota pressure from photo queues.** → `storage.estimate()` monitoring,
    compress before queueing (exists), upload-and-evict eagerly.
11. **Platform risk** (Apple's Feb 2024 EU PWA scare, reversed Mar 2024).
    → Keep the codebase **Capacitor-ready**: storage behind an adapter, no
    SW-only critical paths, feature-detect everything. If iOS offline trust
    ever needs to be bulletproof, a Capacitor iOS wrap (same React code,
    native push + app-container storage + background upload) is a packaging
    exercise, not a rewrite. Decision deferred — not part of this wave.

---

## 5. Build wave (sequenced; one PR each unless noted)

Phase 0 — **Ground truth**: agent audit of every route at 390px viewport →
ranked list of desktop-leak screens; foreman walk-through notes from Jay.

Phase 1 — **Trust + gesture foundation** (do these first; everything else
sits on them):
- PR-A: SW update strategy `autoUpdate` → `prompt` + version display +
  update-check escape hatch + chunk-404 catch-and-reload (§4.4, 4.5, 4.8).
- PR-B: `storage.persist()` + `estimate()` + sync-state surfacing: visible
  queue counter ("3 items waiting — waiting for connection"), stuck-item
  warning, flush triggers on open/online/visible/timer (§4.1–4.2).
- PR-C: SwipeableCard rebuild on framer-motion per §2 table (all users of the
  shared component upgrade at once: dockets, lots, NCRs).
- PR-D: BottomSheet rebuild per §2 table (drag-to-dismiss, snap points,
  shouldDrag, keyboard avoidance) — all diary sheets upgrade at once.
- PR-E: web-tells CSS sweep + `:active` states + `prefers-reduced-motion`
  (§2 "remove the web tells").

Phase 2 — **Close the desktop leaks** (list from Phase 0; expected: docket
approve/reject/query modal → bottom sheet; lot detail non-ITP tabs; NCR
detail; create/edit forms used by foremen).

Phase 3 — **App shell + install**: skeletons matched to layout on the four
foreman screens, View-Transition/fade tab changes, install nudges (iOS
illustrated sheet + Chromium beforeinstallprompt), display-mode steering
(§4.3, 4.9).

Phase 4 — **Day-loop polish**: Today tab as true home, capture flow ≤10s
audit, voice-friendly notes fields, prefill sweep (yesterday's crew, auto
weather), DiaryFinishFlow "done moment" ceremony, long-lot-ID readability
pass (§1).

Each PR: local gates (unit + readiness + type-check), CI green via merge
train, one domain per PR, behavior-preserving where the PR is a rebuild of
an existing interaction (characterize the trigger thresholds in tests).

---

## 6. Decisions Jay has already made / still open

- **Open**: Capacitor iOS wrap (recommended to keep ready, not build now).
- **Open**: PostHog instrumentation (offered earlier; would let us measure
  capture-flow duration and install acceptance directly).
- **Made**: no new npm packages without the AVG cert fix → hand-roll gesture
  components on framer-motion.
