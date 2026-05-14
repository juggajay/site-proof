# Foreman Mobile UX — Dev Handoff Document

> **Purpose:** Context for the next AI dev session continuing foreman mobile work.
> **Last updated:** 2026-01-27 (commit `cf7e3f9`)

---

## What Is This Project?

SiteProof is a construction project management app (React + Node.js + PostgreSQL). The **foreman mobile UX** is a specialised mobile-first interface for site foremen — people who manage construction sites from their phones, often wearing gloves, in bright sunlight, with intermittent connectivity.

The guiding principle: **"A foreman's phone is a tool, not an office."** Every tap removed is time back on the job.

---

## What Has Been Built So Far

### The 8-Phase Restructure Plan (Phases 1-7 Complete, Phase 8 Pending)

The full plan lives at `docs/plans/2026-01-24-foreman-mobile-ux-restructure.md`. All 7 implementation phases are done. Phase 8 (testing) is ready.

### Mobile Daily Diary Timeline (NEW — completed this session)

The full implementation plan lives at `docs/plans/2026-01-27-mobile-diary-timeline.md`. All 7 tasks are complete.

### Recent Commits (newest first)

```
cf7e3f9 feat: Add offline Dexie schemas, loading skeletons, empty states for mobile diary
8b27976 feat: Add docket summary card with collapsed/expanded states and manual fallback display
1eadf37 feat: Add bottom sheets, timeline entries, and wire mobile diary interactions
91dae44 feat: Add mobile diary timeline layout shell with lot selector, weather bar, quick-add chips
af76486 feat: Auto-populate diary personnel/plant on docket approval
c85df20 feat: Add delivery/event CRUD, timeline, docket-summary API endpoints
dbb96d6 feat: Add DiaryDelivery, DiaryEvent models and lotId/source/createdAt fields
cf14444 feat: Add mobile card-based docket approvals UI
f5c6e3e fix: Add company-level access fallback to foreman today endpoint
8aa28bf fix: Wire up foreman 5-tab mobile nav (Capture, Today, Approve, Diary, Lots)
412d536 refactor: Redesign project dashboard to eliminate sidebar duplication
4902492 feat: Add foreman mobile shell with 5-tab navigation
609e8c8 feat: Add mobile foreman UX improvements
```

### What `cf7e3f9` (Latest Session — 7 commits) Did

**Goal:** Build a mobile-optimised Daily Diary as a timeline feed instead of the desktop multi-tab form. Foremen capture events (activities, delays, deliveries, events) throughout the day via quick-add chips. Labour/plant auto-populates from approved subbie dockets. DiaryFinishFlow handles EOD review+submit.

**Backend changes:**

1. **New Prisma models** (`dbb96d6`):
   - `DiaryDelivery` — delivery records with supplier, docket number, quantity, unit, lot
   - `DiaryEvent` — site events (visitor, safety, instruction, variation, other) with lot
   - Added `lotId`, `source` (`'manual'` | `'docket'`), `docketId`, `createdAt` to `DiaryPersonnel` and `DiaryPlant`
   - Added `lotId`, `createdAt` to `DiaryDelay`
   - Added `createdAt` to `DiaryActivity`
   - Updated `DailyDiary`, `Lot`, `DailyDocket` relations
   - Used `prisma db push` (no migration file — migration needed before production deploy)

2. **New API endpoints** (`c85df20`):
   - `POST/DELETE /:diaryId/deliveries` — delivery CRUD
   - `POST/DELETE /:diaryId/events` — event CRUD
   - `GET /:diaryId/timeline` — merges all diary child records into a chronological feed sorted by `createdAt`, filters personnel/plant to `source === 'manual'` only
   - `GET /project/:projectId/docket-summary/:date` — aggregates approved/pending dockets with worker/plant breakdowns
   - Updated existing schemas (`addPersonnelSchema`, `addPlantSchema`, `addDelaySchema`) to accept `lotId`
   - Updated all diary fetch includes to return `deliveries` and `events`
   - Updated frontend TypeScript interfaces (`Delivery`, `DiaryEvent`, added `createdAt` to existing interfaces)

3. **Docket→Diary auto-population** (`af76486`):
   - On docket approval, writes `DiaryPersonnel` + `DiaryPlant` records with `source: 'docket'` and `docketId`
   - Auto-creates diary for the date if none exists
   - Skips if diary is already submitted
   - Wrapped in try/catch — approval succeeds even if diary population fails
   - Located in `backend/src/routes/dockets.ts` after the approval update

