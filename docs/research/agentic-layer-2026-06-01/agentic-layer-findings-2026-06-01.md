# AI Daily Diary — Findings & Design Notes (for the AI dev)

Last updated: 2026-06-01
Baseline: master around PR #320.

## What this is
A **findings + design** doc for the planned AI capture feature on the **daily diary**
(foreman drops notes through the day → AI compiles/classifies them into the diary →
human reviews & signs). It documents **how the diary actually works today** in the
codebase and **what that means for the AI design**, so we build *on top of* the
existing data flows instead of duplicating or fighting them.

**This is not a build ticket yet.** The engineering-health work in
`docs/engineering-health-roadmap.md` comes first; the broader research/rationale is in
`docs/ai-layer-research.md`. Build the AI feature only after the health work lands.

> ⚠️ **Line numbers will drift.** Several files referenced here (`dockets.ts`,
> `diary/*`, `DailyDiaryPage.tsx`) are active refactor targets. Treat file:line refs as
> "as of this review" — confirm against current code before relying on them.

---

## PART 1 — How the daily diary works today

### 1.1 The diary is a structured hub, not a flat form
`backend/prisma/schema.prisma:805–975`. The `DailyDiary` model is keyed **one per
project per date** (`@@unique([projectId, date])`) and owns child tables:

- `DiaryPersonnel` — workers (name, company, role, start/finish, hours, `lotId`, **`source`**, **`docketId`**)
- `DiaryPlant` — equipment (description, idRego, company, hoursOperated, `lotId`, **`source`**, **`docketId`**)
- `DiaryActivity` — work done (description, quantity, unit, notes, `lotId`)
- `DiaryDelay` — disruptions (delayType, times, durationHours, description, impact, `lotId`)
- `DiaryDelivery` — materials (description, supplier, docketNumber, quantity, unit, `lotId`)
- `DiaryEvent` — site events (eventType, description, notes, `lotId`)
- `DiaryVisitor` — visitors (name, company, purpose, timeInOut)
- `DiaryAddendum` — post-submission notes (content, addedById, addedAt)

Diary-level fields: `status` (draft/submitted), `submittedBy/At`, `lockedAt`, `isLate`,
weather fields (`weatherConditions`, `temperatureMin/Max`, `rainfallMm`, `weatherNotes`),
`generalNotes`.

**Key takeaway:** most diary content lives in typed child rows, several of which carry a
`source` field ("manual" vs "docket") and an optional `lotId`. The AI must write into
these typed tables correctly, not into one free-text blob.

### 1.2 Docket → diary auto-population (the central flow)
`backend/src/routes/dockets.ts` (approx. `:1177–1257`, in the docket-approve handler).

When a docket is **approved**, the backend, in a transaction:
1. Finds or creates the `DailyDiary` for `(projectId, date)`.
2. For each docket **labour** entry → inserts a `DiaryPersonnel` row with
   `source:"docket"`, `docketId`, and the first lot allocation's `lotId`.
3. For each docket **plant** entry → inserts a `DiaryPlant` row with `source:"docket"`,
   `docketId`, `lotId`.

So **labour and plant flow into the diary automatically from approved dockets.**

### 1.3 Subcontractor portal → docket → diary
Frontend: `frontend/src/pages/subcontractor-portal/DocketEditPage.tsx`,
`DocketsListPage.tsx`.

Flow: subbie adds **labour** (employee, start/finish, lot allocation, rate) and **plant**
(equipment, hours, wet/dry rate) to a docket → submits (`POST /api/dockets/:id/submit`)
→ foreman reviews in `frontend/src/pages/dockets/DocketApprovalsPage.tsx` →
approves → §1.2 fires and the labour/plant land in the diary.

Docket status flow: `draft → pending_approval → approved | rejected | queried`.
Only **approved** dockets feed the diary.

### 1.4 Weather is auto-fetched
`backend/src/routes/diary/diaryReporting.ts:88–220`. `GET /api/diary/:projectId/weather/:date`
pulls conditions/temps/rainfall from the **Open-Meteo API** using the project's
lat/long (falls back to state-based coordinates). Foreman can still edit/override.

### 1.5 There is already voice input
`WeatherTab.tsx` already uses a `VoiceInputButton` on **General Notes** and **Weather
Notes** (free-text narrative fields). So there is an existing voice foothold to build on
— check that component before adding new voice plumbing.

### 1.6 Frontend assembly
- Page: `frontend/src/pages/diary/DailyDiaryPage.tsx`; tabs: Weather, Personnel, Plant,
  Activities, Delays (`*Tab.tsx` in `pages/diary/components/`).
