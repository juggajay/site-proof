# Offline Sync Centre — Execution Spec (Rev 1)

**Date:** 28 July 2026
**Surveyed tree:** `f6f1ae35e34e7a57822b7b526345c8cb732fd7fb` (#1617) — every file:line in §1 was read at this SHA.
**Status:** spec only. No product code in this PR.
**Authority:** Jay approved an offline sync centre on 2026-07-27 — _"3 photos pending, last synced 10:42, 1 failed — retry"_. That approval is an **explicit shell-touch grant for this surface only**; the shell freeze holds everywhere else.
**Sequencing:** follows the D14 arc (completed 2026-07-28). Discharges **A5-v** from `docs/plans/a5a6-gap-survey-2026-07-25.md:41` ("Sync-state unification — blocked on Jay's shell go-ahead").

---

## 0. The one-paragraph version

Almost all of this already exists. There is one offline queue (Dexie `syncQueue`), one hook that drives it (`useOfflineStatus`), and one chip already sitting in the shell header (`SyncChip`). Two things are genuinely missing: **pending counts broken down by kind**, and **a last-successful-sync timestamp**. v1 adds exactly those two data fields, and makes the chip that is already in the header open a sheet that shows them. No new engine, no new persistence layer, no new chrome element, no geometry change.

---

## 1. Current-truth inventory (surveyed at `f6f1ae3`)

### 1.1 The queue — one Dexie DB, one table, eleven item types

- Database `SiteProofOfflineDB`, Dexie `^3.2.4` — `frontend/src/lib/offline/core.ts:320`, singleton exported `core.ts:381`. Dexie dep at `frontend/package.json:45`.
- Schema v6 object stores — `core.ts:367-377`. The queue table is `syncQueue: '++id, type, action, createdAt'` (`core.ts:370`).
- Queue row shape `SyncQueueBase` — `core.ts:84-92`: `{ id?, type, action, data, createdAt, attempts, lastError? }`. **No per-item timestamp of last attempt, and no success timestamp anywhere.**
- The eleven queue types — `core.ts:120-131`:
  `itp_completion`, `photo_upload`, `ncr_create`, `diary_save`, `diary_submit`, `docket_create`, `docket_submit`, `lot_edit`, `lot_conflict`, `delivery_save`, `event_save`.
- Dispatch to per-type executors — `frontend/src/lib/offline/syncWorker.ts:941-995`.
- Dead-letter threshold `MAX_SYNC_ATTEMPTS = 5` — `frontend/src/lib/offline/syncQueue.ts:12`. Items are **kept, never deleted**, on exhaustion (`syncQueue.ts:7-11`, `useOfflineStatus.ts:94-100`). Permanent-fail on 4xx — `syncWorker.ts:804-806`.

### 1.2 The count helpers — three full table scans, five seconds apart

Every one of these calls `offlineDb.syncQueue.toArray()` and then filters in JS:

| Helper                      | File:line                               | Reads                                   |
| --------------------------- | --------------------------------------- | --------------------------------------- |
| `getPendingSyncCount()`     | `syncQueue.ts:22-24`                    | `.count()`                              |
| `getLiveSyncCount()`        | `syncQueue.ts:28-31`                    | full `toArray()`                        |
| `getFailedSyncCount()`      | `syncQueue.ts:35-38`                    | full `toArray()`                        |
| `getOldestPendingItemAge()` | `syncQueue.ts:83-91`                    | full `toArray()`                        |
| `resetFailedSyncItems()`    | `syncQueue.ts:42-54`                    | full `toArray()`                        |
| `getConflictedLotsCount()`  | `frontend/src/lib/offlineDb.ts:519-521` | `lots` where `syncStatus == 'conflict'` |
| `getUnsyncedWorkCount()`    | `offlineDb.ts:527-530`                  | queued + conflicts                      |

`useOfflineStatus` fires four of these in parallel on a 5 s interval — `frontend/src/lib/useOfflineStatus.ts:62-80` (interval at `:77`), and again after each sync pass at `:114-119`. **Three of those four are separate full scans of the same table.** This matters: the kind breakdown v1 needs is free if those three collapse into one scan.

### 1.3 The hook — one driver, one owner

`useOfflineStatus` — `frontend/src/lib/useOfflineStatus.ts:32`.

Returns (`:214-223`): `isOnline`, `pendingSyncCount`, `failedSyncCount`, `isSyncing`, `syncPendingChanges`, `retryFailedSyncs`, `conflictCount`, `oldestPendingItemAge`.

Drive points:

- 5 s count poll — `:77`
- 1 s debounce flush on regaining connectivity — `:157-165`
- flush on mount — `:169-175`
- flush on `visibilitychange` — `:180-194` (comment `:178-179`: _"iOS never delivers a Background Sync event; visibilitychange is the only reliable foreground signal"_)
- 60 s foreground interval while pending — `:200-212`, constant `FOREGROUND_FLUSH_INTERVAL_MS` at `:18`
- manual dead-letter revive — `retryFailedSyncs` at `:141-152`
- `STUCK_SYNC_THRESHOLD_MS = 2h` — `:16`

`enableSyncWorker` defaults **false** (`:33`) and gates every flush effect (`:84`, `:158`, `:170`, `:181`, `:201`).

**Exactly one call site enables the worker:** `frontend/src/components/OfflineIndicator.tsx:53-57`. Every other call site is read-only:

`SyncChip.tsx:56-57`, `PhotosListScreen.tsx:142`, `PhotoDetailScreen.tsx:40`, `IssueDetailScreen.tsx:75`, `DocketDetailScreen.tsx:48`, `AdjustHoursScreen.tsx:45`, `RejectFormScreen.tsx:33`, `QueryFormScreen.tsx:33` (all under `frontend/src/shell/screens/`), `QuickPhotoCapture.tsx:30,415`, `LotEditPage.tsx:43`, `LotDetailPage.tsx:69`, `useDocketEditorController.ts:97`, `OfflineIndicator.tsx:168`.

> **Load-bearing fact for §5 Phase 3:** the sync worker for the mobile shells is owned by an _office-shaped_ component (`OfflineIndicator`) mounted at app root — `frontend/src/App.tsx:717` via `DeferredOfflineIndicator`. It is lazy-loaded on idle callback / 1.5 s timeout / going offline — `frontend/src/components/DeferredOfflineIndicator.tsx:40-53`, render at `:67`. **Unmounting it inside the shells would stop all sync on `/m` and `/p`.**

### 1.4 The four existing sync surfaces (three enums)

Confirms `a5a6-gap-survey-2026-07-25.md:16`, re-verified at this SHA:

1. **`SyncChip`** — `frontend/src/shell/components/SyncChip.tsx:55-104`. Five states via `deriveSyncState` — `frontend/src/shell/components/syncChipState.ts:7-22` (`saved|waiting|syncing|failed|offline`). Labels `SyncChip.tsx:18-31`, aria `:33-46`, tone `:48-53`. Only the `failed` state is a button (`:84-96`); everything else is `role="status"` (`:99`). Tests: `frontend/src/shell/test/SyncChip.test.tsx`.
2. **`OfflineIndicator`** floating pills — `frontend/src/components/OfflineIndicator.tsx:70-164`. Different enum (conflict `:79-90`, failed `:94-108`, offline `:111-120`, stuck `:121-127`, pending `:128-148`). Positioned with `above-quick-add-bar` (`:77`), a class keyed to **office** CSS vars `--bottom-nav-height` / `--quick-add-bar-height` (`frontend/src/index.css:242-260`) — the shells never publish those vars, so on `/m` and `/p` this pill floats over the `.shell-cambar` action bar (`index.css:506-513`).
3. **`OfflineBadge`** — `OfflineIndicator.tsx:167-193`. **Zero JSX mounts anywhere. Dead export.**
4. **`SyncStatusBadge`** — `OfflineIndicator.tsx:195-233`, third enum (`synced|pending|error|conflict`). Mounted at `frontend/src/pages/lots/components/LotEditPageChrome.tsx:47` (office) and `frontend/src/components/QuickPhotoCapture.tsx:302` (component has no external importers — effectively dead).

Also: `SyncConflictModal` — mounted only at `OfflineIndicator.tsx:152-162`. `UnsyncedSignOutDialog` via `useUnsyncedSignOut` — `frontend/src/components/layouts/UserMenu.tsx:56`, rendered `:264` — **office desktop only, no shell equivalent**.

### 1.5 The shells and their chrome

| Shell                | Prefix          | Mounted                                          | Route tree                                               |
| -------------------- | --------------- | ------------------------------------------------ | -------------------------------------------------------- |
| Foreman mobile shell | `/m/*`          | `frontend/src/App.tsx:252-261` (lazy `:117-119`) | `frontend/src/shell/ShellRoutes.tsx:34-66`               |
| Subbie portal shell  | `/p/*`          | `frontend/src/App.tsx:267-276` (lazy `:122-124`) | `frontend/src/shell/subbie/SubbieShellRoutes.tsx:69-106` |
| Office desktop       | everything else | `frontend/src/App.tsx:278-280` onward            | —                                                        |

Both shells mount **outside** `ProtectedAppShell` (`App.tsx:248-251`, `:263-266`).

**Both shells share one chrome file:** `frontend/src/shell/components/ShellScreen.tsx`.

- `HomeHeader` — `:128-203`; header element `:175`; greeting row `:188-192`; `<SyncChip />` at **`:191`**; `headerExtra` slot `:200`.
- `InnerHeader` — `:207-253`; header element `:221`; row `:222`; back button `:225-238`; `<SyncChip />` at **`:241`**; `headerExtra` slot `:250`.
- Composition root `:257-283`; `<main>` `:276` (`pb-[128px]`); `bottom` slot `:280`.

Geometry: no fixed header height (content-driven, `sticky top-0 … px-5 pb-[14px] pt-3` at `:175` and `:221`). Header row is `min-h-[40px]` (`:188`, `:222`) — the **single** whitelisted sub-48px box in `frontend/src/shell/test/touchTargets.test.ts:12`. Controls inside are 40px visual / 48px hit via `.shell-tap48` (`frontend/src/index.css:295-308`), enforced repo-wide by `touchTargets.test.ts:31-41`. **No bottom tab bar in either shell** — the only bottom chrome is the per-screen `.shell-cambar` (`index.css:506-516`).

Activation: `frontend/src/shell/shellFlag.ts:110-118` (foreman), `:132-140` (subbie), `:156-167` (dispatcher returning `'/m' | '/p' | null`).

### 1.6 Card rules — the uniform card already exists

`frontend/src/shell/components/HubTile.tsx:17-55` — anatomy is exactly icon (`:34-36`) + title (`:38`) + optional chip (`:40-47`) + chevron (`:48-52`), **no subtitle**, with the rule stated in its doc comment `:5-9`. Styling `.shell-hub` `index.css:471-486` (min-height 76px), icon box `.shell-hub-ico` `index.css:493-503` (44px).

Escape hatch: `.shell-card` (`index.css:569-581`) is a bare tile with **no enforced anatomy** — hand-rolled list rows use it (e.g. `shell/screens/issues/IssuesListScreen.tsx:56`, `shell/screens/dockets/DocketsListScreen.tsx:48`). There is no shared list-row component.

### 1.7 Sheet primitives — already present, already used in the shells

- `BottomSheet` — `frontend/src/components/foreman/sheets/BottomSheet.tsx`; carries `role="dialog" aria-modal` itself (`:20`), sticky header + X (`:18`), drag-to-close, `prefers-reduced-motion` respected (`:19`).
- Already used inside the shells: `frontend/src/shell/subbie/screens/CompanyScreen.tsx:540,617`; `frontend/src/shell/subbie/screens/dockets/DocketEntrySheets.tsx:76`.
- `ResponsiveSheet` (mobile sheet / desktop modal adapter) — `frontend/src/components/ui/ResponsiveSheet.tsx:44-52`; note `:56-60` — BottomSheet must be the only dialog node (Playwright strict mode).

### 1.8 Service worker, tiles, TanStack Query — the parts v1 must NOT touch

- **Service worker exists** (`vite-plugin-pwa ^1.3.0`, `frontend/package.json:94`), generated by `VitePWA({...})` — `frontend/vite.config.ts:200-274`, `registerType: 'prompt'` (`:201`), `importScripts: ['sw-push.js']` (`:268`), `runtimeCaching: mapRuntimeCaching` (`:272`). `frontend/public/sw-push.js` is **push only** — `push` listener `:75`, `notificationclick` `:95`, `pushsubscriptionchange` `:122`; **no `fetch` and no `sync` handler**.
- **No Background Sync API anywhere** — zero matches for `registration.sync` / `SyncManager` / `BackgroundSync` / `periodicSync` across `frontend/src`, `frontend/public`, `frontend/e2e`. This is deliberate (`useOfflineStatus.ts:178-179`).
- **Map tiles are a disjoint subsystem.** No tile store module exists; caching is declarative Workbox config — `frontend/src/lib/pwaRuntimeCaching.ts`, cache names `:35-37` (`civos-map-tiles`, `civos-plan-sheet-images`, `civos-map-data`), tiles CacheFirst `:44-59`, plan sheets `:60-72`, map data NetworkFirst `:73-86`. **Storage is the Cache API, not IndexedDB.** Bulk prefetch is prohibited by the MapTiler licence — `:6-10`. No hook, store, or component reads tile counts; the only consumers are sign-out purge (`frontend/src/lib/auth.tsx:27,134`) and stale-asset recovery (`frontend/src/lib/staleAssetRecovery.ts:62-63`).
- `getStorageEstimate()` — `frontend/src/lib/offline/storagePersistence.ts:53` — exists with **zero callers**. (`requestPersistentStorage()` is called once, `frontend/src/App.tsx:193`.)
- **TanStack Query v4.36.1** (`frontend/package.json:41`). Single QueryClient — `frontend/src/main.tsx:19-27`: `staleTime: 5min` (`:22`), `retry: 1` (`:23`), `refetchOnWindowFocus: false` (`:24`). **`networkMode` is never set** (v4 default `'online'` — queries and mutations pause offline). **No persister** — no `@tanstack/react-query-persist-client` in `package.json`, zero matches for `persistQueryClient`. Query cache is memory-only.
- **No second queue.** No matches in `frontend/src` (outside tests and `lib/offline/`) for `pendingUpload`, `uploadQueue`, `retryUpload`, `maxRetries`, or `backoff`. Photo capture writes straight to Dexie — `frontend/src/components/QuickPhotoCapture.tsx:4,196,424`. Document upload has no offline path at all — `frontend/src/pages/documents/useDocumentUpload.ts:165`.
- **No last-sync timestamp exists.** Zero matches for `lastSync` / `lastSynced` / `last_synced` anywhere in `frontend/src`.
- **No relative-time helper and no `date-fns`/`dayjs`.** `frontend/src/lib/localDate.ts` is date-key/timezone work (`:25,33,55,64,85`); `frontend/src/lib/dateFormat.tsx` is a user date-format preference context (`:4,23,61`).
- **localStorage helper exists** — `readLocalStorageItem` / `writeLocalStorageItem` / `removeLocalStorageItem`, `frontend/src/lib/storagePreferences.ts:50,54,58`, all failure-tolerant (`:14-18`, `:29-40`).

### 1.8.1 Gap summary — what v1 actually has to build

| Jay's sketch                     | Exists?        | Evidence                                                         |
| -------------------------------- | -------------- | ---------------------------------------------------------------- |
| "1 failed — retry"               | **Yes, fully** | `SyncChip.tsx:84-96` + `useOfflineStatus.ts:141-152`             |
| pending count (total)            | **Yes**        | `useOfflineStatus.ts:35,70`                                      |
| offline / syncing / saved states | **Yes**        | `syncChipState.ts:9-21`                                          |
| **"3 photos" — by kind**         | **No**         | queue `type` exists (`core.ts:120-131`) but nothing groups by it |
| **"last synced 10:42"**          | **No**         | zero matches for `lastSync*` in `frontend/src`                   |
| one panel showing all of it      | **No**         | four surfaces, three enums (§1.4)                                |

Two new data fields and one sheet. That is the whole build.

---

## 2. Scope

### 2.1 In scope (v1)

1. A pure kind-mapping module + one queue-summary read that returns live/failed/oldest/by-kind in **one** table scan.
2. A `lastSyncedAt` timestamp persisted in localStorage, written on successful flush.
3. Two new fields on `useOfflineStatus`'s return value.
4. One sheet — the **Sync Centre** — opened by the `SyncChip` already in the shell header.
5. Shells `/m/*` and `/p/*` only.

### 2.2 Explicitly OUT of scope — v1 must not do any of this

This list is normative. A PR that does any of the following is out of spec and should be sent back regardless of how good it looks.

| Forbidden                                                                          | Why                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New persistence layer or Dexie version bump**                                    | A single scalar (`lastSyncedAt`) does not justify a v7 migration on every field device. localStorage via the existing helper (`storagePreferences.ts:54`).                                                      |
| **Background Sync / service-worker sync**                                          | `sw-push.js` has no `sync` handler by design; iOS never delivers the event (`useOfflineStatus.ts:178-179`). Adding it would create a second sync engine.                                                        |
| **Map-tile / Cache API state in the panel**                                        | Disjoint subsystem (§1.8). Wiring `caches.open('civos-map-tiles').keys()` into a mutation-queue panel merges two unrelated stories and needs new plumbing on the tile side. Separate spec if Jay ever wants it. |
| **Conflict-resolution changes**                                                    | `SyncConflictModal` (`OfflineIndicator.tsx:152-162`) and the three resolve strategies (`offlineDb.ts:430,450,471`) stay byte-identical.                                                                         |
| **Per-item queue browser, delete-item, or edit-queued-item UI**                    | Counts by kind answer "is my work safe". Item-level surgery is a support tool, not a field tool.                                                                                                                |
| **TanStack Query `networkMode` change or a persister**                             | Behaviour change across every query in the app, unrelated to this surface.                                                                                                                                      |
| **Rewriting `OfflineIndicator`'s enum, `SyncStatusBadge`, or the office surfaces** | A5-v's full unification is bigger than Jay's grant. v1 unifies the _shell_; office stays as-is.                                                                                                                 |
| **A new header element, new chrome node, or any change to header geometry**        | The grant is for a panel, not a redesign. The chip already occupies the slot. `touchTargets.test.ts` must stay green with its whitelist unchanged.                                                              |
| **Unmounting `OfflineIndicator` on shell routes**                                  | It owns the only `enableSyncWorker: true` (`OfflineIndicator.tsx:53-57`). Unmounting it stops all sync on `/m` and `/p`.                                                                                        |
| **New dependency of any kind**                                                     | Sheet primitive, localStorage helper, and time formatting are all already available or one line.                                                                                                                |

---

## 3. Office vs field — which shells get it

**v1 ships to `/m/*` and `/p/*`. Office desktop gets nothing.**

Reasoning:

1. **Field is where the queue is non-empty.** Every offline write path — `capturePhotoOffline` (`QuickPhotoCapture.tsx:196,424`), offline diaries (`lib/offline/diaries.ts`), offline dockets (`lib/offline/dockets.ts`), offline ITP completions (`lib/offline/itp.ts`), offline NCR capture (`core.ts:112-118`) — is a field action. An office user on wifi sees `pendingSyncCount === 0` permanently, and `OfflineIndicator` correctly renders `null` in that case (`OfflineIndicator.tsx:66-68`).
2. **Office already has the two things it needs.** The floating pill (correctly positioned there, `index.css:242-260`) and the sign-out data-loss guard (`UserMenu.tsx:56,264`). The shells have neither working properly — the pill mispositions (§1.4) and there is no shell sign-out guard at all.
3. **Both shells, not one.** `/m` and `/p` render the same `ShellScreen.tsx` — the chip lives at `:191` and `:241` for both. Giving the panel to the foreman shell but not the subbie shell would require _adding_ a conditional; shipping to both is the smaller diff and the honest one (subbie foremen fill dockets in the same dead spots).

Office adoption, if ever wanted, is a later one-line reuse of the same `<SyncPanel>` from `UserMenu` — but it is not v1 and should not be pre-built for.

---

## 4. Data contract

### 4.1 Kinds

New module `frontend/src/lib/offline/syncKinds.ts` — pure, no I/O, no React.

```
export type SyncKind = 'photos' | 'diary' | 'dockets' | 'itp' | 'defects' | 'lots';
```

Mapping from the eleven queue types (`core.ts:120-131`):

| Queue `type`                                                | `SyncKind` | Panel label (singular / plural)  |
| ----------------------------------------------------------- | ---------- | -------------------------------- |
| `photo_upload`                                              | `photos`   | photo / photos                   |
| `diary_save`, `diary_submit`, `delivery_save`, `event_save` | `diary`    | diary entry / diary entries      |
| `docket_create`, `docket_submit`                            | `dockets`  | docket / dockets                 |
| `itp_completion`                                            | `itp`      | checklist item / checklist items |
| `ncr_create`                                                | `defects`  | defect / defects                 |
| `lot_edit`, `lot_conflict`                                  | `lots`     | lot change / lot changes         |

Kind order in the panel is the table order above — fixed, not sorted by count, so the panel does not reshuffle under the user's thumb while syncing.

Unknown types map to `undefined` and are **excluded from the breakdown but included in the totals**, matching the worker, which GCs unrecognised types (`syncWorker.ts:988-992`). A kind row must never claim more than the total.

### 4.2 One summary read replaces three scans

New function in `frontend/src/lib/offline/syncQueue.ts`:

```
export interface SyncQueueSummary {
  live: number;                              // attempts < MAX_SYNC_ATTEMPTS
  failed: number;                            // attempts >= MAX_SYNC_ATTEMPTS (dead-lettered)
  oldestPendingAgeMs: number | null;         // null when the queue is empty
  byKind: Record<SyncKind, number>;          // live + failed, every key present, zeros included
}

export async function summariseSyncQueue(): Promise<SyncQueueSummary>;
```

One `offlineDb.syncQueue.toArray()`, one pass. A pure `summariseSyncQueueItems(items, now)` does the folding and is the unit-test surface; the async wrapper is the untestable one-liner around it.

`useOfflineStatus.ts:62-80` and `:114-119` replace their `getLiveSyncCount` + `getFailedSyncCount` + `getOldestPendingItemAge` triples with a single `summariseSyncQueue()` (still parallel with `getConflictedLotsCount()`).

**This is net deletion:** three full IndexedDB table scans every 5 seconds become one, and the app gains the kind breakdown as a by-product. The three existing helpers stay exported — `getPendingSyncCount` is still used by `getUnsyncedWorkCount` (`offlineDb.ts:527-530`) — but `getLiveSyncCount` / `getFailedSyncCount` / `getOldestPendingItemAge` lose their `useOfflineStatus` callers. **Grep before deleting them**; delete any that end up with zero non-test callers, and run `npm run fallow:audit` to confirm no new dead exports.

### 4.3 `lastSyncedAt`

- Storage: `localStorage`, key `civos.sync.lastSyncedAt`, value an ISO-8601 string.
- Read/write via `readLocalStorageItem` / `writeLocalStorageItem` (`frontend/src/lib/storagePreferences.ts:50,54`) — already failure-tolerant for privacy-restricted browser contexts (`:14-18`, `:29-40`).
- **Written exactly once, in one place:** inside `syncPendingChanges`, after the exclusive run, when `syncedCount > 0` — i.e. at `useOfflineStatus.ts:128` alongside the existing `onSyncComplete` call. Not on a zero-item pass (a no-op poll is not a sync), and not on a pass that only dead-lettered items.
- Cleared on sign-out, wherever `clearAllOfflineData()` is invoked (`syncQueue.ts:93-103`) — a stale "last synced" from the previous user is a lie.
- **Never synthesised.** If the key is absent, the panel says "Not synced on this device yet". It does not fall back to "now", to the session start, or to the oldest queue item.

### 4.4 Hook surface

`useOfflineStatus` (`useOfflineStatus.ts:214-223`) gains exactly two fields:

```
pendingByKind: Record<SyncKind, number>   // from summary.byKind
lastSyncedAt: string | null               // ISO or null
```

All eight existing fields keep their current names and semantics. **No consumer changes required** — the thirteen read-only call sites in §1.3 keep compiling untouched. There is no new hook, no new store, no context, no zustand slice. `useOfflineStatus` **is** the unification layer; it already is, and every one of the four surfaces in §1.4 already reads it (`a5a6-gap-survey-2026-07-25.md:16`).

### 4.5 Time formatting

"Last synced 10:42" is `new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })` — one line, native, no dependency (there is no `date-fns` or `dayjs` in `frontend/package.json`, §1.8).

Rule: **same calendar day → time only** ("10:42"). **Earlier day → date + time** ("Sat 26 Jul, 16:08"). A bare "10:42" for a sync that happened two days ago is the exact kind of lie that costs trust on a QA-evidence product. The same-day check goes in a tiny pure `formatLastSynced(iso, now)` in `syncKinds.ts` so it is testable without clock mocking.

---

## 5. Phase slicing

Three phases. **Each is independently shippable and independently revertable.** Phase 1 changes no pixels. Phase 3 is optional and can be dropped without touching Phases 1–2.

### Phase 1 — data (no UI change)

**Files:**

- `frontend/src/lib/offline/syncKinds.ts` (new) — `SyncKind`, type→kind map, `summariseSyncQueueItems(items, now)`, `formatLastSynced(iso, now)`. All pure.
- `frontend/src/lib/offline/syncKinds.test.ts` (new).
- `frontend/src/lib/offline/syncQueue.ts` — add `summariseSyncQueue()` (~8 lines around the pure fold).
- `frontend/src/lib/useOfflineStatus.ts` — swap three helper calls for one summary call at `:62-80` and `:114-119`; add two state fields; write `lastSyncedAt` at `:128`; extend the return at `:214-223`.
- `frontend/src/lib/offlineDb.ts` — re-export `summariseSyncQueue`, `SyncKind`, `formatLastSynced` through the existing facade (the facade pattern is stated at `syncQueue.ts:1-3`).

**User-visible change:** none. **Shell touch:** none.
**Ships alone.** Prove it with unit tests plus one manual check that the chip still shows the same states.

### Phase 2 — the Sync Centre sheet (the shell touch)

**Files:**

- `frontend/src/shell/components/SyncPanel.tsx` (new, target < 120 lines).
- `frontend/src/shell/components/SyncChip.tsx` — the chip becomes a button in **all** states, opening the panel; the existing `failed`-only button branch (`:84-96`) collapses into the single button. Labels/aria/tone (`:18-53`) are unchanged.
- `frontend/src/shell/test/SyncChip.test.tsx` — extend.
- `frontend/src/shell/test/SyncPanel.test.tsx` (new).

**Zero changes to `ShellScreen.tsx`.** The chip is already at `:191` and `:241`; it already carries `.shell-tap48` in its button branch (`SyncChip.tsx:90`) and now always will. No new node in the header, no new row, no geometry change, `touchTargets.test.ts:12` whitelist untouched.

**Ships alone** on top of Phase 1.

### Phase 3 — remove the duplicate on shell routes (optional, last)

The floating `OfflineIndicator` pill duplicates the panel on `/m` and `/p` and is mispositioned there (§1.4). Suppress **only its pills**, not the component.

**Implementation:** `OfflineIndicator` takes an optional `showPills?: boolean` (default `true`); `DeferredOfflineIndicator` computes it from `location.pathname` against the shell prefixes in `shellFlag.ts`. When false, `OfflineIndicator` returns only the `<SyncConflictModal>` fragment (`OfflineIndicator.tsx:152-162`) and no pill container.

> **Footgun, stated once more:** the component must stay mounted. It holds the only `enableSyncWorker: true` (`OfflineIndicator.tsx:53-57`) and is the only thing flushing the queue on `/m` and `/p`. Hide the pills; never unmount.

**Acceptance for this phase specifically:** a test asserting that with `showPills={false}` the sync worker still runs (`enableSyncWorker` still true) and the conflict modal still mounts.

**Ships alone. Droppable** — if it looks at all risky in review, ship Phases 1–2 and stop; the duplicate is cosmetic.

---

## 6. UI spec — the Sync Centre panel

### 6.1 Entry point

The `SyncChip` already in the shell header (`ShellScreen.tsx:191` home, `:241` inner). Unchanged visually: dot + label, five states, existing tone classes (`SyncChip.tsx:48-53`). The only change is that it is now a `<button>` in every state rather than only in `failed` (`:84-96`).

The comment at `SyncChip.tsx:80-83` currently justifies the status-only behaviour ("no false button affordance"). **Replace it** — the affordance is now true in every state, because there is always something behind it. Do not leave a comment that contradicts the code.

### 6.2 Container

`BottomSheet` (`frontend/src/components/foreman/sheets/BottomSheet.tsx`), title **"Sync"**. Not `ResponsiveSheet` — the shells are mobile-only, so the desktop-modal branch (`ResponsiveSheet.tsx:56`) is dead weight here. `BottomSheet` already carries `role="dialog" aria-modal` and must be the only dialog node (`ResponsiveSheet.tsx:56-60`); do not wrap it.

### 6.3 Contents, top to bottom

**A. Status line** — one line, the state name at full contrast, mirroring `syncChipLabel` (`SyncChip.tsx:18-31`) so panel and chip can never disagree.

**B. Last synced** — muted, one line:

- `lastSyncedAt` present, today → `Last synced 10:42`
- `lastSyncedAt` present, earlier → `Last synced Sat 26 Jul, 16:08`
- `lastSyncedAt` null → `Not synced on this device yet`

**C. Kind rows** — one per kind with a non-zero count, in the fixed §4.1 order. Rendered only when the total is non-zero.

Per Jay's hard card rules: **uniform, no subtitles**. Anatomy per row, matching `HubTile.tsx:34-52`:

| Slot    | Content                                                                  |
| ------- | ------------------------------------------------------------------------ |
| Icon    | 44px `.shell-hub-ico` box (`index.css:493-503`), lucide icon per kind    |
| Label   | `3 photos` — count and noun, one line, no second line                    |
| Chip    | `Waiting` or `Failed` — `.shell-chip`, the same vocabulary the chip uses |
| Chevron | **None** — see §6.4                                                      |

Use the `.shell-hub` visual (`index.css:471-486`), not a new class. If the row anatomy can be expressed by passing props to `HubTile` without adding a prop to it, do that. If it needs a new prop on `HubTile`, write a local row instead — `HubTile` is the shared uniform card for the whole shell and must not grow variants for one panel.

A kind with a mix of live and dead-lettered items renders **two rows** (`3 photos / Waiting` and `1 photo / Failed`), not one merged row with an ambiguous chip. Counts must add up to the totals in the status line.

**D. Actions** — at most one button, full-width, in the sheet footer:

- `failedSyncCount > 0` → **"Retry failed"** → `retryFailedSyncs()` (`useOfflineStatus.ts:141`)
- else `pendingSyncCount > 0 && isOnline && !isSyncing` → **"Sync now"** → `syncPendingChanges()` (`:83`)
- else → no button. An "all saved" panel with a dead button is worse than no button.

Both actions are disabled while `isSyncing`, matching the existing pills (`OfflineIndicator.tsx:97,131`).

**E. Offline footnote** — when `!isOnline`, one muted line: _"You're offline. Everything here is saved on this phone and will upload when you're back on signal."_ This is the reassurance the panel exists for.

**F. Stuck warning** — when `isStuck` (the existing predicate, `OfflineIndicator.tsx:59-63`, threshold `useOfflineStatus.ts:16`), one warning line reusing the existing copy from `OfflineIndicator.tsx:125` verbatim. Same words in both places or neither.

### 6.4 Why no chevron

Jay's card rule is icon + label + chip + chevron. A chevron promises navigation. **There is no destination** — no screen filters to "pending photos" (`PhotosListScreen.tsx` lists all photos, not queued ones), and no route exists for any other kind's queue. A chevron that opens nothing is a broken promise on the one surface whose entire job is trustworthiness.

The rows are therefore non-interactive status rows using the uniform card _visual_ minus the chevron. **This is a deliberate, single-surface exception and it is Open Decision D3 for Jay** (§9). If Jay wants the chevron, the honest version is a destination per kind, which is a bigger build and not v1.

### 6.5 Accessibility

- Chip: `<button>` with the existing `aria-label` per state (`SyncChip.tsx:33-46`), plus `aria-haspopup="dialog"` and `aria-expanded`.
- Panel: `BottomSheet`'s own `role="dialog" aria-modal` (`BottomSheet.tsx:20`); do not add a second dialog role.
- The status line carries `role="status"` so a state change while the panel is open is announced — that role moves from the chip's span (`SyncChip.tsx:99`) into the panel, since the chip is now a button.
- Escape and backdrop-tap close are inherited (`BottomSheet.tsx:17`); drag is never the only exit (`:18`).
- No `min-h-[<48px]` anywhere in the new files — `touchTargets.test.ts:31-41` enforces this and its whitelist (`:12`) must not be extended.

---

## 7. Acceptance tests

Runnable checks left behind, per phase. Commands from `frontend/`.

### Phase 1 — `frontend/src/lib/offline/syncKinds.test.ts` (new)

1. Every one of the eleven types in `core.ts:120-131` maps to a `SyncKind`. **Assert against the union exhaustively** so a twelfth type added later fails this test rather than silently vanishing from the panel.
2. `summariseSyncQueueItems` splits live vs failed at `MAX_SYNC_ATTEMPTS` (`syncQueue.ts:12`) — boundary cases `attempts = 4` (live) and `attempts = 5` (failed).
3. `byKind` totals equal `live + failed` when all types are known.
4. An unknown type is counted in totals and absent from `byKind` — a kind row can never exceed the total.
5. `oldestPendingAgeMs` is `null` on an empty queue and matches the oldest `createdAt` otherwise (fixed `now`, no wall clock).
6. `formatLastSynced` — same-day returns time only; prior-day includes the date; `null` returns the "not synced yet" string. Fixed `now`, TZ-stable.

Plus in `frontend/src/lib/useOfflineStatus.test.tsx` (exists):

7. `lastSyncedAt` is written after a flush that synced ≥ 1 item.
8. `lastSyncedAt` is **not** written by a pass that synced 0 items.
9. `lastSyncedAt` reads back as `null` when localStorage throws (the helper swallows it — `storagePreferences.ts:14-18`).

### Phase 2 — `frontend/src/shell/test/SyncPanel.test.tsx` (new) + extend `SyncChip.test.tsx`

10. Tapping the chip opens the panel in **each** of the five states from `syncChipState.ts:7` — including `saved`, the state that was previously not a button.
11. `pendingByKind: { photos: 3 }` renders exactly one row reading "3 photos"; singular/plural correct at 1 and 2.
12. `lastSyncedAt` renders per the three §6.3-B cases.
13. Failed state → "Retry failed" is present and calls `retryFailedSyncs`; pending+online → "Sync now" calls `syncPendingChanges`; `saved` → **no button rendered**.
14. Both buttons are disabled while `isSyncing`.
15. Panel status line text equals the chip label for the same inputs (guards against the two drifting).
16. `frontend/src/shell/test/touchTargets.test.ts` passes with its `NON_INTERACTIVE` whitelist (`:12`) **unchanged** — this is the shell-freeze guard.
17. `frontend/src/shell/test/ShellScreen.test.tsx` passes **with no edits** — proof that no chrome changed.

Mock `useOfflineStatus` the way `SyncChip.test.tsx:11` already does, so no IndexedDB is needed.

### Phase 3

18. `showPills={false}` → no pill container rendered, `SyncConflictModal` still mounted, `useOfflineStatus` still called with `enableSyncWorker: true`.
19. `showPills` defaults `true` → office behaviour byte-identical.

### Full-suite gates (all phases)

```
cd frontend && npm run type-check
cd frontend && npm run test:unit
cd frontend && npm run test:e2e -- foreman-mobile-shell.spec.ts subbie-mobile-shell.spec.ts
npm run fallow:audit          # from repo root; verdict in the PR body
```

E2E: extend `frontend/e2e/foreman-mobile-shell.spec.ts` with one case — tap the chip, assert the sheet opens and shows "Sync". Do not build an offline-simulation E2E harness for v1; the unit tests cover the state matrix and the queue mechanics already have coverage (`syncQueue.test.ts`, `syncWorker.test.ts`, `useOfflineStatus.test.tsx`).

---

## 8. Exit gate

v1 is done when **all** of these are true:

1. Phases 1 and 2 are merged. (Phase 3 optional.)
2. Every test in §7 for the merged phases passes; `type-check` clean both ends.
3. `touchTargets.test.ts` whitelist unchanged and `ShellScreen.test.tsx` unedited — the shell-freeze proof.
4. `git diff --stat origin/master` shows **zero lines changed** in `frontend/src/shell/components/ShellScreen.tsx`.
5. `fallow:audit` verdict recorded in the PR body; no new dead exports; any helper orphaned by §4.2 is deleted, not left behind.
6. **Jay's device check** on a real phone: put it in aeroplane mode, capture 3 photos and a docket, open the panel, confirm it reads "3 photos / 1 docket", reconnect, confirm the counts drain and "Last synced" updates to the real time. Nothing in this spec is "done" until this has actually been run — a passing unit suite is not proof that a field worker can trust the number.
7. No new dependency in `frontend/package.json`.

---

## 9. Open decisions for Jay

**D1 — Placement: chip-opens-panel, or a new element in the shell chrome?**
**Recommendation: chip opens the panel.** The chip is already in both headers (`ShellScreen.tsx:191,241`) with its own hit area — this spends zero of the shell-touch grant on new chrome, and `ShellScreen.tsx` ends up with a zero-line diff.

**D2 — Both shells, or foreman only?**
**Recommendation: both `/m` and `/p`.** They render the same `ShellScreen.tsx`; excluding the subbie shell requires _adding_ a conditional, and subbie foremen fill dockets in the same dead spots.

**D3 — Kind rows: chevron (your card rule) or no chevron?**
**Recommendation: no chevron.** No screen exists that filters to a kind's pending items, so a chevron would promise navigation that goes nowhere — the one lie this panel cannot afford. Say the word and per-kind destinations become a follow-up.

**D4 — Does the panel replace the floating pill on the shells (Phase 3)?**
**Recommendation: yes, but hide the pills only — never unmount the component.** It duplicates the panel and is mispositioned on `/m`/`/p` (it uses office CSS vars, `index.css:242-260`), but it owns the only running sync worker (`OfflineIndicator.tsx:53-57`).

**D5 — Office desktop in v1?**
**Recommendation: no.** Office queues are permanently empty and office already has the pill plus the sign-out data-loss guard; adding a third surface there is build without a user.

---

## 10. Anti-over-build clause

This spec is deliberately smaller than the problem space, and that is the point.

The temptations, named so they can be refused in review: a `SyncProvider` context (the hook is already the shared layer, thirteen call sites deep — §1.3); a zustand slice for two scalars; a Dexie v7 migration for one timestamp; per-item queue inspection; unified "offline readiness" including map tiles; a `<SyncStatus>` component to replace all four surfaces at once; Background Sync.

Each is defensible in isolation. Together they are a rewrite of a subsystem that **already works** — `useOfflineStatus` has flush-on-mount, flush-on-visibility, flush-on-reconnect, a 60 s foreground interval, dead-lettering that never deletes user data, and conflict detection (§1.3). v1's job is to _show_ what that engine already knows, in one place, on the shells where it matters.

If a reviewer cannot point at a line in §2.1, the change does not belong in v1.

---

## 11. Estimated shape

| Phase | New files                     | Edited files                                                       | Rough net lines |
| ----- | ----------------------------- | ------------------------------------------------------------------ | --------------- |
| 1     | 2 (`syncKinds.ts`, its test)  | 3 (`syncQueue.ts`, `useOfflineStatus.ts`, `offlineDb.ts`)          | +130 / −25      |
| 2     | 2 (`SyncPanel.tsx`, its test) | 2 (`SyncChip.tsx`, `SyncChip.test.tsx`)                            | +200 / −15      |
| 3     | 0                             | 3 (`OfflineIndicator.tsx`, `DeferredOfflineIndicator.tsx`, a test) | +25 / −5        |

If a phase comes in materially above this, something out of §2.1 got in.