**Frontend changes:**

4. **Mobile layout shell** (`91dae44`):
   - `DiaryMobileView.tsx` — main mobile layout composing all sub-components, pull-to-refresh
   - `DiaryLotSelector.tsx` — sticky lot context picker, all new entries inherit selected lot
   - `DiaryWeatherBar.tsx` — compact weather strip (auto-filled), tap to edit
   - `DiaryQuickAddBar.tsx` — sticky chip bar above bottom nav (Activity, Delay, Delivery, Plant, Event, + More)
   - Wired into `DailyDiaryPage.tsx` with `useIsMobile()` conditional rendering
   - Added state: `activeLotId`, `timeline`, `docketSummary`, `docketSummaryLoading`, `activeSheet`
   - Added fetchers: `fetchTimeline()`, `fetchDocketSummary()`, `handleRefresh()`

5. **Bottom sheets + timeline entries** (`1eadf37`):
   - `sheets/BottomSheet.tsx` — reusable wrapper with slide-up animation, ESC close, backdrop dismiss
   - `sheets/AddActivitySheet.tsx` — description + suggestion chips + expandable lot/quantity/unit/notes
   - `sheets/AddDelaySheet.tsx` — delay type pills + description + expandable duration/impact/lot
   - `sheets/AddDeliverySheet.tsx` — description + supplier + docket number + expandable qty/unit/lot/notes
   - `sheets/AddEventSheet.tsx` — event type pills + description + notes + lot
   - `sheets/AddManualLabourPlantSheet.tsx` — dual-section (personnel + plant) with "Tip" banner
   - `DiaryTimelineEntry.tsx` — type-coded card with icon/colour, timestamp, lot badge, swipe-to-edit/delete
   - Parameterised API helpers: `addActivityFromSheet()`, `addDelayFromSheet()`, `addDeliveryFromSheet()`, `addEventFromSheet()`, `ensureDiaryExists()`
   - All sheets wired into `DailyDiaryPage.tsx` mobile return block

6. **Docket summary card** (`8b27976`):
   - `DiaryDocketSummary.tsx` — collapsible card with three states (loading, empty, dockets exist)
   - Collapsed: worker count + machine count + pending badge
   - Expanded: per-subcontractor breakdown, tappable pending dockets, totals, foreman-entered manual entries
   - Wired into `DiaryMobileView.tsx` with manual entries derived from timeline

7. **Offline + polish** (`cf7e3f9`):
   - Dexie v6: new `diaryDeliveries` and `diaryEvents` tables with `OfflineDiaryDelivery`/`OfflineDiaryEvent` interfaces
   - `clearAllOfflineData()` updated to clear all tables (including `lots` which was previously missing)
   - `SyncQueueItem.type` extended with `'delivery_save'` | `'event_save'`
   - Loading skeletons in `DiaryMobileView` (3x `MobileDataCardSkeleton`)
   - Contextual empty states: "Start your day" (today, no diary), "No diary for this date" (past), "No entries yet" (diary exists)

---

## Architecture & Patterns

### How Mobile Detection Works

```
useIsMobile() → returns true when viewport < 768px
```

Hook: `frontend/src/hooks/useMediaQuery.ts`

Pattern used in pages:
```tsx
const isMobile = useIsMobile()
return isMobile ? <MobileView {...props} /> : <DesktopView {...props} />
```

All business logic (API calls, state, modals) stays in the **page** component. The mobile view is a pure presentation component receiving data + callbacks as props.

### How Foreman Navigation Works

**Role detection:** `MobileNav.tsx` checks `userRole === 'foreman'`.
- Foreman → renders `ForemanBottomNavV2` (5-tab: Capture, Today, Approve, Diary, Lots)
- Other roles → standard bottom nav + slide-out menu

**Bottom nav tabs and their routes:**

| Tab | Route | Component | Mobile View |
|-----|-------|-----------|-------------|
| Capture | _(opens CaptureModal, no route)_ | `CaptureModal` | — |
| Today | `/projects/:id/foreman/today` | `TodayWorklist` | Native mobile |
| Approve | `/projects/:id/dockets?status=pending_approval` | `DocketApprovalsPage` | `DocketApprovalsMobileView` |
| Diary | `/projects/:id/diary` | `DailyDiaryPage` | `DiaryMobileView` (NEW) |
| Lots | `/projects/:id/lots` | `LotsPage` | _(still desktop layout)_ |