- Data hook: `frontend/src/pages/diary/hooks/useDiaryData.ts`.
- Mobile view shows an approved-docket **summary card**
  (`DiaryDocketSummary.tsx`) alongside manual entries; desktop currently shows manual
  entries. There is also `GET /api/diary/project/:projectId/docket-summary/:date`
  aggregating approved dockets, and a `GET /api/diary/:diaryId/timeline` that merges
  entries (and filters personnel/plant to `source === "manual"`).

### 1.7 Endpoints (for the agent's "tools")
- `GET /api/diary/:projectId` — diaries for a project
- `GET /api/diary/:projectId/:date?missing=null` — diary for a date (or null)
- `GET /api/diary/:projectId/weather/:date` — weather autofetch
- `GET /api/diary/project/:projectId/docket-summary/:date` — approved/pending dockets for date
- `GET /api/diary/:diaryId/timeline` — merged timeline
- `POST /api/diary` — create/update diary (weather + notes)
- `POST /api/diary/:id/personnel` — add personnel `{name, company?, role?, startTime?, finishTime?, hours?}`
- `POST /api/diary/:id/plant` — add plant `{description, idRego?, company?, hoursOperated?, notes?}`
- `POST /api/diary/:id/activities` — add activity `{description, lotId?, quantity?, unit?, notes?}`
- `POST /api/diary/:id/delays` — add delay `{delayType, startTime?, endTime?, durationHours?, description, impact?}`
- `POST /api/diary/:id/submit` — submit/lock `{acknowledgeWarnings: true}`

(Deliveries/events/visitors have equivalent POST routes — confirm exact paths in
`diary/diaryItems.ts`.)

---

## PART 2 — Data-flow map: what's automatic vs manual

| Diary section | Source today | AI capture role |
|---|---|---|
| **Personnel (labour)** | Auto from approved **dockets** (`source:"docket"`) **+ manual** rows (`source:"manual"`) | ⚠️ **Supplement, with dedup** — see Part 3 |
| **Plant & equipment** | Auto from approved **dockets** + manual | ⚠️ Same as labour |
| **Weather / temp / rainfall** | Auto from **Open-Meteo** API | ❌ Don't re-capture (already automatic) |
| **Activities** (work done) | Manual free-text | ✅ Primary AI target |
| **Delays / disruptions** | Manual free-text | ✅ Primary AI target |
| **Deliveries** | Manual | ✅ AI target |
| **Events** | Manual | ✅ AI target |
| **Visitors** | Manual | ✅ AI target |
| **General / weather notes** | Manual (already has voice button) | ✅ Enhance existing voice |

---

## PART 3 — IMPORTANT: not all on-site workers are in the subbie portal

This is a domain reality that materially changes the labour design:

- The docket → diary flow (§1.2) only covers workers whose **subcontractor uses the
  portal and submits a docket that gets approved.**
- **Many workers won't be there:** the contractor's own **direct employees**, **day/casual
  labour**, and **subbies not (yet) on the portal**. The `DiaryPersonnel.source = "manual"`
  path exists precisely for these.

**Design consequences:**
1. **Labour capture is NOT off-limits for the AI** — it's the way to record the workers
   dockets *don't* cover. Earlier I said "leave labour alone"; that's wrong given this.
   The correct rule is: **AI may add `source:"manual"` (or a new `source:"ai"`) personnel,
   but must reconcile against docket-sourced rows to avoid double-counting.**
2. **Dedup/awareness is required.** Before adding a worker the foreman mentions, the agent
   should check existing `DiaryPersonnel` for that date (both docket- and manual-sourced)
   and only add genuinely new people — or surface a "dockets already cover X; you also
   mentioned Y — add Y?" confirmation.
3. **Use docket data as context, not competition.** e.g. the agent can say *"Approved
   dockets show 6 workers on Lot 7. You mentioned two of our own lads on the kerb — add
   those 2 as manual personnel?"*
4. **Consider tagging AI-added labour distinctly** (`source:"ai"` or `source:"manual"` +
   an `aiAssisted` flag) so the audit trail shows provenance and reporting can separate
   docket-verified labour from foreman/AI-recalled labour.

---

## PART 4 — AI feature design implications

1. **Identifiers from context, narrative from voice.** (Proven in the prototype: voice
   mangled "lot 7" and the AI correctly refused to guess it.) The foreman should pick/be
   in **project + date** (and optionally lot) so the agent *knows* the identifiers. Never
   rely on voice transcription for lot/project/ITP IDs — they're critical and easy to
   mishear.
