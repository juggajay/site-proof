# Offline Sync Centre — Execution Spec (Rev 2)

**Date:** 28 July 2026 · **Rev 2** · **Status:** spec only. No product code in this PR.
**Code re-read in this worktree at `7a8b42b2` (= `origin/master` at Rev 2).** Rev 1 surveyed `f6f1ae35` (#1617); the adversarial review read code at `1d87ae57` (#1619 — the Rev 1 spec merge itself). `git diff f6f1ae35..7a8b42b2` over **every** frontend path cited in this document is **empty** (the range is two commits: the Rev 1 spec, and a lot-edit scale-prompt fix that touches none of them), so all Rev 1 line numbers still resolve. Every citation the review touched, and every citation this revision moves, was **re-opened at `7a8b42b2`** — not remembered.
**Authority:** Jay approved an offline sync centre on 2026-07-27 — _"3 photos pending, last synced 10:42, 1 failed — retry"_. That approval is an **explicit shell-touch grant for this surface only**; the shell freeze holds everywhere else.
**Sequencing:** follows the D14 arc (completed 2026-07-28). Discharges **A5-v** from `docs/plans/a5a6-gap-survey-2026-07-25.md:40` ("Sync-state unification — blocked on Jay's shell go-ahead").

**Ponytail note.** Rev 2 is **smaller** than Rev 1, in two places where Rev 1 specified something that cannot work: "Sync now" is **cut** (the panel's hook instance can never flush — §0.1 `[SC-B1]`), and **Phase 3 is cut** (it would delete the only re-entry to an unresolved conflict — `[SC-B3]`). What remains is two data fields, one read-only sheet, and one button that already exists in the header today.

---

## 0. Rev 2 changelog, and what v1 is now

Rev 1 was reviewed adversarially (verdict **6 / 10**), yielding four blockers `[SC-B1..B4]` and nine advisories `[SC-A1..A9]`. Every finding was **re-verified at `7a8b42b2`** before folding. **All thirteen held.** Re-verification also turned up three further errors the review did not reach, recorded in §0.3 — one of which corrects a claim inside the fold instruction itself.

### 0.1 Rev 2 changelog — blockers

| Tag | Verdict | Landed in |
| --- | --- | --- |
| `[SC-B1]` `useOfflineStatus` is per-instance state, so §6.3-D's "Sync now" is a dead button and `isSyncing` is structurally false in the panel | **HELD, and it is the load-bearing one.** Every call site gets its own `useState` block (`useOfflineStatus.ts:34-39`); nothing is shared. `SyncChip` calls `useOfflineStatus()` with no args (`SyncChip.tsx:56-57`) → `enableSyncWorker` defaults **false** (`:33`) → `syncPendingChanges` returns at `:84` **before** `setIsSyncing(true)` at `:86`. So in the chip's instance `isSyncing` is never true, `deriveSyncState` can never return `'syncing'` (`syncChipState.ts:15`), and a "Sync now" wired to `syncPendingChanges()` would do nothing at all. **"Retry failed" is unaffected** — `retryFailedSyncs` (`:141-152`) writes `attempts: 0` to Dexie (`syncQueue.ts:49-51`), and the root `OfflineIndicator` instance's 5 s poll sees the count go 0→N and re-fires its own flush effect (`:157-165`) — exactly the mechanism the shipped chip already relies on (`SyncChip.tsx:80-83`). | **"Sync now" is CUT from v1.** §2.1, §6.3-D and §7 rewritten: the panel ships **retry-only**, with at most one button, the same one the chip has today. §1.3 states the per-instance fact up front; §6.3-A records the unreachable `'syncing'` state so nobody hunts for it; §7 test 15 is scoped to the **four reachable** states. §2.2 gains a forbidden row: the panel must **not** pass `enableSyncWorker: true` (a second flush loop). A real shared sync trigger is a **named future slice** (§12), not v1. |
| `[SC-B2]` `lastSyncedAt` has a specified write and no specified read | **HELD.** The write happens in the root `OfflineIndicator` instance (the only one that flushes, `OfflineIndicator.tsx:53-57`); the read has to happen in the chip's instance. With a read only at mount, the panel shows "Not synced on this device yet" forever, because the two instances never talk. | §4.3 — `lastSyncedAt` is **re-read from localStorage inside the existing 5 s poll** (`useOfflineStatus.ts:62-80`), one extra line in `updateCounts`, no new timer. §7 gains test 10: _a value written by another instance appears within one poll_. Provenance stated in one line (§4.3). |
| `[SC-B3]` Phase 3 removes the only way to reach an unresolved sync conflict on `/m` and `/p` | **HELD.** The panel has no conflict row. `SyncConflictModal` is opened by exactly one thing — `setShowConflictModal(true)` on the conflict pill (`OfflineIndicator.tsx:79-90`, "Resolve" at `:88`); the modal itself is at `:152-162`. Phase 3 hid the pills and kept the modal, i.e. kept a modal with no opener. The chip has no conflict state at all (`syncChipState.ts:7`), so a dismissed or pre-existing conflict would be unreachable on the shells. | **Phase 3 is DROPPED from v1.** §5 now has two phases. The pills stay on `/m` and `/p`, mispositioned and duplicative, and that is the cheaper of the two wrongs. §5.3 records **why** and names the two preconditions any future Phase 3 must satisfy first: a conflict row in the panel, and a literal-pathname test (`[SC-A6]`). §9 D4 re-answered. §12 carries it as a future slice. |
| `[SC-B4]` consolidation is only behaviour-preserving if `oldestPendingAgeMs` keeps counting dead-lettered rows | **HELD.** `getOldestPendingItemAge` (`syncQueue.ts:83-91`) takes `Math.min` over `createdAt` across **all** rows — it does not filter on `attempts`. It feeds `oldestPendingItemAge`, which feeds `isStuck` (`OfflineIndicator.tsx:59-63`). Rev 1 §4.2's `live` / `failed` framing invited a reimplementation that filters to live rows, which would silently stop the stuck warning firing on the exact queues that are most stuck. | §4.2 — one explicit sentence on the `oldestPendingAgeMs` field, plus §7 test 5a: a queue whose **only** rows are dead-lettered still reports an age. |

### 0.2 Rev 2 changelog — advisories

| Tag | Verdict | Landed in |
| --- | --- | --- |
| `[SC-A1]` citation drift, four places | **HELD, all four, and re-measured here.** `touchTargets.test.ts`: the whitelist is `NON_INTERACTIVE` at **`:31`** (`:12` is a doc-comment line) and the enforcing test is **`:50-65`** (`:31-41` is the `walk()` helper). `SyncChip.test.tsx`: the `vi.mock` is at **`:52`** (`:11` is a comment mentioning it). `BottomSheet.tsx`: `role="dialog" aria-modal` are at **`:192-193`** (`aria-label={title}` at `:194`); `:17-20` is the file's doc comment. | Corrected at every occurrence — §1.5, §1.7, §5.2, §6.2, §6.5, §7 items 16-17, §8. |
| `[SC-A2]` there is a second count path, and a third; "one hook" is wrong as stated | **HELD, and there are more instances than the review found.** (a) `hooks/useOnlineStatus.ts:26-40` polls `getPendingSyncCount()` on its own 5 s interval (`:38`) into zustand (`stores/foremanMobileStore.ts:91-92`, **persisted** at `:119`), initialised by `ForemanMobileDashboard.tsx:87` and consumed by `TodayWorklist.tsx:100` — both are the **office mobile** dashboard (`pages/DashboardPage.tsx:91`), not `/m` or `/p`. (b) `shell/screens/lots/useShellItpRun.ts` calls `getPendingSyncCount()` at `:110`, `:184` and `:269` into a `pendingCount` state (`:77`) returned at `:313` that **no consumer reads** — `ItpRunScreen`, `LotDetailsScreen`, `LotHubScreen` and its own test all ignore it. Dead state on a shell screen. (c) `pages/lots/hooks/useItpInstance.ts:117,287` does the same ad-hoc read on the office lot page. | §0.4 and §1.3 reworded — `useOfflineStatus` is the **only hook the shells' sync UI reads**, not the only count path in the app. §1.2 gains the three extra paths, with the dead `pendingCount` named as an incidental deletion candidate (**not** v1 work — §2.2). |
| `[SC-A3]` §4.2's dead-export claim is wrong, and the consolidation leaves kind-row drift | **HELD, both halves.** `retryFailedSyncs` still calls `getLiveSyncCount` + `getFailedSyncCount` at `useOfflineStatus.ts:144-147`, so Rev 1's gate 5 ("delete any helper orphaned by §4.2") would have deleted two live dependencies. Second-order: after a retry, `pendingByKind` would be stale for up to 5 s while the totals had already moved. | §4.2 — `retryFailedSyncs` **swaps onto `summariseSyncQueue()`** in Phase 1 (one call replacing two, kind rows refresh with the totals). §8 gate 5 names the orphan set explicitly — see §0.3 item 1, which corrects the count. |
| `[SC-A4]` write-site ambiguity at `useOfflineStatus.ts:128` | **HELD.** The line reads `if (syncedCount > 0 && callbacks?.onSyncComplete)`. Writing `lastSyncedAt` "at `:128`" inside that block makes the timestamp depend on whether a caller happened to pass a callback — every read-only call site would flush without ever recording it. | §4.3 — the condition is split: `if (syncedCount > 0) { write; callbacks?.onSyncComplete?.(…) }`. Guarded on `syncedCount` **only**. Device-clock provenance acknowledged in one line; no backwards-jump guard in v1. |
| `[SC-A5]` `HubTile` cannot be reused for the kind rows | **HELD, exactly as described.** `HubTile` is a `<button>` (`HubTile.tsx:33`), `onPress` is required (`:22`, `:29`), and the chevron is hardcoded with no opt-out (`:48-52`). Chip class: `HubTile` uses `.shell-count-chip` (`:42`); Rev 1 said `.shell-chip`. Both exist — `.shell-chip` at `index.css:354` ("Role/status chip — monochrome"), `.shell-count-chip` at `:364` ("Number/count chip on tiles", amber). | §6.3-C resolves the branch: **write a local row** in `SyncPanel.tsx`, `.shell-hub` visual (`index.css:471-486`) on a non-interactive element, no chevron, `HubTile` untouched. Chip class **confirmed `.shell-chip`** — the row's chip carries a status word ("Waiting"), and the count already lives in the label, so the count chip's styling would be the wrong signal. |
| `[SC-A6]` Phase 3's prefix check has no source | **HELD.** `shellFlag.ts` exports no pathname prefix. `getActiveShellHomePath` (`:156-167`) takes a **user + viewport** and returns `'/m' \| '/p' \| null`; it never sees a pathname. | Moot for v1 (Phase 3 dropped, `[SC-B3]`). Recorded in §5.3 as a **precondition**: a future Phase 3 derives the prefixes from a literal check and pins it with a literal test. |
| `[SC-A7]` a static import of the panel drags framer-motion into the shared shell chunk | **HELD.** `BottomSheet.tsx` imports `AnimatePresence`, `animate`, `motion`, `useMotionValue`, `useTransform`, `useReducedMotion` from framer-motion (`:26-33`), and today it is mounted under `/p` only (`shell/subbie/screens/CompanyScreen.tsx:540,617`, `shell/subbie/screens/dockets/DocketEntrySheets.tsx:76`) — never under `/m`. `SyncChip` is in **every** shell header (`ShellScreen.tsx:191,241`), so a static import would put framer-motion in the first chunk both shells load. | §5.2 / §6.2 — the panel is `lazy()`-imported and rendered inside `<Suspense fallback={null}>` **only when open**. One line, and it keeps the foreman shell's first paint where it is. |
| `[SC-A8]` §1.2's framing is wrong in three ways | **HELD, all three.** `getPendingSyncCount` uses `.count()` (`syncQueue.ts:22-24`), not `toArray()`. `getPendingSyncItems` (`:14-16`) is a **fourth** full scan and Rev 1's table omitted it. And the cost is **per mounted consumer**: the poll effect (`useOfflineStatus.ts:62-80`) is **not** gated on `enableSyncWorker`, so all fifteen call sites run it. | §1.2 rewritten — table corrected and extended, with the per-consumer multiplier stated. It makes the 3→1 collapse a better trade than Rev 1 claimed, for a reason Rev 1 got wrong. |
| `[SC-A9]` over-build bait, four items | **HELD.** (a) Rev 1 §11 budgeted Phase 2 at **+200** lines against a §5 cap of **< 120**. (b) Two-rows-per-kind doubles the panel's tallest state for a distinction the summary line already carries. (c) Re-exporting symbols nothing imports is how facades rot. (d) Per-kind destinations are `[D3]`, already deferred. | (a) §11 Phase 2 tightened to the §5 cap, with a stated rule that test files are not budgeted. (b) §6.3-C is now **one row per kind** plus a single `N failed` summary line. (c) §4.2 / §5.1 — the facade re-exports **`summariseSyncQueue` only**; see §0.3 item 3 for the split and why it inverts the review's suggestion. (d) unchanged — §6.4, §9 D3, §12. |

### 0.3 Rev 2's own corrections — found while re-verifying, not in the review

1. **"`getOldestPendingItemAge` is the only orphan" is wrong — after `[SC-A3]` there are three.** Measured at `7a8b42b2`: outside `lib/offline/syncQueue.ts` itself, the **only** non-test callers of `getLiveSyncCount`, `getFailedSyncCount` and `getOldestPendingItemAge` anywhere in `frontend/src` are `useOfflineStatus.ts` (`:65-68`, `:115-118`, `:145-146`) and the facade re-export (`offlineDb.ts:114-116`). Once the poll, the post-flush refresh **and** `retryFailedSyncs` all move to `summariseSyncQueue()`, **all three** are test-only. §8 gate 5 therefore names three, not one. `getPendingSyncCount` is **not** in that set — it keeps five live callers (`offlineDb.ts:528`, `hooks/useOnlineStatus.ts:30`, `useShellItpRun.ts:110,184,269`, `pages/lots/hooks/useItpInstance.ts:117,287`). §7 records the test churn this implies: `useOfflineStatus.test.tsx` mocks the three by name (`:59-61`, `:124-126`, `:164-166`, `:248-251`, `:1165`, `:1187`) and must be repointed at `summariseSyncQueue`; `syncQueue.test.ts:76,87,166-190` covers the deleted helpers and its assertions move to `summariseSyncQueueItems`.
2. **Rev 1's `lastSyncedAt` clear-on-sign-out does not clear anything.** `clearAllOfflineData` (`syncQueue.ts:93-103`) clears **Dexie tables only**; `lastSyncedAt` lives in localStorage, so it would survive sign-out and show the previous user's time. Its one caller is `clearOfflineDataSafely` (`lib/auth.tsx:122-139`, Dexie purge at `:124-125`, map-cache purge at `:132-137`). §4.3 now names that function as the landing site for a `removeLocalStorageItem` line — **not** `clearAllOfflineData`, whose name would then be a lie.
3. **The facade split is inverted relative to the review's suggestion, deliberately.** `[SC-A9c]` proposed re-exporting `SyncKind` + `formatLastSynced` but not `summariseSyncQueue`. Measured: `useOfflineStatus.ts:2-10` imports **everything** through `@/lib/offlineDb`, which is the stated contract (`syncQueue.ts:1-3`: the facade exists so `@/lib/offlineDb` stays the import path for callers). That contract is about **hiding Dexie**. So: `summariseSyncQueue` (touches Dexie) is re-exported and the hook imports it from the facade; `SyncKind` and `formatLastSynced` are **pure, no I/O** and are imported straight from `@/lib/offline/syncKinds` by both the hook and the panel — no facade entry, because there is nothing to hide. Every re-export still has a caller, which is `[SC-A9c]`'s actual test.
4. **"Thirteen read-only call sites" is fourteen (fifteen total).** `QuickPhotoCapture.tsx` calls the hook **twice** (`:30` and `:415`) and Rev 1's list counted it once. Corrected in §1.3 and §4.4.
5. **Four further citation slips, beyond the four `[SC-A1]` found.** `a5a6-gap-survey-2026-07-25.md`'s A5-v line is **`:40`**, not `:41` (the file is 40 lines long). The `visibilitychange` comment quoted twice in Rev 1 is `useOfflineStatus.ts:178-179`, but its enclosing block starts at `:177`. `clearOfflineDataSafely` runs `:122-139` (Dexie purge `:124-125`, map-cache purge `:132-137`). `index.css`'s office-var block is `:240-261`, not `:242-260`. All corrected in place. **Every `file:line` in this document — 140 of them — was machine-checked at `7a8b42b2` to resolve to an existing file and an in-range line**; the four above are what that pass caught.

### 0.4 What v1 is now — the one-paragraph version

Almost all of this already exists. There is one Dexie queue (`syncQueue`), one hook the shells' sync UI reads (`useOfflineStatus`), and one chip already sitting in both shell headers (`SyncChip`). Two things are genuinely missing: **pending counts broken down by kind**, and **a last-successful-sync timestamp**. v1 adds exactly those two data fields, and makes the chip that is already in the header open a sheet that shows them, with the **retry** action it already has. No new engine, no new persistence layer, no new chrome element, no geometry change, **no new sync trigger** (`[SC-B1]`), and **no change to the floating pills** (`[SC-B3]`).

---

## 1. Current-truth inventory (re-read at `7a8b42b2`)

### 1.1 The queue — one Dexie DB, one table, eleven item types

- Database `SiteProofOfflineDB`, Dexie `^3.2.4` — `frontend/src/lib/offline/core.ts:320`, singleton exported `core.ts:381`. Dexie dep at `frontend/package.json:45`.
- Schema v6 object stores — `core.ts:367-377`. The queue table is `syncQueue: '++id, type, action, createdAt'` (`core.ts:370`).
- Queue row shape `SyncQueueBase` — `core.ts:84-92`: `{ id?, type, action, data, createdAt, attempts, lastError? }`. **No per-item timestamp of last attempt, and no success timestamp anywhere.**
- The eleven queue types — `core.ts:120-131`:
  `itp_completion`, `photo_upload`, `ncr_create`, `diary_save`, `diary_submit`, `docket_create`, `docket_submit`, `lot_edit`, `lot_conflict`, `delivery_save`, `event_save`.
- Dispatch to per-type executors — `frontend/src/lib/offline/syncWorker.ts:941-995`.
- Dead-letter threshold `MAX_SYNC_ATTEMPTS = 5` — `frontend/src/lib/offline/syncQueue.ts:12`. Items are **kept, never deleted**, on exhaustion (`syncQueue.ts:7-11`, `useOfflineStatus.ts:94-100`). Permanent-fail on 4xx — `syncWorker.ts:804-806`.

### 1.2 The count helpers — four table reads, five seconds apart, times every mounted consumer `[SC-A8]`

| Helper                      | File:line                               | Reads                                                                 |
| --------------------------- | --------------------------------------- | --------------------------------------------------------------------- |
| `getPendingSyncItems()`     | `syncQueue.ts:14-16`                    | full `toArray()` — the flush's own read (`useOfflineStatus.ts:91`)     |
| `getPendingSyncCount()`     | `syncQueue.ts:22-24`                    | `.count()` — **not** a scan                                           |
| `getLiveSyncCount()`        | `syncQueue.ts:28-31`                    | full `toArray()`                                                      |
| `getFailedSyncCount()`      | `syncQueue.ts:35-38`                    | full `toArray()`                                                      |
| `getOldestPendingItemAge()` | `syncQueue.ts:83-91`                    | full `toArray()`, **over every row including dead-lettered** (§4.2)    |
| `resetFailedSyncItems()`    | `syncQueue.ts:42-54`                    | full `toArray()` + one `update()` per revived row (`:49-51`)          |
| `getConflictedLotsCount()`  | `frontend/src/lib/offlineDb.ts:519-521` | `lots` where `syncStatus == 'conflict'`, `.count()`                   |
| `getUnsyncedWorkCount()`    | `offlineDb.ts:527-530`                  | `getPendingSyncCount()` + `getConflictedLotsCount()`                  |

`useOfflineStatus` fires four of these in parallel on a 5 s interval — `useOfflineStatus.ts:62-80` (interval at `:77`) — and the same four again after each sync pass at `:114-119`, on top of the flush's own `getPendingSyncItems()` at `:91`. **Three of the four are separate full scans of the same table.**

Two things make the collapse worth more than Rev 1 claimed: the poll effect at `:62-80` has **no `enableSyncWorker` guard**, so it runs in every one of the fifteen instances (§1.3) — the scan cost is per mounted consumer, not per app; and the kind breakdown v1 needs is **free** once those three become one.

**Other count paths that exist and are not this one `[SC-A2]`** — none of them is v1's business, but "one hook" is not true of the app as a whole:

- `hooks/useOnlineStatus.ts:26-40` — its own 5 s poll (`:38`) of `getPendingSyncCount()` into zustand (`stores/foremanMobileStore.ts:91-92`, **persisted** `:119`). Initialised by `components/foreman/ForemanMobileDashboard.tsx:87`, read by `components/foreman/TodayWorklist.tsx:100`. That dashboard is the **office mobile** view (`pages/DashboardPage.tsx:91`) — it does not render under `/m` or `/p`.
- `shell/screens/lots/useShellItpRun.ts:110,184,269` — ad-hoc `getPendingSyncCount()` into `pendingCount` (`:77`), returned at `:313`, **read by nobody**: `ItpRunScreen.tsx:42`, `LotDetailsScreen.tsx:53`, `LotHubScreen.tsx:38` and `test/useShellItpRun.test.ts` all ignore it. Dead state; a deletion candidate for whoever next touches that file, **not** v1 work (§2.2).
- `pages/lots/hooks/useItpInstance.ts:117,287` — the same ad-hoc read on the office lot page.

### 1.3 The hook — one driver, and it is **per-instance, not shared** `[SC-B1]`

`useOfflineStatus` — `frontend/src/lib/useOfflineStatus.ts:32`.

> **Read this before designing anything that calls it.** `useOfflineStatus` is a plain hook, not a store. Every call site gets its **own** `useState` block (`:34-39`), its own 5 s poll (`:62-80`) and its own `isSyncing`. Two instances share **only** what they both read from Dexie/localStorage. Nothing propagates from one instance to another except through storage, on the next poll tick. Every design decision below that looks conservative is downstream of this one fact.

Returns (`:214-223`): `isOnline`, `pendingSyncCount`, `failedSyncCount`, `isSyncing`, `syncPendingChanges`, `retryFailedSyncs`, `conflictCount`, `oldestPendingItemAge`.

Drive points:

- 5 s count poll — `:77` (**ungated**; runs in every instance)
- 1 s debounce flush on regaining connectivity — `:157-165`
- flush on mount — `:169-175`
- flush on `visibilitychange` — `:180-194` (comment `:178-179`: _"iOS never delivers a Background Sync event; visibilitychange is the only reliable foreground signal"_)
- 60 s foreground interval while pending — `:200-212`, constant `FOREGROUND_FLUSH_INTERVAL_MS` at `:18`
- manual dead-letter revive — `retryFailedSyncs` at `:141-152`
- `STUCK_SYNC_THRESHOLD_MS = 2h` — `:16`

`enableSyncWorker` defaults **false** (`:33`) and gates every flush effect (`:84`, `:158`, `:170`, `:181`, `:201`) — note `:84` returns **before** `setIsSyncing(true)` at `:86`.

**Exactly one call site enables the worker:** `frontend/src/components/OfflineIndicator.tsx:53-57`. The other **fourteen are read-only** `[SC-A1]`:

`SyncChip.tsx:56-57`, `PhotosListScreen.tsx:142`, `PhotoDetailScreen.tsx:40`, `IssueDetailScreen.tsx:75`, `DocketDetailScreen.tsx:48`, `AdjustHoursScreen.tsx:45`, `RejectFormScreen.tsx:33`, `QueryFormScreen.tsx:33` (all under `frontend/src/shell/screens/`), `QuickPhotoCapture.tsx:30` **and** `:415` (two sites), `LotEditPage.tsx:43`, `LotDetailPage.tsx:69`, `useDocketEditorController.ts:97`, `OfflineIndicator.tsx:168`.

**The two consequences that shape v1:**

1. A panel mounted under `SyncChip` reads `isSyncing` from the **chip's** instance, which is permanently `false` — so `deriveSyncState` can never return `'syncing'` there (`syncChipState.ts:15`), and any button wired to `syncPendingChanges()` is inert (`:84`). Hence **retry-only** (§6.3-D).
2. `retryFailedSyncs` works **anyway**, because it does not flush — it writes `attempts: 0` to Dexie (`:142` → `syncQueue.ts:49-51`); the root `OfflineIndicator` instance's poll then sees pending go 0→N and its own effect at `:157-165` flushes. This is the shipped chip's existing mechanism, documented at `SyncChip.tsx:80-83`.

> **Load-bearing fact:** the sync worker for the mobile shells is owned by an _office-shaped_ component (`OfflineIndicator`) mounted at app root — `frontend/src/App.tsx:717` via `DeferredOfflineIndicator`. It is lazy-loaded on idle callback / 1.5 s timeout / going offline — `frontend/src/components/DeferredOfflineIndicator.tsx:40-53`, render at `:67`. **Unmounting it inside the shells would stop all sync on `/m` and `/p`.**

### 1.4 The four existing sync surfaces (three enums)

Confirms `a5a6-gap-survey-2026-07-25.md:16`, re-verified at this SHA:

1. **`SyncChip`** — `frontend/src/shell/components/SyncChip.tsx:55-104`. Five states via `deriveSyncState` — `frontend/src/shell/components/syncChipState.ts:7-22` (`saved|waiting|syncing|failed|offline`), of which **`syncing` is unreachable from the chip's own instance** (§1.3). Labels `SyncChip.tsx:18-31`, aria `:33-46`, tone `:48-53`. Only the `failed` state is a button (`:84-96`); everything else is `role="status"` (`:99`). Tests: `frontend/src/shell/test/SyncChip.test.tsx`.
2. **`OfflineIndicator`** floating pills — `frontend/src/components/OfflineIndicator.tsx:70-164`. Different enum (conflict `:79-90`, failed `:94-108`, offline `:111-120`, stuck `:121-127`, pending `:128-148`). Positioned with `above-quick-add-bar` (`:77`), a class keyed to **office** CSS vars `--bottom-nav-height` / `--quick-add-bar-height` (`frontend/src/index.css:240-261`) — the shells never publish those vars, so on `/m` and `/p` this pill floats over the `.shell-cambar` action bar (`index.css:506-513`). **v1 does not touch it** (`[SC-B3]`, §5.3).
   - **The conflict re-entry lives here and nowhere else.** `SyncConflictModal` (`:152-162`) is opened by exactly one call — `setShowConflictModal(true)` on the conflict pill at `:79-90` ("Resolve" chip at `:88`). The chip has no conflict state (`syncChipState.ts:7`); the panel has no conflict row (§6.3). Remove the pill and an unresolved conflict becomes unreachable on the shells.
3. **`OfflineBadge`** — `OfflineIndicator.tsx:167-193`. **Zero JSX mounts anywhere. Dead export.**
4. **`SyncStatusBadge`** — `OfflineIndicator.tsx:195-233`, third enum (`synced|pending|error|conflict`). Mounted at `frontend/src/pages/lots/components/LotEditPageChrome.tsx:47` (office) and `frontend/src/components/QuickPhotoCapture.tsx:302` (component has no external importers — effectively dead).

Also: `UnsyncedSignOutDialog` via `useUnsyncedSignOut` — `frontend/src/components/layouts/UserMenu.tsx:56`, rendered `:264` — **office desktop only, no shell equivalent**. It reads `getUnsyncedWorkCount()` (`UnsyncedSignOutDialog.tsx:56`).

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

Geometry: no fixed header height (content-driven, `sticky top-0 … px-5 pb-[14px] pt-3` at `:175` and `:221`). Header row is `min-h-[40px]` (`:188`, `:222`) — the **single** whitelisted sub-48px box, `NON_INTERACTIVE` at `frontend/src/shell/test/touchTargets.test.ts:31` `[SC-A1]`. Controls inside are 40px visual / 48px hit via `.shell-tap48` (`frontend/src/index.css:295-308`), enforced repo-wide by the scan at `touchTargets.test.ts:50-65` `[SC-A1]`. **No bottom tab bar in either shell** — the only bottom chrome is the per-screen `.shell-cambar` (`index.css:506-516`).

Activation: `frontend/src/shell/shellFlag.ts:110-118` (foreman), `:132-140` (subbie), `:156-167` (dispatcher returning `'/m' | '/p' | null` **from user + viewport, never from a pathname** — `[SC-A6]`, §5.3).

### 1.6 Card rules — the uniform card already exists, and it is a button `[SC-A5]`

`frontend/src/shell/components/HubTile.tsx:17-55` — anatomy is exactly icon (`:34-36`) + title (`:38`) + optional chip (`:40-47`) + chevron (`:48-52`), **no subtitle**, with the rule stated in its doc comment `:5-9`. Styling `.shell-hub` `index.css:471-486` (min-height 76px), icon box `.shell-hub-ico` `index.css:493-503` (44px).

It is **not reusable for a status row**: the root element is a `<button>` (`:33`), `onPress` is a required prop (`:22`, `:29`), and `<ChevronRight>` is rendered unconditionally (`:48-52`) with no opt-out. Its chip uses `.shell-count-chip` (`:42`), not `.shell-chip`. See §6.3-C for what v1 does instead.

Escape hatch: `.shell-card` (`index.css:569-581`) is a bare tile with **no enforced anatomy** — hand-rolled list rows use it (e.g. `shell/screens/issues/IssuesListScreen.tsx:56`, `shell/screens/dockets/DocketsListScreen.tsx:48`). There is no shared list-row component.

### 1.7 Sheet primitives — already present, already used in the shells

- `BottomSheet` — `frontend/src/components/foreman/sheets/BottomSheet.tsx`. It carries `role="dialog"` + `aria-modal="true"` at **`:192-193`** and `aria-label={title}` at `:194` `[SC-A1]`; Escape close `:66-73`; backdrop tap `:191` and `:201`; sticky-header X button `:265-274`; drag-to-close `:142-150`; `prefers-reduced-motion` via `useReducedMotion` (`:48`, applied `:154-176`). The `:17-20` bullets are its doc comment, not code.
- **It pulls framer-motion** (`:26-33`) `[SC-A7]`. Already used inside the **subbie** shell: `frontend/src/shell/subbie/screens/CompanyScreen.tsx:540,617`; `frontend/src/shell/subbie/screens/dockets/DocketEntrySheets.tsx:76`. **Never mounted under `/m` today** — hence the lazy import in §5.2.
- `ResponsiveSheet` (mobile sheet / desktop modal adapter) — `frontend/src/components/ui/ResponsiveSheet.tsx:44-52`; note `:56-58` — BottomSheet must be the only dialog node (Playwright strict mode).

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
- **Sign-out purge is Dexie + Cache API only** — `clearOfflineDataSafely`, `frontend/src/lib/auth.tsx:122-139`; `clearAllOfflineData()` (`syncQueue.ts:93-103`) clears **tables**, never localStorage (§0.3 item 2, §4.3).

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
2. A `lastSyncedAt` timestamp persisted in localStorage, **written** on successful flush and **re-read on the existing 5 s poll** (`[SC-B2]`).
3. Two new fields on `useOfflineStatus`'s return value.
4. One sheet — the **Sync Centre** — opened by the `SyncChip` already in the shell header, lazily imported (`[SC-A7]`), carrying **at most one button: "Retry failed"** (`[SC-B1]`).
5. Shells `/m/*` and `/p/*` only.

### 2.2 Explicitly OUT of scope — v1 must not do any of this

This list is normative. A PR that does any of the following is out of spec and should be sent back regardless of how good it looks.

| Forbidden                                                                          | Why                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A "Sync now" button, or any new flush trigger** `[SC-B1]`                        | The panel's hook instance cannot flush (`useOfflineStatus.ts:33,84`). A button that calls `syncPendingChanges()` there is inert; the honest version is a shared trigger, which is a future slice (§12).         |
| **Passing `enableSyncWorker: true` from the panel or the chip** `[SC-B1]`          | It would "fix" the dead button by creating a **second** flush loop alongside `OfflineIndicator`'s (`OfflineIndicator.tsx:53-57`) — two workers racing the same Dexie rows, on the shell where sync matters most. |
| **Any change to `OfflineIndicator`, its pills, or its mount** `[SC-B3]`            | The conflict pill (`:79-90`) is the only opener of `SyncConflictModal` (`:152-162`). Rev 1's Phase 3 is dropped; §5.3 says what a future one needs first.                                                        |
| **New persistence layer or Dexie version bump**                                    | A single scalar (`lastSyncedAt`) does not justify a v7 migration on every field device. localStorage via the existing helper (`storagePreferences.ts:54`).                                                      |
| **Background Sync / service-worker sync**                                          | `sw-push.js` has no `sync` handler by design; iOS never delivers the event (`useOfflineStatus.ts:178-179`). Adding it would create a second sync engine.                                                        |
| **Map-tile / Cache API state in the panel**                                        | Disjoint subsystem (§1.8). Wiring `caches.open('civos-map-tiles').keys()` into a mutation-queue panel merges two unrelated stories and needs new plumbing on the tile side. Separate spec if Jay ever wants it. |
| **Conflict-resolution changes**                                                    | `SyncConflictModal` and the three resolve strategies (`offlineDb.ts:430,450,471`) stay byte-identical.                                                                                                          |
| **Per-item queue browser, delete-item, or edit-queued-item UI**                    | Counts by kind answer "is my work safe". Item-level surgery is a support tool, not a field tool.                                                                                                                |
| **Cleaning up the other count paths** (`useOnlineStatus`, `useShellItpRun.pendingCount`) `[SC-A2]` | Real dead code, genuinely unrelated to this surface, and each one drags a different screen's tests in. Named in §1.2 for whoever next edits those files.                                                        |
| **TanStack Query `networkMode` change or a persister**                             | Behaviour change across every query in the app, unrelated to this surface.                                                                                                                                      |
| **Rewriting `OfflineIndicator`'s enum, `SyncStatusBadge`, or the office surfaces** | A5-v's full unification is bigger than Jay's grant. v1 unifies the _shell_; office stays as-is.                                                                                                                 |
| **A new header element, new chrome node, or any change to header geometry**        | The grant is for a panel, not a redesign. The chip already occupies the slot. `touchTargets.test.ts` must stay green with its whitelist (`:31`) unchanged.                                                      |
| **Unmounting `OfflineIndicator` on shell routes**                                  | It owns the only `enableSyncWorker: true` (`OfflineIndicator.tsx:53-57`). Unmounting it stops all sync on `/m` and `/p`.                                                                                        |
| **New dependency of any kind**                                                     | Sheet primitive, localStorage helper, and time formatting are all already available or one line.                                                                                                                |

---

## 3. Office vs field — which shells get it

**v1 ships to `/m/*` and `/p/*`. Office desktop gets nothing.**

Reasoning:

1. **Field is where the queue is non-empty.** Every offline write path — `capturePhotoOffline` (`QuickPhotoCapture.tsx:196,424`), offline diaries (`lib/offline/diaries.ts`), offline dockets (`lib/offline/dockets.ts`), offline ITP completions (`lib/offline/itp.ts`), offline NCR capture (`core.ts:112-118`) — is a field action. An office user on wifi sees `pendingSyncCount === 0` permanently, and `OfflineIndicator` correctly renders `null` in that case (`OfflineIndicator.tsx:66-68`).
2. **Office already has the two things it needs.** The floating pill (correctly positioned there, `index.css:240-261`) and the sign-out data-loss guard (`UserMenu.tsx:56,264`). The shells have neither working properly — the pill mispositions (§1.4) and there is no shell sign-out guard at all.
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

> **`oldestPendingAgeMs` is computed over ALL rows, including dead-lettered ones** `[SC-B4]`. This is not a design choice — it is what `getOldestPendingItemAge` does today (`syncQueue.ts:83-91`: `Math.min` over `createdAt`, **no `attempts` filter**), and its value feeds `isStuck` (`OfflineIndicator.tsx:59-63`). Filtering it to `live` rows — which the `live` / `failed` field names above invite — would silently stop the stuck warning firing on precisely the queues that are most stuck. §7 test 5a pins it.

**Three call sites move, not two** `[SC-A3]`. `useOfflineStatus.ts:62-80` and `:114-119` replace their `getLiveSyncCount` + `getFailedSyncCount` + `getOldestPendingItemAge` triples with a single `summariseSyncQueue()` (still parallel with `getConflictedLotsCount()`), **and so does `retryFailedSyncs` at `:144-147`** — two calls become one. That third swap is not cosmetic: without it, a retry updates the totals immediately but leaves `pendingByKind` stale for up to 5 s, so the panel's kind rows and its summary line disagree in the exact moment the user is watching them.

**This is net deletion:** three full IndexedDB table scans every 5 seconds, in every mounted instance, become one — and the app gains the kind breakdown as a by-product.

**What that orphans — three helpers, not one** (§0.3 item 1). After all three call sites move, `getLiveSyncCount`, `getFailedSyncCount` and `getOldestPendingItemAge` have **zero non-test callers** in `frontend/src`; delete all three plus their `offlineDb.ts:114-116` re-exports. `getPendingSyncCount` **stays** — five live callers (`offlineDb.ts:528`, `useOnlineStatus.ts:30`, `useShellItpRun.ts:110,184,269`, `useItpInstance.ts:117,287`). Re-grep before deleting anything, and run `npm run fallow:audit` to confirm no new dead exports. Test churn is named in §7.

**Facade re-exports** (`[SC-A9c]`, §0.3 item 3): `offlineDb.ts` re-exports **`summariseSyncQueue` only** — it touches Dexie, and `@/lib/offlineDb` is the stated import path for Dexie callers (`syncQueue.ts:1-3`), which is how `useOfflineStatus.ts:2-10` already imports everything. `SyncKind` and `formatLastSynced` are pure and are imported straight from `@/lib/offline/syncKinds` by the hook and the panel — no facade entry for something with no I/O to hide. Every re-export keeps a caller.

### 4.3 `lastSyncedAt`

- Storage: `localStorage`, key `civos.sync.lastSyncedAt`, value an ISO-8601 string.
- Read/write via `readLocalStorageItem` / `writeLocalStorageItem` (`frontend/src/lib/storagePreferences.ts:50,54`) — already failure-tolerant for privacy-restricted browser contexts (`:14-18`, `:29-40`).
- **Written in one place, guarded on `syncedCount` alone** `[SC-A4]`: inside `syncPendingChanges`'s exclusive run, where `useOfflineStatus.ts:128` currently reads `if (syncedCount > 0 && callbacks?.onSyncComplete)`. That condition is **split**, because a timestamp that only records itself when a caller happened to pass a callback is a bug waiting for its first read-only call site:

  ```
  if (syncedCount > 0) {
    writeLocalStorageItem('civos.sync.lastSyncedAt', new Date().toISOString());
    callbacks?.onSyncComplete?.({ syncedCount, failedCount });
  }
  ```

  Not on a zero-item pass (a no-op poll is not a sync), and not on a pass that only dead-lettered items.
- **Read on the existing 5 s poll** `[SC-B2]` — one added line in `updateCounts` (`useOfflineStatus.ts:62-80`), setting a `lastSyncedAt` state field from `readLocalStorageItem`. This is the whole fix for the cross-instance problem: the value is written by the root `OfflineIndicator` instance and read by the chip's instance, and localStorage plus the poll that already exists is the cheapest correct channel between two instances of a non-shared hook (§1.3). No `storage` event listener, no store, no context. Worst-case staleness is one poll tick, on a timestamp whose display granularity is one minute. §7 test 10 pins it.
- **Provenance: it is the device's clock**, `new Date()` on the phone that did the flush — not server time. A phone with a wrong clock shows a wrong "last synced". Accepted for v1: the field answers "did my stuff go up recently", and the same clock renders it, so the comparison is at least self-consistent. No backwards-jump guard (`[SC-A4]`).
- **Cleared on sign-out** — add `removeLocalStorageItem('civos.sync.lastSyncedAt')` inside `clearOfflineDataSafely` (`frontend/src/lib/auth.tsx:122-139`), next to the existing Dexie purge at `:124-125`. **Not** inside `clearAllOfflineData` (`syncQueue.ts:93-103`), which clears Dexie tables only and should keep meaning that (§0.3 item 2). A stale "last synced" from the previous user is a lie.
- **Never synthesised.** If the key is absent, the panel says "Not synced on this device yet". It does not fall back to "now", to the session start, or to the oldest queue item.

### 4.4 Hook surface

`useOfflineStatus` (`useOfflineStatus.ts:214-223`) gains exactly two fields:

```
pendingByKind: Record<SyncKind, number>   // from summary.byKind
lastSyncedAt: string | null               // ISO or null
```

All eight existing fields keep their current names and semantics. **No consumer changes required** — the fourteen read-only call sites in §1.3 keep compiling untouched. There is no new hook, no new store, no context, no zustand slice. `useOfflineStatus` is the layer the shells' sync UI already shares (every surface in §1.4 reads it — `a5a6-gap-survey-2026-07-25.md:16`), and v1 does **not** promote it into a shared store: that would be a rewrite of the flush lifecycle, and the one thing it would buy — a working "Sync now" — is cut (`[SC-B1]`, §12).

### 4.5 Time formatting

"Last synced 10:42" is `new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })` — one line, native, no dependency (there is no `date-fns` or `dayjs` in `frontend/package.json`, §1.8).

Rule: **same calendar day → time only** ("10:42"). **Earlier day → date + time** ("Sat 26 Jul, 16:08"). A bare "10:42" for a sync that happened two days ago is the exact kind of lie that costs trust on a QA-evidence product. The same-day check goes in a tiny pure `formatLastSynced(iso, now)` in `syncKinds.ts` so it is testable without clock mocking.

---

## 5. Phase slicing

**Two phases.** Each is independently shippable and independently revertable. Phase 1 changes no pixels. (Rev 1's Phase 3 is dropped — §5.3.)

### 5.1 Phase 1 — data (no UI change)

**Files:**

- `frontend/src/lib/offline/syncKinds.ts` (new) — `SyncKind`, type→kind map, `summariseSyncQueueItems(items, now)`, `formatLastSynced(iso, now)`. All pure.
- `frontend/src/lib/offline/syncKinds.test.ts` (new).
- `frontend/src/lib/offline/syncQueue.ts` — add `summariseSyncQueue()` (~8 lines around the pure fold); delete `getLiveSyncCount`, `getFailedSyncCount`, `getOldestPendingItemAge` once their last callers are gone (§4.2).
- `frontend/src/lib/useOfflineStatus.ts` — swap the helper triples for one summary call at `:62-80` and `:114-119`, **and the pair at `:144-147`** (`[SC-A3]`); add two state fields; read `lastSyncedAt` in the poll (`[SC-B2]`); split the write condition at `:128` (`[SC-A4]`); extend the return at `:214-223`.
- `frontend/src/lib/offlineDb.ts` — re-export `summariseSyncQueue`; drop the three deleted re-exports at `:114-116`.
- `frontend/src/lib/auth.tsx` — one `removeLocalStorageItem` line in `clearOfflineDataSafely` (`:122-139`).
- `frontend/src/lib/useOfflineStatus.test.tsx`, `frontend/src/lib/offline/syncQueue.test.ts` — repoint the mocks and assertions listed in §7.

**User-visible change:** none. **Shell touch:** none.
**Ships alone.** Prove it with unit tests plus one manual check that the chip still shows the same states.

### 5.2 Phase 2 — the Sync Centre sheet (the shell touch)

**Files:**

- `frontend/src/shell/components/SyncPanel.tsx` (new, **hard cap < 120 lines** — `[SC-A9a]`).
- `frontend/src/shell/components/SyncChip.tsx` — the chip becomes a button in **all** states, opening the panel; the existing `failed`-only button branch (`:84-96`) collapses into the single button. Labels/aria/tone (`:18-53`) are unchanged. The panel is **`lazy()`-imported and rendered only while open**, inside `<Suspense fallback={null}>` (`[SC-A7]`) — a static import would pull `BottomSheet` → framer-motion (`BottomSheet.tsx:26-33`) into the chunk both shell headers load on first paint, and `/m` does not carry framer-motion today (§1.7).
- `frontend/src/shell/test/SyncChip.test.tsx` — extend (mock at `:52`, `[SC-A1]`).
- `frontend/src/shell/test/SyncPanel.test.tsx` (new).

**Zero changes to `ShellScreen.tsx`.** The chip is already at `:191` and `:241`; it already carries `.shell-tap48` in its button branch (`SyncChip.tsx:90`) and now always will. No new node in the header, no new row, no geometry change, `touchTargets.test.ts` whitelist (`:31`) untouched.

**Ships alone** on top of Phase 1.

### 5.3 Dropped — Phase 3 (pill suppression on shell routes) `[SC-B3]`

Rev 1's Phase 3 hid `OfflineIndicator`'s pills on `/m` and `/p`. **It is dropped from v1**, and not because it looked risky — because it is wrong as designed.

**Why.** `SyncConflictModal` (`OfflineIndicator.tsx:152-162`) has exactly one opener in the entire app: the conflict pill at `:79-90`. The panel has no conflict row; the chip has no conflict state (`syncChipState.ts:7`). Hiding the pills and keeping the modal leaves a user with an unresolved lot conflict — one they dismissed, or one that predates the panel — with **no route back to the resolve UI on either shell**. A mispositioned pill is a cosmetic wrong; an unreachable conflict is a data wrong on the product's quality-evidence spine.

**Preconditions for any future Phase 3** (both required, neither is v1):

1. **A conflict row in the panel** that opens `SyncConflictModal` — i.e. the panel becomes the re-entry before the pill stops being one. That means `conflictCount` in the panel and a mount of the modal that the chip's instance owns.
2. **A literal pathname test** `[SC-A6]`. Rev 1 said `DeferredOfflineIndicator` would compute suppression "from `location.pathname` against the shell prefixes in `shellFlag.ts`" — **there are no such prefixes**. `shellFlag.ts` exports no pathname constant; `getActiveShellHomePath` (`:156-167`) decides from user + viewport and returns `'/m' | '/p' | null` without ever seeing a pathname. Any future implementation writes its own literal check and pins it with a test that asserts on literal paths (`/m`, `/m/lots/x`, `/p`, `/portal`, `/dashboard`), so a route rename cannot silently un-suppress or over-suppress.

Until then the pill stays on the shells: duplicative, mispositioned over `.shell-cambar`, and **the only way to resolve a conflict**. See §12.

---

## 6. UI spec — the Sync Centre panel

### 6.1 Entry point

The `SyncChip` already in the shell header (`ShellScreen.tsx:191` home, `:241` inner). Unchanged visually: dot + label, five states, existing tone classes (`SyncChip.tsx:48-53`). The only change is that it is now a `<button>` in every state rather than only in `failed` (`:84-96`).

The comment at `SyncChip.tsx:80-83` currently justifies the status-only behaviour ("no false button affordance"). **Replace it** — the affordance is now true in every state, because there is always something behind it. Do not leave a comment that contradicts the code.

### 6.2 Container

`BottomSheet` (`frontend/src/components/foreman/sheets/BottomSheet.tsx`), title **"Sync"**. Not `ResponsiveSheet` — the shells are mobile-only, so the desktop-modal branch (`ResponsiveSheet.tsx:56`) is dead weight here. `BottomSheet` already carries `role="dialog" aria-modal` (`:192-193`) and must be the only dialog node (`ResponsiveSheet.tsx:56-58`); do not wrap it.

Imported with `lazy()` and rendered only while open (`[SC-A7]`, §5.2).

### 6.3 Contents, top to bottom

**A. Status line** — one line, the state name at full contrast, mirroring `syncChipLabel` (`SyncChip.tsx:18-31`) so panel and chip can never disagree.

> Four states reach this line, not five `[SC-B1]`: `saved`, `waiting`, `failed`, `offline`. **`syncing` is unreachable here** — `deriveSyncState` returns it only when `isSyncing` is true (`syncChipState.ts:15`), and the chip's own hook instance never sets it (`useOfflineStatus.ts:33,84,86`). Stated so no one spends an afternoon hunting for the code path that shows "Syncing…" in the panel. Do **not** "fix" it by enabling the worker here (§2.2).

**B. Last synced** — muted, one line:

- `lastSyncedAt` present, today → `Last synced 10:42`
- `lastSyncedAt` present, earlier → `Last synced Sat 26 Jul, 16:08`
- `lastSyncedAt` null → `Not synced on this device yet`

**C. Kind rows — one row per kind, plus one failure summary line** `[SC-A9b]`

One row per kind with a non-zero **total** (live + failed), in the fixed §4.1 order. Rendered only when the total is non-zero.

Per Jay's hard card rules: **uniform, no subtitles**. Anatomy per row:

| Slot    | Content                                                                  |
| ------- | ------------------------------------------------------------------------ |
| Icon    | 44px `.shell-hub-ico` box (`index.css:493-503`), lucide icon per kind    |
| Label   | `3 photos` — count and noun, one line, no second line                    |
| Chip    | `Waiting` — `.shell-chip` (`index.css:354`), the chip's own vocabulary   |
| Chevron | **None** — see §6.4                                                      |

Below the rows, when `failedSyncCount > 0`, **one** summary line: `1 failed — tap Retry`. That single line carries the whole failure story; Rev 1's two-rows-per-kind split (`3 photos / Waiting` **and** `1 photo / Failed`) doubles the tallest state of the panel to answer a question — _which kind failed_ — that no available action is scoped to, since `retryFailedSyncs` revives **every** dead-lettered row (`syncQueue.ts:42-54`). Kind-level failure detail becomes worth building the day a per-kind retry exists.

**Chip class `[SC-A5]`:** `.shell-chip` (`index.css:354`, "Role/status chip — monochrome"), **not** `.shell-count-chip` (`:364`, the amber number chip `HubTile` uses at `HubTile.tsx:42`). The row's chip holds a status word; its count is already in the label.

**Row implementation `[SC-A5]`: write a local row in `SyncPanel.tsx`.** `HubTile` cannot express this and must not be made to: it is a `<button>` (`HubTile.tsx:33`), `onPress` is required (`:22`, `:29`), and the chevron is unconditional (`:48-52`). Adding an `onPress?`/`chevron?` prop pair would put a non-navigating variant into the shared uniform card that six screens depend on, to save ten lines in one panel. Use the `.shell-hub` visual (`index.css:471-486`) on a non-interactive element and keep `HubTile.tsx` at a zero-line diff.

**D. Action — at most one button, full-width, in the sheet footer** `[SC-B1]`

- `failedSyncCount > 0` → **"Retry failed"** → `retryFailedSyncs()` (`useOfflineStatus.ts:141`)
- otherwise → **no button**.

That is the complete action set. Rev 1's "Sync now" → `syncPendingChanges()` is **cut**: in the chip's hook instance that call returns immediately (`:84`, `enableSyncWorker` false at `:33`) and would render a button that does nothing on the one surface whose entire job is trustworthiness. "Retry failed" is unaffected because it does not flush — it writes `attempts: 0` to Dexie (`syncQueue.ts:49-51`) and the root instance's poll picks the work up within 5 s (§1.3), which is exactly what the shipped chip already does.

No `disabled={isSyncing}` on the button: `isSyncing` is structurally false in this instance (§6.3-A), so the prop would be decoration. `retryFailedSyncs` is idempotent — a double-tap re-writes `attempts: 0` on rows that already have it.

**E. Offline footnote** — when `!isOnline`, one muted line: _"You're offline. Everything here is saved on this phone and will upload when you're back on signal."_ This is the reassurance the panel exists for.

**F. Stuck warning** — when the existing predicate holds (`OfflineIndicator.tsx:59-63`, threshold `useOfflineStatus.ts:16`), one warning line reusing the existing copy from `OfflineIndicator.tsx:125` verbatim. Same words in both places or neither. The predicate is recomputed in the panel from `isOnline`, `pendingSyncCount` and `oldestPendingItemAge` — all three are already on the hook's return (`:214-223`), and `oldestPendingItemAge` counts dead-lettered rows (§4.2, `[SC-B4]`).

### 6.4 Why no chevron

Jay's card rule is icon + label + chip + chevron. A chevron promises navigation. **There is no destination** — no screen filters to "pending photos" (`PhotosListScreen.tsx` lists all photos, not queued ones), and no route exists for any other kind's queue. A chevron that opens nothing is a broken promise on the one surface whose entire job is trustworthiness.

The rows are therefore non-interactive status rows using the uniform card _visual_ minus the chevron. **This is a deliberate, single-surface exception and it is Open Decision D3 for Jay** (§9). If Jay wants the chevron, the honest version is a destination per kind, which is a bigger build and not v1 (§12).

### 6.5 Accessibility

- Chip: `<button>` with the existing `aria-label` per state (`SyncChip.tsx:33-46`), plus `aria-haspopup="dialog"` and `aria-expanded`.
- Panel: `BottomSheet`'s own `role="dialog" aria-modal` (`BottomSheet.tsx:192-193`) `[SC-A1]`; do not add a second dialog role.
- The status line carries `role="status"` so a state change while the panel is open is announced — that role moves from the chip's span (`SyncChip.tsx:99`) into the panel, since the chip is now a button.
- Escape (`BottomSheet.tsx:66-73`) and backdrop-tap (`:191`) close are inherited; the sticky-header X (`:265-274`) means drag is never the only exit.
- No `min-h-[<48px]` anywhere in the new files — the scan at `touchTargets.test.ts:50-65` enforces this and its `NON_INTERACTIVE` whitelist (`:31`) must not be extended `[SC-A1]`.

---

## 7. Acceptance tests

Runnable checks left behind, per phase. Commands from `frontend/`.

### Phase 1 — `frontend/src/lib/offline/syncKinds.test.ts` (new)

1. Every one of the eleven types in `core.ts:120-131` maps to a `SyncKind`. **Assert against the union exhaustively** so a twelfth type added later fails this test rather than silently vanishing from the panel.
2. `summariseSyncQueueItems` splits live vs failed at `MAX_SYNC_ATTEMPTS` (`syncQueue.ts:12`) — boundary cases `attempts = 4` (live) and `attempts = 5` (failed).
3. `byKind` totals equal `live + failed` when all types are known.
4. An unknown type is counted in totals and absent from `byKind` — a kind row can never exceed the total.
5. `oldestPendingAgeMs` is `null` on an empty queue and matches the oldest `createdAt` otherwise (fixed `now`, no wall clock).
   **5a. `[SC-B4]`** — a queue whose rows are **all dead-lettered** (`attempts >= MAX_SYNC_ATTEMPTS`) still returns a non-null age equal to the oldest row's, and a mixed queue whose oldest row is dead-lettered reports **that** row's age. This is the behaviour-preservation test for `isStuck` (`OfflineIndicator.tsx:59-63`); without it the consolidation can silently switch the stuck warning off.
6. `formatLastSynced` — same-day returns time only; prior-day includes the date; `null` returns the "not synced yet" string. Fixed `now`, TZ-stable.

Plus in `frontend/src/lib/useOfflineStatus.test.tsx` (exists):

7. `lastSyncedAt` is written after a flush that synced ≥ 1 item.
8. `lastSyncedAt` is **not** written by a pass that synced 0 items.
9. `lastSyncedAt` is written when **no `onSyncComplete` callback is supplied** `[SC-A4]` — the guard is `syncedCount`, not the callback.
10. **`[SC-B2]`** — a value written to `civos.sync.lastSyncedAt` by another instance (i.e. written directly to localStorage, with no flush in this hook) is exposed by the hook **within one 5 s poll**. This is the cross-instance test; without it the panel can ship reading "Not synced on this device yet" forever.
11. `lastSyncedAt` reads back as `null` when localStorage throws (the helper swallows it — `storagePreferences.ts:14-18`).

**Test churn this phase forces** (§0.3 item 1) — not optional, and worth budgeting: `useOfflineStatus.test.tsx` mocks the three deleted helpers by name (`:59-61`, `:124-126`, `:164-166`, `:248-251`, `:1165`, `:1187`) and must be repointed at `summariseSyncQueue`; `syncQueue.test.ts:76,87,166-190` tests them directly and those assertions move to `summariseSyncQueueItems` (items 2, 5, 5a above).

### Phase 2 — `frontend/src/shell/test/SyncPanel.test.tsx` (new) + extend `SyncChip.test.tsx`

12. Tapping the chip opens the panel in **each of the four reachable states** — `saved`, `waiting`, `failed`, `offline` (`syncChipState.ts:7`) — including `saved`, the state that was previously not a button. `syncing` is not asserted: it is unreachable from this instance (§6.3-A, `[SC-B1]`).
13. `pendingByKind: { photos: 3 }` renders exactly **one** row reading "3 photos"; singular/plural correct at 1 and 2.
14. A kind with both live and dead-lettered items still renders **one** row for that kind `[SC-A9b]`, and `failedSyncCount > 0` renders the single failure summary line.
15. `lastSyncedAt` renders per the three §6.3-B cases.
16. `failedSyncCount > 0` → "Retry failed" is present and calls `retryFailedSyncs`; **every other state renders no button** — in particular `pendingSyncCount > 0 && isOnline` renders **no** button (the "Sync now" that Rev 1 specified must not come back, `[SC-B1]`).
17. Panel status line text equals the chip label for the same inputs, across the four reachable states (guards against the two drifting).
18. `frontend/src/shell/test/touchTargets.test.ts` passes with its `NON_INTERACTIVE` whitelist (`:31`) **unchanged** — this is the shell-freeze guard `[SC-A1]`.
19. `frontend/src/shell/test/ShellScreen.test.tsx` passes **with no edits** — proof that no chrome changed.

Mock `useOfflineStatus` the way `SyncChip.test.tsx:52` already does `[SC-A1]`, so no IndexedDB is needed.

### Full-suite gates (both phases)

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

1. Phases 1 and 2 are merged. (There is no Phase 3 — §5.3.)
2. Every test in §7 passes; `type-check` clean both ends.
3. `touchTargets.test.ts` whitelist (`:31`) unchanged and `ShellScreen.test.tsx` unedited — the shell-freeze proof.
4. `git diff --stat origin/master` shows **zero lines changed** in `frontend/src/shell/components/ShellScreen.tsx`, `frontend/src/shell/components/HubTile.tsx` (`[SC-A5]`) and `frontend/src/components/OfflineIndicator.tsx` (`[SC-B3]`).
5. `fallow:audit` verdict recorded in the PR body; no new dead exports; and the **three** helpers orphaned by §4.2 — `getLiveSyncCount`, `getFailedSyncCount`, `getOldestPendingItemAge`, plus their `offlineDb.ts:114-116` re-exports — are **deleted**, not left behind. `getPendingSyncCount` is **not** one of them (five live callers, §4.2).
6. **Jay's device check** on a real phone — **mandatory, and it is the only check that catches `[SC-B1]` or `[SC-B2]`**: aeroplane mode, capture 3 photos and a docket, open the panel, confirm it reads "3 photos / 1 docket", reconnect, confirm the counts drain **and "Last synced" updates to the real time**. Both blockers this revision fixes were cross-instance faults that every unit test in §7 would have passed around. Nothing here is "done" until this has actually been run.
7. No new dependency in `frontend/package.json`.

---

## 9. Open decisions for Jay

**D1 — Placement: chip-opens-panel, or a new element in the shell chrome?**
**Recommendation: chip opens the panel.** The chip is already in both headers (`ShellScreen.tsx:191,241`) with its own hit area — this spends zero of the shell-touch grant on new chrome, and `ShellScreen.tsx` ends up with a zero-line diff.

**D2 — Both shells, or foreman only?**
**Recommendation: both `/m` and `/p`.** They render the same `ShellScreen.tsx`; excluding the subbie shell requires _adding_ a conditional, and subbie foremen fill dockets in the same dead spots.

**D3 — Kind rows: chevron (your card rule) or no chevron?**
**Recommendation: no chevron.** No screen exists that filters to a kind's pending items, so a chevron would promise navigation that goes nowhere — the one lie this panel cannot afford. Say the word and per-kind destinations become a follow-up (§12).

**D4 — Does the panel replace the floating pill on the shells?** — **ANSWERED IN THIS REVISION: no** `[SC-B3]`.
Not a judgement call any more: the pill's conflict branch (`OfflineIndicator.tsx:79-90`) is the only opener of `SyncConflictModal` (`:152-162`), so suppressing the pills on `/m` and `/p` would strand any user with an unresolved lot conflict. The pill stays, duplicative and mispositioned, until a future slice gives the panel a conflict row (§5.3, §12). Jay can still say "do it anyway" — but it costs a conflict row first, not a boolean prop.

**D5 — Office desktop in v1?**
**Recommendation: no.** Office queues are permanently empty and office already has the pill plus the sign-out data-loss guard; adding a third surface there is build without a user.

**D6 — "Sync now": accept its removal from v1?** `[SC-B1]`
**Recommendation: yes, accept.** Your sketch was _"3 photos pending, last synced 10:42, 1 failed — retry"_ — the retry is in, and the panel delivers the sketch exactly. A working manual "Sync now" needs the flush lifecycle to be shared across hook instances (a store or a context), which is a subsystem change dressed as a button. Field reality also argues against it: the queue already flushes on reconnect, on mount, on foreground and every 60 s while pending (§1.3), so the button's honest label most of the time would be "do the thing that is already happening". Named as a future slice (§12) if you want it after using the panel.

---

## 10. Anti-over-build clause

This spec is deliberately smaller than the problem space, and Rev 2 is smaller than Rev 1. That is the point.

The temptations, named so they can be refused in review: a `SyncProvider` context or a store to make "Sync now" work (`[SC-B1]`, §12); a zustand slice for two scalars; a Dexie v7 migration for one timestamp; a `storage`-event listener where a poll that already runs will do (`[SC-B2]`); per-item queue inspection; two rows per kind (`[SC-A9b]`); a `chevron?` prop on `HubTile` (`[SC-A5]`); unified "offline readiness" including map tiles; a `<SyncStatus>` component to replace all four surfaces at once; Background Sync; and cleaning up the unrelated count paths §1.2 now names (`[SC-A2]`).

Each is defensible in isolation. Together they are a rewrite of a subsystem that **already works** — `useOfflineStatus` has flush-on-mount, flush-on-visibility, flush-on-reconnect, a 60 s foreground interval, dead-lettering that never deletes user data, and conflict detection (§1.3). v1's job is to _show_ what that engine already knows, in one place, on the shells where it matters.

If a reviewer cannot point at a line in §2.1, the change does not belong in v1.

---

## 11. Estimated shape

| Phase | New files                     | Edited files                                                                          | Rough net lines (product code) |
| ----- | ----------------------------- | -------------------------------------------------------------------------------------- | ------------------------------ |
| 1     | 1 (`syncKinds.ts`)            | 4 (`syncQueue.ts`, `useOfflineStatus.ts`, `offlineDb.ts`, `auth.tsx`)                  | +110 / −45                     |
| 2     | 1 (`SyncPanel.tsx`)           | 1 (`SyncChip.tsx`)                                                                     | **+120 / −15**                 |

**Test files are not budgeted** (`[SC-A9a]`) — `syncKinds.test.ts`, `SyncPanel.test.tsx`, and the edits to `useOfflineStatus.test.tsx` / `syncQueue.test.ts` / `SyncChip.test.tsx` are listed in §5 and §7 and are expected to be substantial; a line budget that lumps them in is how a cap gets quietly broken. Phase 1's `−45` is larger than Rev 1's `−25` because three helpers are deleted, not one (§4.2). Phase 2's `+120` **is** the §5.2 cap: `SyncPanel.tsx` < 120 lines, with `SyncChip.tsx` roughly net-zero (the `failed`-only branch collapses into one button plus the lazy-import wrapper). Rev 1's `+200` was 80 lines above its own cap.

If a phase comes in materially above this, something out of §2.1 got in.

---

## 12. Named future slices (not v1)

Recorded so they are refused as scope creep here and found again when they are actually wanted. None is scheduled.

1. **Shared sync trigger — a working "Sync now"** `[SC-B1]`, `[D6]`. Requires the flush lifecycle to be shared across hook instances (a store or context around `useOfflineStatus`, or hoisting the worker out of `OfflineIndicator`), so that a second surface can start a flush and observe `isSyncing`. Precondition for any UI that shows "Syncing…" outside the app-root instance. Do not approximate it with `enableSyncWorker: true` in a second component (§2.2).
2. **Pill suppression on `/m` and `/p`** (Rev 1's Phase 3) `[SC-B3]`, `[SC-A6]`. Preconditions in §5.3: a conflict row in the panel that opens `SyncConflictModal`, and a literal-pathname test. Cosmetic payoff, so it goes behind anything with a user-visible payoff.
3. **Per-kind destinations and a per-kind retry** `[D3]`, `[SC-A9b,d]`. A screen that filters to one kind's pending items would make the chevron honest and make kind-level failure rows worth rendering. That is a build, not a panel tweak.
4. **A shell sign-out data-loss guard.** Office has one (`UserMenu.tsx:56,264`, reading `getUnsyncedWorkCount()`); neither shell does (§1.4). Unrelated to this panel, but this survey is where it was found.