**Route structure in App.tsx:**
```
/projects/:projectId/foreman (ForemanMobileShell)
  ├── index → redirects to "today"
  └── today → <TodayWorklist />

/projects/:projectId/dockets → <DocketApprovalsPage />  (shared, mobile/desktop)
/projects/:projectId/lots → <LotsPage />                 (shared)
/projects/:projectId/diary → <DailyDiaryPage />           (shared, mobile/desktop)
```

### How the Mobile Diary Works

The diary mobile view is a **timeline feed** — not tabs. Foremen capture events throughout the day via quick-add chips at the bottom of the screen.

**Page layout (top to bottom):**
1. Date header + sticky lot selector
2. Weather bar (auto-filled, tap to edit)
3. Docket summary card (collapsible — labour/plant from approved subbie dockets)
4. Timeline feed (chronological entries: activities, delays, deliveries, events, manual labour/plant)
5. Quick-add chip bar (sticky, above bottom nav)
6. Bottom nav (Diary tab active)

**Data flow:**
- `DailyDiaryPage.tsx` owns all state and API calls
- `DiaryMobileView.tsx` is pure presentation, receives props
- Quick-add chips → open type-specific bottom sheets → `addXFromSheet()` → API call → refresh timeline
- `ensureDiaryExists()` auto-creates diary on first entry (lazy creation)
- `fetchTimeline()` calls `GET /api/diary/:id/timeline` for merged chronological feed
- `fetchDocketSummary()` calls `GET /api/diary/project/:id/docket-summary/:date` for subbie data
- Docket approval auto-populates diary personnel/plant via the hook in `dockets.ts`

**Bottom sheet pattern:**
- `BottomSheet.tsx` is the reusable wrapper (slide-up, ESC, backdrop dismiss)
- Each type-specific sheet: minimal required fields visible, optional fields behind "More details"
- All sheets use `useHaptics()` for success/error feedback
- All save buttons are 56px tall, green, with loading spinner

### Reusable Mobile Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `SwipeableCard` | `components/foreman/SwipeableCard.tsx` | Touch swipe wrapper with left/right actions, haptic feedback, configurable threshold |
| `MobileDataCard` | `components/ui/MobileDataCard.tsx` | Standard card: title + subtitle + status badge + 2-col field grid + actions |
| `MobileDataCardSkeleton` | `components/ui/MobileDataCard.tsx` | Loading skeleton matching card layout |
| `PullToRefreshIndicator` | `hooks/usePullToRefresh.tsx` | Animated pull indicator (arrow rotates, spinner on refresh) |
| `BottomSheet` | `components/foreman/sheets/BottomSheet.tsx` | Reusable bottom sheet wrapper (NEW) |
| `DiaryTimelineEntry` | `components/foreman/DiaryTimelineEntry.tsx` | Type-coded timeline card with swipe actions (NEW) |
| `DiaryDocketSummary` | `components/foreman/DiaryDocketSummary.tsx` | Collapsible docket summary card (NEW) |
| `DiaryLotSelector` | `components/foreman/DiaryLotSelector.tsx` | Sticky lot context picker (NEW) |
| `DiaryWeatherBar` | `components/foreman/DiaryWeatherBar.tsx` | Compact weather strip (NEW) |
| `DiaryQuickAddBar` | `components/foreman/DiaryQuickAddBar.tsx` | Quick-add chip bar (NEW) |

### Reusable Mobile Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useIsMobile()` | `hooks/useMediaQuery.ts` | Viewport < 768px |
| `useIsTablet()` | `hooks/useMediaQuery.ts` | 768px - 1023px |
| `useIsDesktop()` | `hooks/useMediaQuery.ts` | >= 1024px |
| `usePullToRefresh()` | `hooks/usePullToRefresh.tsx` | Pull-to-refresh gesture with resistance, returns `containerRef` + state |
| `useHaptics()` | `hooks/useHaptics.ts` | Vibration feedback: `trigger('light' | 'medium' | 'success' | 'error')` |
| `useOnlineStatus()` | `hooks/useOnlineStatus.ts` | `{ isOnline, pendingSyncCount }` |
| `useGeoLocation()` | `hooks/useGeoLocation.ts` | `{ latitude, longitude, error, loading }` |

### State Management

**Zustand store:** `frontend/src/stores/foremanMobileStore.ts`