2. **Capture-and-classify is the core job.** The agent's real value is taking free-form
   notes through the day and routing each into the **correct typed table**:
   - "knocked off the north kerb" → `DiaryActivity`
   - "concrete truck an hour late" → `DiaryDelay`
   - "two loads of road base from Boral ~10am" → `DiaryDelivery`
   - "council inspector came by" → `DiaryVisitor`
   - "our two lads on the kerb" → `DiaryPersonnel (source: manual/ai)` (per Part 3)
   - general colour/summary → `generalNotes`
3. **Don't re-capture weather/temp** — read the autofetched values; only let AI add
   `weatherNotes` colour if the foreman comments on conditions.
4. **Stay conservative.** Extract only what's stated; keep vague-but-stated facts ("a
   couple of lads", "lost about an hour") but never invent numbers, names, quantities, or
   a lot it wasn't told. Leave unknowns blank.
5. **Reconcile across the day's notes** (merge related notes, honour later corrections —
   "scrap that, 6 not 5"). The prototype showed this works well.
6. **Human reviews & signs.** The compiled diary is a draft; the foreman edits and submits
   via the existing `POST /api/diary/:id/submit`. The diary locks on submit
   (`lockedAt`); post-submission changes go through `DiaryAddendum`, so the AI must
   respect lock state.

---

## PART 5 — Open questions to resolve before building

1. **Possible double-count of docket labour.** §1.2 (backend) **writes** `DiaryPersonnel`
   rows on docket approval, while the frontend also shows an approved-docket **summary**
   (`DiaryDocketSummary` + `docket-summary` endpoint). Confirm whether these represent the
   same dockets twice (written rows *and* a summary view) and how the UI avoids
   double-counting. Understand this before AI adds yet another labour source.
2. **`source` enum.** Today it's "manual" | "docket". Decide whether AI-added rows get
   `source:"ai"` (cleaner provenance/audit) or reuse `source:"manual"` + a flag. This is a
   schema decision → must be a reviewed Prisma migration (never `db push`).
3. **Dedup key for personnel.** What makes two personnel rows "the same" (name + company +
   date?) so the agent can reconcile docket vs manual vs AI without dupes?
4. **Lock/submit interplay.** Can notes still be captured after the diary is submitted?
   Likely they must become `DiaryAddendum` entries — confirm desired behaviour.
5. **Which record first?** Diary is the agreed first surface. Within it, classification of
   Activities + Delays is the highest-value, lowest-risk slice to ship first.

---

## PART 6 — Hard rules carried from the research (`docs/ai-layer-research.md`)

1. The agent calls **existing authenticated diary/docket endpoints as the logged-in
   user** — never a superuser/service token. Permissions, role, and tenant isolation are
   enforced by those endpoints, not by the agent.
2. **Human confirmation on every write** (editable draft card, not yes/no). One-tap undo.
3. **Treat uploaded photos/docs as untrusted** (indirect prompt-injection surface) —
   isolate their content from any privileged action.
4. **Full AI-authorship audit trail** on every AI-touched record: the raw notes, the AI
   draft, the human edits, approver + role + timestamp, model + prompt version. (Aligns
   with ISO 9001 record control and "the human is the legal author".)
5. **Voice = push-to-talk + construction-jargon vocabulary + offline capture**; assume
   85–92% transcription accuracy → the editable draft is the safety net.
6. **Evals + a per-request step cap.** Measure consistency, not one good demo.
7. The AI is an **accelerator layered over the existing UI**, never the only path.

---

## File reference map (verify line numbers)

| Area | File |
|---|---|
| Diary schema + child models | `backend/prisma/schema.prisma:805–975` |
| Docket→diary auto-populate | `backend/src/routes/dockets.ts` (approve handler, ~1177–1257) |
| Diary create/update | `backend/src/routes/diary/diaryCore.ts` |
| Diary item CRUD (activities/delays/etc.) | `backend/src/routes/diary/diaryItems.ts` |
| Weather autofetch + docket summary + timeline | `backend/src/routes/diary/diaryReporting.ts` |
| Diary access control | `backend/src/routes/diary/diaryAccess.ts` |
| Diary page + tabs | `frontend/src/pages/diary/DailyDiaryPage.tsx`, `pages/diary/components/*Tab.tsx` |
| Diary data hook | `frontend/src/pages/diary/hooks/useDiaryData.ts` |
| Existing voice input | `frontend/src/pages/diary/components/WeatherTab.tsx` (`VoiceInputButton`) |
| Docket summary card | `frontend/src/pages/diary/components/DiaryDocketSummary.tsx` |
| Subbie portal docket entry | `frontend/src/pages/subcontractor-portal/DocketEditPage.tsx` |
| Foreman docket approvals | `frontend/src/pages/dockets/DocketApprovalsPage.tsx` |
| Diary types | `frontend/src/pages/diary/types.ts` |