Persists to localStorage:
- `activeTab` — current nav tab
- `pendingActions` — offline action queue
- `isCameraOpen`, `isOnline`, `pendingSyncCount`, `isVoiceActive`, `isQuickActionsOpen`
- GPS: `currentLocation`, `gpsError`

**Offline DB:** `frontend/src/lib/offlineDb.ts` (Dexie/IndexedDB, **version 6**)
- `OfflineDocket` — dockets created/submitted offline
- `OfflineDailyDiary` — diary entries saved offline
- `OfflineDiaryDelivery` — delivery records offline (NEW)
- `OfflineDiaryEvent` — event records offline (NEW)
- `SyncQueueItem` — batched sync queue (`itp_completion`, `photo_upload`, `diary_save`, `docket_create`, `delivery_save`, `event_save`, etc.)

---

## All Foreman Components (Complete Inventory)

**Directory:** `frontend/src/components/foreman/`

| File | Purpose |
|------|---------|
| `ForemanBottomNavV2.tsx` | 5-tab mobile nav (Capture/Today/Approve/Diary/Lots) with offline indicator, today badge |
| `ForemanBottomNav.tsx` | Legacy nav (superseded by V2, kept for reference) |
| `ForemanMobileShell.tsx` | Route wrapper with `<Outlet />` for `/foreman/*` routes |
| `ForemanMobileDashboard.tsx` | Mobile dashboard with today's overview widgets |
| `TodayWorklist.tsx` | Unified "today" view: blocking items (red), due today (amber), upcoming (blue) |
| `DocketApprovalsMobileView.tsx` | Swipeable docket approval cards with filter pills, pull-to-refresh |
| `DiaryMobileView.tsx` | Mobile diary timeline layout: lot selector, weather bar, docket summary, timeline feed, quick-add chips (NEW) |
| `DiaryTimelineEntry.tsx` | Timeline entry card with type icon/colour, timestamp, lot badge, swipe edit/delete (NEW) |
| `DiaryDocketSummary.tsx` | Collapsible docket summary: approved/pending breakdown, manual entries (NEW) |
| `DiaryLotSelector.tsx` | Sticky lot context picker dropdown (NEW) |
| `DiaryWeatherBar.tsx` | Compact weather strip with condition icons, tap to edit (NEW) |
| `DiaryQuickAddBar.tsx` | Quick-add chip bar: Activity, Delay, Delivery, Plant, Event, + More (NEW) |
| `CaptureModal.tsx` | Camera-first photo capture → optional categorisation (photo/NCR/note) |
| `PhotoCaptureModal.tsx` | Lower-level photo capture implementation |
| `DiaryFinishFlow.tsx` | End-of-day diary completion bottom sheet (<60 sec target) |
| `SwipeableCard.tsx` | Swipe gesture wrapper with haptics, configurable threshold, background action reveal |
| `DocketComparisonCard.tsx` | Docket comparison display with undo capability |
| `QuickCaptureButton.tsx` | FAB with 5 quick actions (deprecated — Capture tab replaces it) |
| `DashboardCard.tsx` | Reusable dashboard card + stat display |
| `WeatherWidget.tsx` | Weather display card |
| `index.ts` | Public export surface for all components |

**Directory:** `frontend/src/components/foreman/sheets/` (NEW)

| File | Purpose |
|------|---------|
| `BottomSheet.tsx` | Reusable wrapper: slide-up animation, ESC close, backdrop dismiss |
| `AddActivitySheet.tsx` | Activity: description + suggestions + expandable lot/quantity/unit/notes |
| `AddDelaySheet.tsx` | Delay: type pills + description + expandable duration/impact/lot |
| `AddDeliverySheet.tsx` | Delivery: description + supplier + docket# + expandable qty/unit/lot/notes |
| `AddEventSheet.tsx` | Event: type pills + description + notes + lot |
| `AddManualLabourPlantSheet.tsx` | Manual labour/plant entry (personnel + plant sections) |

---

## New Backend Models & Endpoints (This Session)

### New Prisma Models

| Model | Table | Key Fields |
|-------|-------|------------|
| `DiaryDelivery` | `diary_deliveries` | `diaryId`, `description`, `supplier?`, `docketNumber?`, `quantity?`, `unit?`, `lotId?`, `notes?` |
| `DiaryEvent` | `diary_events` | `diaryId`, `eventType` (visitor/safety/instruction/variation/other), `description`, `notes?`, `lotId?` |

### Modified Models

| Model | Fields Added |
|-------|-------------|
| `DiaryPersonnel` | `lotId`, `source` (manual/docket), `docketId`, `createdAt` |
| `DiaryPlant` | `lotId`, `source` (manual/docket), `docketId`, `createdAt` |
| `DiaryDelay` | `lotId`, `createdAt` |
| `DiaryActivity` | `createdAt` |

### New API Endpoints (all in `backend/src/routes/diary.ts`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/:diaryId/deliveries` | Add delivery entry |
| DELETE | `/:diaryId/deliveries/:deliveryId` | Remove delivery |
| POST | `/:diaryId/events` | Add event entry |
| DELETE | `/:diaryId/events/:eventId` | Remove event |
| GET | `/:diaryId/timeline` | Merged chronological feed of all diary entries |
| GET | `/project/:projectId/docket-summary/:date` | Aggregated approved/pending docket data |

### Docket→Diary Hook (in `backend/src/routes/dockets.ts`)

On docket approval, the hook:
1. Finds or creates a diary for the docket date
2. Writes `DiaryPersonnel` records from labour entries (`source: 'docket'`)
3. Writes `DiaryPlant` records from plant entries (`source: 'docket'`)
4. Skips if diary is already submitted
5. Fails silently (approval still succeeds)

---

## Pattern: Adding a New Mobile View to an Existing Page

Follow the pattern established in `DocketApprovalsPage.tsx` and `DailyDiaryPage.tsx`:

1. **Create** `frontend/src/components/foreman/[Feature]MobileView.tsx`
   - Pure presentation component
   - Receives all data + callbacks as props
   - Uses `SwipeableCard`, `MobileDataCard`, `usePullToRefresh` as needed
   - No API calls — parent page owns all data fetching

2. **Modify** the existing page component:
   - Import `useIsMobile` and the new mobile view
   - Add `const isMobile = useIsMobile()`
   - Wrap return in `{isMobile ? <MobileView /> : <DesktopView />}`
   - Modals/sheets render **outside** the conditional (they work for both views)

3. **Export** from `frontend/src/components/foreman/index.ts`

4. **URL params** — if the page has filters, sync them with `useSearchParams` so bottom nav links with query params work correctly

### Pattern: Adding a Bottom Sheet

Follow the pattern from `sheets/AddActivitySheet.tsx`:

1. Import `BottomSheet` from `./BottomSheet`
2. Accept `isOpen`, `onClose`, `onSave` callback, `defaultLotId`, `lots[]`
3. Local form state with `useState` hooks
4. "More details" expandable section for optional fields
5. Big green save button (56px, `min-h-[56px]`)
6. `useHaptics().trigger('success'|'error')` on save result
7. Reset form state on successful save

---

## What's Next — Suggested Work

### PRIORITY 1: Testing the Mobile Diary (not yet tested)

The mobile diary timeline has been implemented but **not tested on a real device or mobile viewport**. This is the highest priority:

- Manual testing on 375px viewport (iPhone SE) — all flows:
  - Load diary page on mobile → see timeline layout
  - Tap each quick-add chip → verify correct bottom sheet opens
  - Fill and save an activity → verify it appears in timeline
  - Fill and save a delay → verify delay type pill works
  - Fill and save a delivery → verify supplier/docket fields work
  - Fill and save an event → verify event type pill works
  - Tap "+ More" → verify manual labour/plant sheet opens
  - Pull to refresh → verify timeline reloads
  - Change lot selector → verify entries inherit lot
  - Check weather bar → verify it shows/hides correctly
  - Check docket summary → verify collapsed/expanded states
  - Swipe timeline entry left → verify delete action
  - Swipe timeline entry right → verify edit action
  - Test on submitted diary → verify read-only mode (no chips, no swipe)

### PRIORITY 2: Production Migration

The Prisma schema changes were applied with `prisma db push` (no migration file). Before deploying to production:

```bash
cd backend && npx prisma migrate dev --name add-diary-delivery-event-lot-source-createdat
```

This will generate the migration file that production deployments need.

### PRIORITY 3: Remaining Pages That Still Need Mobile Views

| Page | Route | Current State | Priority |
|------|-------|---------------|----------|
| **Lots** | `/projects/:id/lots` | Desktop table on mobile | High — foremen use this daily |
| **NCR** | `/projects/:id/ncr` | Desktop table, accessed via Capture → NCR type | Medium |
| **Hold Points** | `/projects/:id/hold-points` | Desktop table | Medium — linked from Today worklist |
| **ITP** | `/projects/:id/itp` | Desktop table | Lower — mostly viewed, not edited on mobile |

### PRIORITY 4: Mobile Polish Tasks

- Pull-to-refresh on the Today worklist (currently uses a manual refresh button)
- Swipe-to-navigate on lot detail cards
- Offline indicator on pages other than the bottom nav
- Voice input on bottom sheet text fields (VoiceInputButton exists but not wired into sheets yet)
- Mobile-optimised modals (some modals could become bottom sheets)
- Offline queue processing for diary entries (Dexie tables exist but sync logic not yet implemented)

---

## Unstaged Changes Warning

These files were modified **before** this session and are NOT committed:
- `backend/src/routes/auth.ts` — auth route changes
- `frontend/package.json` / `frontend/package-lock.json` — dependency changes

Review these before your next commit.

---

## Key Files Quick Reference

```
frontend/src/
├── components/
│   ├── foreman/           ← All foreman mobile components
│   │   ├── sheets/        ← Bottom sheet components (NEW)
│   │   │   ├── BottomSheet.tsx
│   │   │   ├── AddActivitySheet.tsx
│   │   │   ├── AddDelaySheet.tsx
│   │   │   ├── AddDeliverySheet.tsx
│   │   │   ├── AddEventSheet.tsx
│   │   │   └── AddManualLabourPlantSheet.tsx
│   │   ├── DiaryMobileView.tsx        ← Mobile diary timeline layout (NEW)
│   │   ├── DiaryTimelineEntry.tsx     ← Timeline entry card (NEW)
│   │   ├── DiaryDocketSummary.tsx     ← Collapsible docket summary (NEW)
│   │   ├── DiaryLotSelector.tsx       ← Lot picker (NEW)
│   │   ├── DiaryWeatherBar.tsx        ← Weather strip (NEW)
│   │   ├── DiaryQuickAddBar.tsx       ← Quick-add chips (NEW)
│   │   ├── index.ts                   ← Public exports (updated)
│   │   └── *.tsx                      ← Other foreman components
│   ├── layouts/
│   │   ├── Breadcrumbs.tsx    ← Hidden on mobile (hidden md:flex)
│   │   ├── MobileNav.tsx      ← Role-based nav switching
│   │   └── MainLayout.tsx     ← Overall app layout
│   └── ui/
│       └── MobileDataCard.tsx ← Reusable card + skeleton
├── hooks/
│   ├── useMediaQuery.ts       ← useIsMobile / useIsDesktop
│   ├── usePullToRefresh.tsx   ← Pull gesture + indicator
│   ├── useHaptics.ts          ← Vibration feedback
│   ├── useOnlineStatus.ts     ← Online/offline detection
│   └── useGeoLocation.ts      ← GPS access
├── stores/
│   └── foremanMobileStore.ts  ← Zustand state (tabs, offline queue, GPS)
├── lib/
│   ├── offlineDb.ts           ← Dexie IndexedDB v6 (updated with delivery/event tables)
│   └── foremanFeatures.ts     ← Feature flags for foreman role
├── pages/
│   ├── diary/
│   │   └── DailyDiaryPage.tsx ← Diary page with mobile/desktop split (updated)
│   └── dockets/
│       └── DocketApprovalsPage.tsx ← Docket approvals with mobile/desktop split
└── App.tsx                    ← Route definitions

backend/
├── prisma/
│   └── schema.prisma          ← DiaryDelivery, DiaryEvent models + field additions
├── src/routes/
│   ├── diary.ts               ← 6 new endpoints + updated includes
│   └── dockets.ts             ← Docket→diary auto-population hook

docs/plans/
├── 2026-01-24-foreman-mobile-ux-restructure.md  ← Master plan (phases 1-8)
├── 2026-01-27-mobile-diary-timeline.md           ← Diary timeline plan (7 tasks, all complete)
├── foreman-mobile-handoff.md                     ← This document
```

---

## Design Principles (From Persona Research)

Reference doc: `docs/Foreman persona document (AU civil).md`

1. **Touch targets >= 44px** — gloves, callused hands, moving vehicles
2. **High contrast** — direct sunlight readability
3. **Minimal text input** — voice-to-text, photo capture, tap selections
4. **Offline-first** — construction sites have poor connectivity
5. **GPS auto-capture** — evidence of site presence
6. **< 3 taps** to any primary action
7. **Swipe gestures** as shortcuts, never the only path — always provide a tap alternative
8. **Haptic feedback** on threshold crossings and confirmations
