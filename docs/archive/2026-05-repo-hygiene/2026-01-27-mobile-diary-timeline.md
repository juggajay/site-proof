# Mobile Daily Diary Timeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the desktop multi-tab diary form with a mobile timeline feed where foremen capture site events (activities, delays, deliveries, events) throughout the day, while labour/plant auto-populates from approved subbie dockets.

**Architecture:** Mobile diary is a presentation layer (`DiaryMobileView`) rendered conditionally via `useIsMobile()` inside the existing `DailyDiaryPage`. Page owns all business logic; mobile view receives data + callbacks as props. Two new Prisma models (`DiaryDelivery`, `DiaryEvent`), new fields on existing models (`lotId`, `source`, `docketId`), and a docket→diary auto-population hook on approval. Timeline is a merged chronological view of all child records sorted by `createdAt`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand, Dexie.js (IndexedDB), Prisma ORM, PostgreSQL, Express, Zod validation.

---

## Reference Files

| Purpose | Path |
|---------|------|
| Prisma schema (diary models) | `backend/prisma/schema.prisma:572-691` |
| Prisma schema (docket models) | `backend/prisma/schema.prisma:794-885` |
| Prisma schema (Lot model) | `backend/prisma/schema.prisma:209-229` |
| Prisma schema (EmployeeRoster) | `backend/prisma/schema.prisma:757-772` |
| Prisma schema (PlantRegister) | `backend/prisma/schema.prisma:775-790` |
| Diary API routes | `backend/src/routes/diary.ts` |
| Docket API routes (approve endpoint) | `backend/src/routes/dockets.ts:517-650` |
| DailyDiaryPage (frontend) | `frontend/src/pages/diary/DailyDiaryPage.tsx` |
| DiaryFinishFlow (EOD submit) | `frontend/src/components/foreman/DiaryFinishFlow.tsx` |
| DocketApprovalsMobileView (pattern ref) | `frontend/src/components/foreman/DocketApprovalsMobileView.tsx` |
| SwipeableCard | `frontend/src/components/foreman/SwipeableCard.tsx` |
| MobileDataCard | `frontend/src/components/ui/MobileDataCard.tsx` |
| Foreman component exports | `frontend/src/components/foreman/index.ts` |
| usePullToRefresh hook | `frontend/src/hooks/usePullToRefresh.tsx` |
| useHaptics hook | `frontend/src/hooks/useHaptics.ts` |
| useMediaQuery (useIsMobile) | `frontend/src/hooks/useMediaQuery.ts` |
| Offline DB (Dexie) | `frontend/src/lib/offlineDb.ts` |
| Foreman Zustand store | `frontend/src/stores/foremanMobileStore.ts` |

---

## Task 1: Backend — New Prisma Models + Schema Changes (including createdAt on all diary children)

> **Note:** This task also adds `createdAt` to `DiaryPersonnel`, `DiaryPlant`, `DiaryDelay`, and `DiaryActivity` — all four lack it and the timeline endpoint needs it for sorting. This was originally a separate Task 4 but is merged here to avoid ordering issues.

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Add DiaryDelivery model**

Add after the `DiaryDelay` model (after line 678):

```prisma
model DiaryDelivery {
  id           String   @id @default(uuid())
  diaryId      String   @map("diary_id")
  description  String
  supplier     String?
  docketNumber String?  @map("docket_number")
  quantity     Decimal?
  unit         String?
  lotId        String?  @map("lot_id")
  notes        String?
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  diary DailyDiary @relation(fields: [diaryId], references: [id], onDelete: Cascade)
  lot   Lot?       @relation(fields: [lotId], references: [id])

  @@map("diary_deliveries")
}
```

**Step 2: Add DiaryEvent model**

Add after `DiaryDelivery`:

```prisma
model DiaryEvent {
  id          String   @id @default(uuid())
  diaryId     String   @map("diary_id")
  eventType   String   @map("event_type")
  description String
  notes       String?
  lotId       String?  @map("lot_id")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  diary DailyDiary @relation(fields: [diaryId], references: [id], onDelete: Cascade)
  lot   Lot?       @relation(fields: [lotId], references: [id])

  @@map("diary_events")
}
```

**Step 3: Add lotId to DiaryDelay**

Modify `DiaryDelay` model — add fields:

```prisma
  lotId       String?  @map("lot_id")
  // ... existing fields ...
  lot   Lot?       @relation(fields: [lotId], references: [id])
```

**Step 4: Add lotId to DiaryPlant**

Modify `DiaryPlant` model — add fields:

```prisma
  lotId       String?  @map("lot_id")
  // ... existing fields ...
  lot   Lot?       @relation(fields: [lotId], references: [id])
```

**Step 5: Add lotId, source, docketId, createdAt to DiaryPersonnel**

Modify `DiaryPersonnel` model — add fields:

```prisma
  lotId     String?  @map("lot_id")
  source    String   @default("manual")  // 'manual' | 'docket'
  docketId  String?  @map("docket_id")
  createdAt DateTime @default(now()) @map("created_at")
  // ... existing fields ...
  lot     Lot?         @relation(fields: [lotId], references: [id])
  docket  DailyDocket? @relation(fields: [docketId], references: [id])
```

**Step 6: Add source, docketId, createdAt to DiaryPlant**

Also add to `DiaryPlant`:

```prisma
  source    String   @default("manual")  // 'manual' | 'docket'
  docketId  String?  @map("docket_id")
  createdAt DateTime @default(now()) @map("created_at")
  // ... existing fields ...
  docket  DailyDocket? @relation(fields: [docketId], references: [id])
```

**Step 6b: Add createdAt to DiaryDelay**

```prisma
  createdAt DateTime @default(now()) @map("created_at")
```

**Step 6c: Add createdAt to DiaryActivity**

```prisma
  createdAt DateTime @default(now()) @map("created_at")
```

**Step 7: Update DailyDiary model relations**

Add to the `DailyDiary` model's relation list:

```prisma
  deliveries DiaryDelivery[]
  events     DiaryEvent[]
```

**Step 8: Update Lot model relations**

Add to the `Lot` model's relation list (it already has `diaryActivities`):

```prisma
  diaryDeliveries DiaryDelivery[]
  diaryEvents     DiaryEvent[]
  diaryDelays     DiaryDelay[]
  diaryPlant      DiaryPlant[]
  diaryPersonnel  DiaryPersonnel[]
```

**Step 9: Update DailyDocket model relations**

Add to `DailyDocket` model:

```prisma
  diaryPersonnel DiaryPersonnel[]
  diaryPlant     DiaryPlant[]
```

**Step 10: Run migration**

```bash
cd backend && npx prisma migrate dev --name add-diary-delivery-event-lot-source-createdat
```

**Step 11: Verify migration**

```bash
cd backend && npx prisma generate
```

Expected: No errors. New tables `diary_deliveries` and `diary_events` created. Existing tables updated with new columns (`lotId`, `source`, `docketId`, `createdAt`).

**Step 12: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: Add DiaryDelivery, DiaryEvent models, lotId/source/createdAt fields for mobile diary timeline"
```

---

## Task 2: Backend — New API Endpoints (Deliveries + Events)

**Files:**
- Modify: `backend/src/routes/diary.ts`

**Step 1: Add Zod schemas for new types**

Add after the existing `addVisitorSchema` (around line 63):

```typescript
const addDeliverySchema = z.object({
  description: z.string().min(1),
  supplier: z.string().optional(),
  docketNumber: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  lotId: z.string().optional(),
  notes: z.string().optional(),
})

const addEventSchema = z.object({
  eventType: z.enum(['visitor', 'safety', 'instruction', 'variation', 'other']),
  description: z.string().min(1),
  notes: z.string().optional(),
  lotId: z.string().optional(),
})
```

**Step 2: Add delivery CRUD endpoints**

Add POST and DELETE for deliveries, following the exact same pattern as the existing `addActivity` / `removeActivity` endpoints:

```typescript
// POST /api/diary/:diaryId/deliveries - Add delivery
router.post('/:diaryId/deliveries', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { diaryId } = req.params
    const data = addDeliverySchema.parse(req.body)

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) return res.status(404).json({ error: 'Diary not found' })
    if (diary.status === 'submitted') return res.status(400).json({ error: 'Cannot modify submitted diary' })

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    const delivery = await prisma.diaryDelivery.create({
      data: {
        diaryId,
        description: data.description,
        supplier: data.supplier,
        docketNumber: data.docketNumber,
        quantity: data.quantity,
        unit: data.unit,
        lotId: data.lotId,
        notes: data.notes,
      },
      include: { lot: { select: { id: true, lotNumber: true } } },
    })

    res.status(201).json(delivery)
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: error.errors })
    console.error('Add delivery error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/diary/:diaryId/deliveries/:deliveryId
router.delete('/:diaryId/deliveries/:deliveryId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { diaryId, deliveryId } = req.params

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) return res.status(404).json({ error: 'Diary not found' })
    if (diary.status === 'submitted') return res.status(400).json({ error: 'Cannot modify submitted diary' })

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    await prisma.diaryDelivery.delete({ where: { id: deliveryId } })
    res.json({ message: 'Delivery removed' })
  } catch (error) {
    console.error('Remove delivery error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

**Step 3: Add event CRUD endpoints**

Same pattern for events:

```typescript
// POST /api/diary/:diaryId/events - Add event
router.post('/:diaryId/events', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { diaryId } = req.params
    const data = addEventSchema.parse(req.body)

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) return res.status(404).json({ error: 'Diary not found' })
    if (diary.status === 'submitted') return res.status(400).json({ error: 'Cannot modify submitted diary' })

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    const event = await prisma.diaryEvent.create({
      data: {
        diaryId,
        eventType: data.eventType,
        description: data.description,
        notes: data.notes,
        lotId: data.lotId,
      },
      include: { lot: { select: { id: true, lotNumber: true } } },
    })

    res.status(201).json(event)
  } catch (error: any) {
    if (error.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: error.errors })
    console.error('Add event error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/diary/:diaryId/events/:eventId
router.delete('/:diaryId/events/:eventId', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { diaryId, eventId } = req.params

    const diary = await prisma.dailyDiary.findUnique({ where: { id: diaryId } })
    if (!diary) return res.status(404).json({ error: 'Diary not found' })
    if (diary.status === 'submitted') return res.status(400).json({ error: 'Cannot modify submitted diary' })

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    await prisma.diaryEvent.delete({ where: { id: eventId } })
    res.json({ message: 'Event removed' })
  } catch (error) {
    console.error('Remove event error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

**Step 4: Update existing schemas to accept lotId**

Update `addDelaySchema`, `addPlantSchema`, `addPersonnelSchema` to include optional `lotId`:

```typescript
// Add to each schema:
lotId: z.string().optional(),
```

Update the corresponding POST handlers to pass `lotId` through to the `prisma.create()` call.

**Step 5: Add timeline endpoint**

```typescript
// GET /api/diary/:diaryId/timeline - Merged chronological view of all entries
router.get('/:diaryId/timeline', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { diaryId } = req.params

    const diary = await prisma.dailyDiary.findUnique({
      where: { id: diaryId },
      include: {
        personnel: { include: { lot: { select: { id: true, lotNumber: true } } } },
        plant: { include: { lot: { select: { id: true, lotNumber: true } } } },
        activities: { include: { lot: { select: { id: true, lotNumber: true } } } },
        delays: { include: { lot: { select: { id: true, lotNumber: true } } } },
        deliveries: { include: { lot: { select: { id: true, lotNumber: true } } } },
        events: { include: { lot: { select: { id: true, lotNumber: true } } } },
      },
    })

    if (!diary) return res.status(404).json({ error: 'Diary not found' })

    const hasAccess = await checkProjectAccess(userId, diary.projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    // Merge all entries into a single timeline sorted by createdAt
    // Only include manual entries (source !== 'docket') for personnel and plant
    const timeline = [
      ...diary.activities.map(a => ({
        id: a.id, type: 'activity' as const, createdAt: a.createdAt,
        description: a.description, lot: a.lot, data: a,
      })),
      ...diary.delays.map(d => ({
        id: d.id, type: 'delay' as const, createdAt: d.createdAt,
        description: d.description, lot: d.lot, data: d,
      })),
      ...diary.deliveries.map(d => ({
        id: d.id, type: 'delivery' as const, createdAt: d.createdAt,
        description: d.description, lot: d.lot, data: d,
      })),
      ...diary.events.map(e => ({
        id: e.id, type: 'event' as const, createdAt: e.createdAt,
        description: e.description, lot: e.lot, data: e,
      })),
      ...diary.personnel.filter(p => (p as any).source === 'manual').map(p => ({
        id: p.id, type: 'personnel' as const, createdAt: (p as any).createdAt || diary.createdAt,
        description: `${p.name} — ${p.role || 'Worker'}`, lot: (p as any).lot, data: p,
      })),
      ...diary.plant.filter(p => (p as any).source === 'manual').map(p => ({
        id: p.id, type: 'plant' as const, createdAt: (p as any).createdAt || diary.createdAt,
        description: p.description, lot: (p as any).lot, data: p,
      })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

    res.json({ timeline })
  } catch (error) {
    console.error('Get timeline error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

**Step 6: Add docket summary endpoint**

```typescript
// GET /api/diary/:projectId/docket-summary/:date - Aggregate approved dockets for a date
router.get('/project/:projectId/docket-summary/:date', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id
    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    const { projectId, date } = req.params

    const hasAccess = await checkProjectAccess(userId, projectId)
    if (!hasAccess) return res.status(403).json({ error: 'Access denied' })

    const targetDate = new Date(date)
    const nextDate = new Date(date)
    nextDate.setDate(nextDate.getDate() + 1)

    // Get all dockets for this project on this date
    const dockets = await prisma.dailyDocket.findMany({
      where: {
        projectId,
        date: { gte: targetDate, lt: nextDate },
      },
      include: {
        subcontractorCompany: { select: { id: true, companyName: true } },
        labourEntries: {
          include: {
            employee: { select: { id: true, name: true, role: true } },
          },
        },
        plantEntries: {
          include: {
            plant: { select: { id: true, type: true, description: true, idRego: true } },
          },
        },
      },
    })

    const approved = dockets.filter(d => d.status === 'approved')
    const pending = dockets.filter(d => d.status === 'pending_approval')

    const summary = {
      approvedDockets: approved.map(d => ({
        id: d.id,
        subcontractor: d.subcontractorCompany.companyName,
        subcontractorId: d.subcontractorCompany.id,
        workerCount: d.labourEntries.length,
        totalLabourHours: d.labourEntries.reduce((sum, e) => sum + (Number(e.approvedHours || e.submittedHours) || 0), 0),
        machineCount: d.plantEntries.length,
        totalPlantHours: d.plantEntries.reduce((sum, e) => sum + (Number(e.hoursOperated) || 0), 0),
        workers: d.labourEntries.map(e => ({
          name: e.employee.name,
          role: e.employee.role,
          hours: Number(e.approvedHours || e.submittedHours) || 0,
        })),
        machines: d.plantEntries.map(e => ({
          type: e.plant.type,
          description: e.plant.description,
          idRego: e.plant.idRego,
          hours: Number(e.hoursOperated) || 0,
        })),
      })),
      pendingCount: pending.length,
      pendingDockets: pending.map(d => ({
        id: d.id,
        subcontractor: d.subcontractorCompany.companyName,
      })),
      totals: {
        workers: approved.reduce((sum, d) => sum + d.labourEntries.length, 0),
        labourHours: approved.reduce((sum, d) => sum + d.labourEntries.reduce((s, e) => s + (Number(e.approvedHours || e.submittedHours) || 0), 0), 0),
        machines: approved.reduce((sum, d) => sum + d.plantEntries.length, 0),
        plantHours: approved.reduce((sum, d) => sum + d.plantEntries.reduce((s, e) => s + (Number(e.hoursOperated) || 0), 0), 0),
      },
    }

    res.json(summary)
  } catch (error) {
    console.error('Get docket summary error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

**Step 7: Update existing diary fetch to include new relations**

Find all `prisma.dailyDiary.findUnique` / `findMany` calls in `diary.ts` and add `deliveries` and `events` to their `include` blocks, alongside the existing `personnel`, `plant`, `activities`, `delays`, `visitors`.

Specific locations in `diary.ts` that need updating:
- The `GET /:projectId/:date` handler (fetches diary for a date)
- The `GET /entry/:diaryId` handler (fetches diary by ID)
- The `POST /` handler response (create/update diary)
- The `POST /:diaryId/submit` handler response
- Any other findUnique/findMany that includes child relations

**Step 7b: Update frontend TypeScript interfaces in DailyDiaryPage.tsx**

Add to the `DailyDiary` interface (around line 56):

```typescript
interface Delivery {
  id: string
  description: string
  supplier?: string
  docketNumber?: string
  quantity?: number
  unit?: string
  lotId?: string
  lot?: { id: string; lotNumber: string }
  notes?: string
  createdAt: string
}

interface DiaryEvent {
  id: string
  eventType: string
  description: string
  notes?: string
  lotId?: string
  lot?: { id: string; lotNumber: string }
  createdAt: string
}
```

Update the `DailyDiary` interface to include the new fields:

```typescript
interface DailyDiary {
  // ... existing fields ...
  deliveries: Delivery[]
  events: DiaryEvent[]
}
```

Also add `createdAt: string` to the existing `Personnel`, `Plant`, `Activity`, and `Delay` interfaces.

**Step 8: Commit**

```bash
git add backend/src/routes/diary.ts
git commit -m "feat: Add delivery/event CRUD, timeline, docket-summary API endpoints"
```

---

## Task 3: Backend — Docket → Diary Auto-Population Hook

**Files:**
- Modify: `backend/src/routes/dockets.ts:517-650` (the approve endpoint)

**Step 1: Add diary auto-population logic to the approve handler**

After the existing approval update (around line 572, after `const updatedDocket = await prisma.dailyDocket.update(...)`), add:

```typescript
    // === DIARY AUTO-POPULATION ===
    // When a docket is approved, write its labour and plant data into the daily diary
    try {
      const docketDate = docket.date.toISOString().split('T')[0]

      // Find or create diary for this date
      let diary = await prisma.dailyDiary.findUnique({
        where: { projectId_date: { projectId: docket.projectId, date: docket.date } },
      })

      if (!diary) {
        diary = await prisma.dailyDiary.create({
          data: {
            projectId: docket.projectId,
            date: docket.date,
            status: 'draft',
          },
        })
        console.log(`[Docket→Diary] Auto-created diary for ${docketDate}`)
      }

      // Don't modify submitted diaries
      if (diary.status !== 'submitted') {
        // Fetch full docket with labour and plant entries
        const fullDocket = await prisma.dailyDocket.findUnique({
          where: { id: docket.id },
          include: {
            labourEntries: {
              include: {
                employee: { select: { name: true, role: true } },
                lotAllocations: true,
              },
            },
            plantEntries: {
              include: {
                plant: { select: { type: true, description: true, idRego: true } },
                lotAllocations: true,
              },
            },
            subcontractorCompany: { select: { companyName: true } },
          },
        })

        if (fullDocket) {
          // Write personnel records from labour entries
          for (const entry of fullDocket.labourEntries) {
            await prisma.diaryPersonnel.create({
              data: {
                diaryId: diary.id,
                name: entry.employee.name,
                role: entry.employee.role || undefined,
                company: fullDocket.subcontractorCompany.companyName,
                hours: entry.approvedHours || entry.submittedHours || undefined,
                startTime: entry.startTime || undefined,
                finishTime: entry.finishTime || undefined,
                source: 'docket',
                docketId: docket.id,
                lotId: entry.lotAllocations[0]?.lotId || undefined,
              },
            })
          }

          // Write plant records from plant entries
          for (const entry of fullDocket.plantEntries) {
            await prisma.diaryPlant.create({
              data: {
                diaryId: diary.id,
                description: entry.plant.description || entry.plant.type,
                idRego: entry.plant.idRego || undefined,
                company: fullDocket.subcontractorCompany.companyName,
                hoursOperated: entry.hoursOperated || undefined,
                source: 'docket',
                docketId: docket.id,
                lotId: entry.lotAllocations[0]?.lotId || undefined,
              },
            })
          }

          console.log(`[Docket→Diary] Populated diary with ${fullDocket.labourEntries.length} personnel + ${fullDocket.plantEntries.length} plant from docket ${docket.id}`)
        }
      } else {
        console.log(`[Docket→Diary] Diary for ${docketDate} is already submitted, skipping auto-population`)
      }
    } catch (diaryError) {
      // Don't fail the approval if diary population fails
      console.error('[Docket→Diary] Auto-population failed (docket still approved):', diaryError)
    }
    // === END DIARY AUTO-POPULATION ===
```

**Step 2: Verify no regression**

```bash
cd backend && npm test -- --grep "docket"
```

Expected: Existing docket tests still pass.

**Step 3: Commit**

```bash
git add backend/src/routes/dockets.ts
git commit -m "feat: Auto-populate diary personnel/plant on docket approval"
```

---

## Task 4: Frontend — DiaryMobileView Layout Shell

**Files:**
- Create: `frontend/src/components/foreman/DiaryMobileView.tsx`
- Create: `frontend/src/components/foreman/DiaryLotSelector.tsx`
- Create: `frontend/src/components/foreman/DiaryWeatherBar.tsx`
- Create: `frontend/src/components/foreman/DiaryQuickAddBar.tsx`
- Modify: `frontend/src/components/foreman/index.ts`

**Step 1: Create DiaryLotSelector**

Sticky lot context picker at top of diary. Shows current lot with dropdown to switch. All new entries inherit this lot.

```tsx
// DiaryLotSelector.tsx
import { ChevronDown, MapPin } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Lot {
  id: string
  lotNumber: string
}

interface DiaryLotSelectorProps {
  lots: Lot[]
  activeLotId: string | null
  onLotChange: (lotId: string | null) => void
}

export function DiaryLotSelector({ lots, activeLotId, onLotChange }: DiaryLotSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const activeLot = lots.find(l => l.id === activeLotId)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium',
          'touch-manipulation min-h-[44px]',
          activeLot ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground'
        )}
      >
        <MapPin className="h-4 w-4" />
        {activeLot ? `Lot ${activeLot.lotNumber}` : 'All Lots'}
        <ChevronDown className={cn('h-4 w-4 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full mt-1 right-0 z-50 bg-background border rounded-lg shadow-lg min-w-[160px] py-1">
            <button
              onClick={() => { onLotChange(null); setIsOpen(false) }}
              className={cn(
                'w-full text-left px-4 py-3 text-sm touch-manipulation',
                !activeLotId && 'bg-primary/10 font-medium'
              )}
            >
              All Lots
            </button>
            {lots.map(lot => (
              <button
                key={lot.id}
                onClick={() => { onLotChange(lot.id); setIsOpen(false) }}
                className={cn(
                  'w-full text-left px-4 py-3 text-sm touch-manipulation',
                  lot.id === activeLotId && 'bg-primary/10 font-medium'
                )}
              >
                Lot {lot.lotNumber}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

**Step 2: Create DiaryWeatherBar**

Compact weather strip showing auto-filled weather. Tap opens edit sheet.

```tsx
// DiaryWeatherBar.tsx
import { Cloud, Sun, CloudRain, CloudLightning, Wind, CloudFog, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WeatherData {
  conditions: string
  temperatureMin: string
  temperatureMax: string
  rainfallMm: string
}

interface DiaryWeatherBarProps {
  weather: WeatherData | null
  weatherSource: string | null
  loading: boolean
  onTapEdit: () => void
}

const weatherIcons: Record<string, typeof Cloud> = {
  'Fine': Sun,
  'Partly Cloudy': Cloud,
  'Cloudy': Cloud,
  'Rain': CloudRain,
  'Heavy Rain': CloudRain,
  'Storm': CloudLightning,
  'Wind': Wind,
  'Fog': CloudFog,
}

export function DiaryWeatherBar({ weather, weatherSource, loading, onTapEdit }: DiaryWeatherBarProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm text-blue-600 dark:text-blue-400">Fetching weather...</span>
      </div>
    )
  }

  if (!weather || !weather.conditions) {
    return (
      <button
        onClick={onTapEdit}
        className="w-full flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg touch-manipulation min-h-[44px]"
      >
        <Cloud className="h-4 w-4 text-amber-500" />
        <span className="text-sm text-amber-600 dark:text-amber-400">Tap to add weather</span>
      </button>
    )
  }

  const Icon = weatherIcons[weather.conditions] || Cloud

  return (
    <button
      onClick={onTapEdit}
      className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg touch-manipulation min-h-[44px]"
    >
      <Icon className="h-5 w-5 text-blue-500 flex-shrink-0" />
      <div className="flex-1 text-left">
        <span className="text-sm font-medium">
          {weather.conditions}
          {weather.temperatureMin && weather.temperatureMax && (
            <> · {weather.temperatureMin}°–{weather.temperatureMax}°C</>
          )}
          {weather.rainfallMm && Number(weather.rainfallMm) > 0 && (
            <> · {weather.rainfallMm}mm</>
          )}
        </span>
      </div>
      <span className="text-xs text-blue-400">Edit</span>
    </button>
  )
}
```

**Step 3: Create DiaryQuickAddBar**

Sticky chip bar above the bottom nav.

```tsx
// DiaryQuickAddBar.tsx
import { Plus, Clock, Truck, Wrench, AlertTriangle, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type QuickAddType = 'activity' | 'delay' | 'delivery' | 'plant' | 'event' | 'manual'

interface DiaryQuickAddBarProps {
  onChipTap: (type: QuickAddType) => void
  diaryExists: boolean
  isSubmitted: boolean
}

const chips: Array<{ type: QuickAddType; label: string; icon: typeof Plus; color: string }> = [
  { type: 'activity', label: 'Activity', icon: Plus, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { type: 'delay', label: 'Delay', icon: AlertTriangle, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { type: 'delivery', label: 'Delivery', icon: Truck, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { type: 'plant', label: 'Plant', icon: Wrench, color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { type: 'event', label: 'Event', icon: CalendarClock, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
]

export function DiaryQuickAddBar({ onChipTap, diaryExists, isSubmitted }: DiaryQuickAddBarProps) {
  if (isSubmitted) return null

  return (
    <div className="sticky bottom-[72px] z-30 bg-background/95 backdrop-blur border-t px-3 py-2">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {chips.map(chip => {
          const Icon = chip.icon
          return (
            <button
              key={chip.type}
              onClick={() => onChipTap(chip.type)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap',
                'touch-manipulation min-h-[40px]',
                chip.color
              )}
            >
              <Icon className="h-4 w-4" />
              {chip.label}
            </button>
          )
        })}
        <button
          onClick={() => onChipTap('manual')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap touch-manipulation min-h-[40px] bg-muted text-muted-foreground"
        >
          <Clock className="h-4 w-4" />
          + More
        </button>
      </div>
    </div>
  )
}
```

**Step 4: Create DiaryMobileView shell**

This is the main mobile layout that composes all sub-components.

```tsx
// DiaryMobileView.tsx
import { DiaryLotSelector } from './DiaryLotSelector'
import { DiaryWeatherBar } from './DiaryWeatherBar'
import { DiaryQuickAddBar, QuickAddType } from './DiaryQuickAddBar'
import { usePullToRefresh, PullToRefreshIndicator } from '@/hooks/usePullToRefresh'

// ... (full interface definitions for all props will match the page's state)

interface DiaryMobileViewProps {
  // Date & lot
  selectedDate: string
  lots: Array<{ id: string; lotNumber: string }>
  activeLotId: string | null
  onLotChange: (lotId: string | null) => void
  // Weather
  weather: { conditions: string; temperatureMin: string; temperatureMax: string; rainfallMm: string } | null
  weatherSource: string | null
  fetchingWeather: boolean
  onEditWeather: () => void
  // Diary state
  diary: any | null  // DailyDiary or null
  loading: boolean
  // Docket summary
  docketSummary: any | null
  docketSummaryLoading: boolean
  // Timeline
  timeline: any[]
  // Actions
  onQuickAdd: (type: QuickAddType) => void
  onRefresh: () => Promise<void>
  onEditEntry: (entry: any) => void
  onDeleteEntry: (entry: any) => void
}

export function DiaryMobileView(props: DiaryMobileViewProps) {
  const {
    selectedDate, lots, activeLotId, onLotChange,
    weather, weatherSource, fetchingWeather, onEditWeather,
    diary, loading,
    docketSummary, docketSummaryLoading,
    timeline,
    onQuickAdd, onRefresh, onEditEntry, onDeleteEntry,
  } = props

  const { containerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh,
  })

  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = selectedDate === todayStr
  const isSubmitted = diary?.status === 'submitted'

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header: date + lot selector */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background sticky top-0 z-20">
        <div>
          <h1 className="text-lg font-bold">{dateLabel}</h1>
          {!isToday && <p className="text-xs text-muted-foreground">Not today</p>}
          {isSubmitted && <p className="text-xs text-green-600 font-medium">Submitted</p>}
        </div>
        <DiaryLotSelector lots={lots} activeLotId={activeLotId} onLotChange={onLotChange} />
      </div>

      {/* Scrollable content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          progress={progress}
        />

        <div className="p-4 space-y-3 pb-36">
          {/* Weather bar */}
          <DiaryWeatherBar
            weather={weather}
            weatherSource={weatherSource}
            loading={fetchingWeather}
            onTapEdit={onEditWeather}
          />

          {/* Docket summary card - Task 6 will implement this */}
          {/* <DiaryDocketSummary ... /> */}

          {/* Timeline entries - Task 5 will wire these */}
          {timeline.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">No entries yet</p>
              <p className="text-muted-foreground text-xs mt-1">Tap a chip below to add your first entry</p>
            </div>
          )}

          {/* Timeline entries will render here */}
        </div>
      </div>

      {/* Quick-add chip bar */}
      <DiaryQuickAddBar
        onChipTap={onQuickAdd}
        diaryExists={!!diary}
        isSubmitted={isSubmitted}
      />
    </div>
  )
}
```

**Step 5: Export new components from index.ts**

Add to `frontend/src/components/foreman/index.ts`:

```typescript
// Diary Mobile Components
export { DiaryMobileView } from './DiaryMobileView'
export { DiaryLotSelector } from './DiaryLotSelector'
export { DiaryWeatherBar } from './DiaryWeatherBar'
export { DiaryQuickAddBar } from './DiaryQuickAddBar'
```

**Step 6: Wire into DailyDiaryPage**

In `frontend/src/pages/diary/DailyDiaryPage.tsx`, the page already imports `useIsMobile`. Add the mobile conditional rendering:

At the top of the component, add new state:

```typescript
const [activeLotId, setActiveLotId] = useState<string | null>(null)
const [timeline, setTimeline] = useState<any[]>([])
const [docketSummary, setDocketSummary] = useState<any>(null)
const [docketSummaryLoading, setDocketSummaryLoading] = useState(false)
const [activeSheet, setActiveSheet] = useState<QuickAddType | null>(null)
```

Add fetch functions:

```typescript
const fetchTimeline = async () => {
  if (!diary) return
  try {
    const token = getAuthToken()
    const res = await fetch(`${API_URL}/api/diary/${diary.id}/timeline`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setTimeline(data.timeline)
    }
  } catch (err) {
    console.error('Error fetching timeline:', err)
  }
}

const fetchDocketSummary = async () => {
  if (!projectId || !selectedDate) return
  setDocketSummaryLoading(true)
  try {
    const token = getAuthToken()
    const res = await fetch(`${API_URL}/api/diary/project/${projectId}/docket-summary/${selectedDate}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setDocketSummary(data)
    }
  } catch (err) {
    console.error('Error fetching docket summary:', err)
  } finally {
    setDocketSummaryLoading(false)
  }
}

const handleRefresh = async () => {
  await Promise.all([
    fetchDiaryForDate(selectedDate),
    fetchDocketSummary(),
  ])
  // Timeline refreshes via useEffect when diary changes
}
```

In the return statement, wrap the existing desktop JSX:

```tsx
if (isMobile) {
  return (
    <>
      <DiaryMobileView
        selectedDate={selectedDate}
        lots={lots}
        activeLotId={activeLotId}
        onLotChange={setActiveLotId}
        weather={diary ? {
          conditions: diary.weatherConditions || '',
          temperatureMin: diary.temperatureMin?.toString() || '',
          temperatureMax: diary.temperatureMax?.toString() || '',
          rainfallMm: diary.rainfallMm?.toString() || '',
        } : weatherForm.weatherConditions ? {
          conditions: weatherForm.weatherConditions,
          temperatureMin: weatherForm.temperatureMin,
          temperatureMax: weatherForm.temperatureMax,
          rainfallMm: weatherForm.rainfallMm,
        } : null}
        weatherSource={weatherSource}
        fetchingWeather={fetchingWeather}
        onEditWeather={() => setActiveSheet('weather' as any)}
        diary={diary}
        loading={loading}
        docketSummary={docketSummary}
        docketSummaryLoading={docketSummaryLoading}
        timeline={timeline}
        onQuickAdd={(type) => setActiveSheet(type)}
        onRefresh={handleRefresh}
        onEditEntry={() => {}}  // Wired in Task 5 (bottom sheets)
        onDeleteEntry={() => {}} // Wired in Task 5 (bottom sheets)
      />
      {/* Bottom sheets render here - Task 5 */}
    </>
  )
}

// Existing desktop return below...
return (
  <div className="space-y-6">
    {/* ... existing desktop JSX ... */}
  </div>
)
```

**Step 7: Commit**

```bash
git add frontend/src/components/foreman/ frontend/src/pages/diary/DailyDiaryPage.tsx
git commit -m "feat: Add mobile diary timeline layout shell with lot selector, weather bar, quick-add chips"
```

---

## Task 5: Frontend — Bottom Sheets + Timeline Entries

**Files:**
- Create: `frontend/src/components/foreman/sheets/AddActivitySheet.tsx`
- Create: `frontend/src/components/foreman/sheets/AddDelaySheet.tsx`
- Create: `frontend/src/components/foreman/sheets/AddDeliverySheet.tsx`
- Create: `frontend/src/components/foreman/sheets/AddEventSheet.tsx`
- Create: `frontend/src/components/foreman/sheets/AddManualLabourPlantSheet.tsx`
- Create: `frontend/src/components/foreman/sheets/BottomSheet.tsx` (reusable wrapper)
- Create: `frontend/src/components/foreman/DiaryTimelineEntry.tsx`

**Step 1: Create reusable BottomSheet wrapper**

```tsx
// sheets/BottomSheet.tsx
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function BottomSheet({ isOpen, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end" onClick={onClose}>
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-background rounded-t-2xl max-h-[85vh] overflow-hidden flex flex-col"
        style={{ animation: 'slideUp 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b px-4 py-3 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
```

**Step 2: Create AddActivitySheet**

Each sheet follows this pattern:
- Minimal required fields visible
- "More details" expandable for optional fields
- Voice input on description fields
- Big save button (56px, green)
- `lotId` defaults to the sticky lot context (passed as prop)

```tsx
// sheets/AddActivitySheet.tsx
import { useState } from 'react'
import { Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VoiceInputButton } from '@/components/ui/VoiceInputButton'
import { BottomSheet } from './BottomSheet'
import { useHaptics } from '@/hooks/useHaptics'

interface AddActivitySheetProps {
  isOpen: boolean
  onClose: () => void
  onSave: (data: {
    description: string
    lotId?: string
    quantity?: number
    unit?: string
    notes?: string
  }) => Promise<void>
  defaultLotId: string | null
  lots: Array<{ id: string; lotNumber: string }>
  suggestions?: string[]
  editData?: any  // Pre-filled when editing existing entry
}

export function AddActivitySheet({
  isOpen, onClose, onSave, defaultLotId, lots, suggestions = [], editData
}: AddActivitySheetProps) {
  const [description, setDescription] = useState(editData?.description || '')
  const [lotId, setLotId] = useState(editData?.lotId || defaultLotId || '')
  const [quantity, setQuantity] = useState(editData?.quantity?.toString() || '')
  const [unit, setUnit] = useState(editData?.unit || '')
  const [notes, setNotes] = useState(editData?.notes || '')
  const [showMore, setShowMore] = useState(false)
  const [saving, setSaving] = useState(false)
  const { trigger } = useHaptics()

  const handleSave = async () => {
    if (!description.trim() || saving) return
    setSaving(true)
    try {
      await onSave({
        description: description.trim(),
        lotId: lotId || undefined,
        quantity: quantity ? parseFloat(quantity) : undefined,
        unit: unit || undefined,
        notes: notes || undefined,
      })
      trigger('success')
      onClose()
    } catch (err) {
      trigger('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={editData ? 'Edit Activity' : 'Add Activity'}>
      <div className="space-y-4">
        {/* Description with voice input */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Description *</label>
          <div className="flex gap-2 mt-1">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What work was done?"
              className="flex-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
              autoFocus
            />
            <VoiceInputButton onResult={(text) => setDescription(prev => prev ? `${prev} ${text}` : text)} />
          </div>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && !description && (
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 6).map((s, i) => (
              <button
                key={i}
                onClick={() => setDescription(s)}
                className="px-3 py-1.5 bg-muted rounded-full text-sm touch-manipulation"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* More details toggle */}
        <button
          onClick={() => setShowMore(!showMore)}
          className="flex items-center gap-1 text-sm text-primary touch-manipulation"
        >
          {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showMore ? 'Less details' : 'More details'}
        </button>

        {showMore && (
          <div className="space-y-3">
            {/* Lot selector */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Lot</label>
              <select
                value={lotId}
                onChange={(e) => setLotId(e.target.value)}
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
              >
                <option value="">No lot</option>
                {lots.map(lot => (
                  <option key={lot.id} value={lot.id}>Lot {lot.lotNumber}</option>
                ))}
              </select>
            </div>

            {/* Quantity + Unit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Quantity</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Unit</label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="m³, tonnes..."
                  className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full mt-1 px-3 py-3 border rounded-lg text-base touch-manipulation resize-none"
              />
            </div>
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!description.trim() || saving}
          className={cn(
            'w-full py-4 rounded-lg font-semibold text-white',
            'bg-green-600 active:bg-green-700',
            'touch-manipulation min-h-[56px]',
            'flex items-center justify-center gap-2',
            (!description.trim() || saving) && 'opacity-50'
          )}
        >
          {saving ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Saving...</>
          ) : (
            editData ? 'Update Activity' : 'Save Activity'
          )}
        </button>
      </div>
    </BottomSheet>
  )
}
```

**Step 3: Create AddDelaySheet, AddDeliverySheet, AddEventSheet, AddManualLabourPlantSheet**

Follow the exact same pattern as `AddActivitySheet` but with fields matching the design:

- **AddDelaySheet**: Type pill selector (not dropdown), description + voice, optional duration/impact
- **AddDeliverySheet**: Description + voice, optional supplier/docketNumber/qty/unit/lot/notes/photo
- **AddEventSheet**: Type pill selector (visitor/safety/instruction/variation/other), description + voice, optional notes/photo
- **AddManualLabourPlantSheet**: Two sub-sections for personnel and plant with banner "Tip: Labour and plant auto-populate from approved dockets"

Each sheet receives `defaultLotId`, `lots[]`, and an `onSave` callback.

**Step 4: Create DiaryTimelineEntry**

```tsx
// DiaryTimelineEntry.tsx
import { Plus, AlertTriangle, Truck, Wrench, CalendarClock, Users, Clock } from 'lucide-react'
import { SwipeableCard } from './SwipeableCard'
import { cn } from '@/lib/utils'
import { Trash2, Edit2 } from 'lucide-react'

interface TimelineEntry {
  id: string
  type: 'activity' | 'delay' | 'delivery' | 'event' | 'personnel' | 'plant'
  createdAt: string
  description: string
  lot: { id: string; lotNumber: string } | null
  data: any
}

interface DiaryTimelineEntryProps {
  entry: TimelineEntry
  onEdit: (entry: TimelineEntry) => void
  onDelete: (entry: TimelineEntry) => void
  isSubmitted: boolean
}

const typeConfig: Record<string, { icon: typeof Plus; color: string; bgColor: string; label: string }> = {
  activity: { icon: Plus, color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30', label: 'Activity' },
  delay: { icon: AlertTriangle, color: 'text-red-600', bgColor: 'bg-red-100 dark:bg-red-900/30', label: 'Delay' },
  delivery: { icon: Truck, color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30', label: 'Delivery' },
  event: { icon: CalendarClock, color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30', label: 'Event' },
  personnel: { icon: Users, color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Personnel' },
  plant: { icon: Wrench, color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-800', label: 'Plant' },
}

export function DiaryTimelineEntry({ entry, onEdit, onDelete, isSubmitted }: DiaryTimelineEntryProps) {
  const config = typeConfig[entry.type] || typeConfig.activity
  const Icon = config.icon

  const time = new Date(entry.createdAt).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const card = (
    <div
      onClick={() => !isSubmitted && onEdit(entry)}
      className={cn(
        'flex gap-3 p-3 rounded-lg border bg-card',
        !isSubmitted && 'active:bg-muted/50 cursor-pointer'
      )}
    >
      {/* Type icon */}
      <div className={cn('flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center', config.bgColor)}>
        <Icon className={cn('h-5 w-5', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
          <span className="text-xs text-muted-foreground">{time}</span>
          {entry.lot && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Lot {entry.lot.lotNumber}</span>
          )}
        </div>
        <p className="text-sm font-medium truncate">{entry.description}</p>

        {/* Extra detail based on type */}
        {entry.type === 'delay' && entry.data.durationHours && (
          <p className="text-xs text-muted-foreground mt-0.5">
            <Clock className="inline h-3 w-3 mr-1" />
            {entry.data.durationHours}h — {entry.data.delayType}
          </p>
        )}
        {entry.type === 'delivery' && entry.data.supplier && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {entry.data.supplier}
            {entry.data.quantity && ` · ${entry.data.quantity} ${entry.data.unit || ''}`}
          </p>
        )}
        {entry.type === 'event' && entry.data.eventType && (
          <p className="text-xs text-muted-foreground mt-0.5 capitalize">{entry.data.eventType}</p>
        )}
      </div>
    </div>
  )

  if (isSubmitted) return card

  return (
    <SwipeableCard
      onSwipeLeft={() => onDelete(entry)}
      leftAction={{
        label: 'Delete',
        color: 'bg-red-500',
        icon: <Trash2 className="h-5 w-5" />,
      }}
      rightAction={{
        label: 'Edit',
        color: 'bg-blue-500',
        icon: <Edit2 className="h-5 w-5" />,
      }}
      onSwipeRight={() => onEdit(entry)}
    >
      {card}
    </SwipeableCard>
  )
}
```

**Step 5: Wire timeline entries into DiaryMobileView**

Replace the empty timeline placeholder in `DiaryMobileView.tsx` with:

```tsx
{timeline.map(entry => (
  <DiaryTimelineEntry
    key={`${entry.type}-${entry.id}`}
    entry={entry}
    onEdit={onEditEntry}
    onDelete={onDeleteEntry}
    isSubmitted={isSubmitted}
  />
))}
```

**Step 6: Add parameterized API helpers for mobile sheets**

> **Important:** The existing `addActivity()`, `addDelay()`, etc. functions read from component state (`activityForm`, `delayForm`) and take no parameters. The mobile bottom sheets need parameterized versions. Add these new helpers alongside the existing ones in `DailyDiaryPage.tsx`:

```typescript
// === Mobile API helpers (accept parameters, unlike desktop form handlers) ===

const addActivityFromSheet = async (data: {
  description: string; lotId?: string; quantity?: number; unit?: string; notes?: string
}) => {
  // Lazy diary creation: if no diary exists, create one first
  let currentDiary = diary
  if (!currentDiary) {
    currentDiary = await ensureDiaryExists()
    if (!currentDiary) return
  }
  const token = getAuthToken()
  const res = await fetch(`${API_URL}/api/diary/${currentDiary.id}/activities`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (res.ok) {
    await fetchTimeline()
    await fetchDiaryForDate(selectedDate)
  } else {
    throw new Error('Failed to add activity')
  }
}

const addDelayFromSheet = async (data: {
  delayType: string; description: string; durationHours?: number; impact?: string; lotId?: string
}) => {
  let currentDiary = diary
  if (!currentDiary) {
    currentDiary = await ensureDiaryExists()
    if (!currentDiary) return
  }
  const token = getAuthToken()
  const res = await fetch(`${API_URL}/api/diary/${currentDiary.id}/delays`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (res.ok) {
    await fetchTimeline()
    await fetchDiaryForDate(selectedDate)
  } else {
    throw new Error('Failed to add delay')
  }
}

const addDeliveryFromSheet = async (data: {
  description: string; supplier?: string; docketNumber?: string; quantity?: number; unit?: string; lotId?: string; notes?: string
}) => {
  let currentDiary = diary
  if (!currentDiary) {
    currentDiary = await ensureDiaryExists()
    if (!currentDiary) return
  }
  const token = getAuthToken()
  const res = await fetch(`${API_URL}/api/diary/${currentDiary.id}/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (res.ok) {
    await fetchTimeline()
    await fetchDiaryForDate(selectedDate)
  } else {
    throw new Error('Failed to add delivery')
  }
}

const addEventFromSheet = async (data: {
  eventType: string; description: string; notes?: string; lotId?: string
}) => {
  let currentDiary = diary
  if (!currentDiary) {
    currentDiary = await ensureDiaryExists()
    if (!currentDiary) return
  }
  const token = getAuthToken()
  const res = await fetch(`${API_URL}/api/diary/${currentDiary.id}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  })
  if (res.ok) {
    await fetchTimeline()
    await fetchDiaryForDate(selectedDate)
  } else {
    throw new Error('Failed to add event')
  }
}

// Helper: ensure diary exists (lazy creation)
const ensureDiaryExists = async (): Promise<DailyDiary | null> => {
  if (diary) return diary
  const token = getAuthToken()
  const res = await fetch(`${API_URL}/api/diary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ projectId, date: selectedDate }),
  })
  if (res.ok) {
    const newDiary = await res.json()
    setDiary(newDiary)
    return newDiary
  }
  return null
}
```

**Step 7: Wire bottom sheets into DailyDiaryPage**

Add sheet rendering after the `DiaryMobileView` in the mobile return block:

```tsx
{activeSheet === 'activity' && (
  <AddActivitySheet
    isOpen
    onClose={() => setActiveSheet(null)}
    onSave={async (data) => {
      await addActivityFromSheet({ ...data, lotId: data.lotId || activeLotId || undefined })
    }}
    defaultLotId={activeLotId}
    lots={lots}
    suggestions={activitySuggestions}
  />
)}
{activeSheet === 'delay' && (
  <AddDelaySheet
    isOpen
    onClose={() => setActiveSheet(null)}
    onSave={async (data) => {
      await addDelayFromSheet({ ...data, lotId: data.lotId || activeLotId || undefined })
    }}
    defaultLotId={activeLotId}
    lots={lots}
  />
)}
{activeSheet === 'delivery' && (
  <AddDeliverySheet
    isOpen
    onClose={() => setActiveSheet(null)}
    onSave={async (data) => {
      await addDeliveryFromSheet({ ...data, lotId: data.lotId || activeLotId || undefined })
    }}
    defaultLotId={activeLotId}
    lots={lots}
  />
)}
{activeSheet === 'event' && (
  <AddEventSheet
    isOpen
    onClose={() => setActiveSheet(null)}
    onSave={async (data) => {
      await addEventFromSheet({ ...data, lotId: data.lotId || activeLotId || undefined })
    }}
    defaultLotId={activeLotId}
    lots={lots}
  />
)}
{activeSheet === 'manual' && (
  <AddManualLabourPlantSheet
    isOpen
    onClose={() => setActiveSheet(null)}
    onSavePersonnel={async (data) => {
      let currentDiary = diary
      if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
      const token = getAuthToken()
      await fetch(`${API_URL}/api/diary/${currentDiary.id}/personnel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, source: 'manual', lotId: data.lotId || activeLotId || undefined }),
      })
      await fetchTimeline()
      await fetchDiaryForDate(selectedDate)
    }}
    onSavePlant={async (data) => {
      let currentDiary = diary
      if (!currentDiary) { currentDiary = await ensureDiaryExists(); if (!currentDiary) return }
      const token = getAuthToken()
      await fetch(`${API_URL}/api/diary/${currentDiary.id}/plant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...data, source: 'manual', lotId: data.lotId || activeLotId || undefined }),
      })
      await fetchTimeline()
      await fetchDiaryForDate(selectedDate)
    }}
    defaultLotId={activeLotId}
    lots={lots}
  />
)}
```

**Step 8: Commit**

```bash
git add frontend/src/components/foreman/ frontend/src/pages/diary/DailyDiaryPage.tsx
git commit -m "feat: Add bottom sheets, timeline entries, and wire mobile diary interactions"
```

---

## Task 6: Frontend — Docket Summary Integration

**Files:**
- Create: `frontend/src/components/foreman/DiaryDocketSummary.tsx`
- Modify: `frontend/src/components/foreman/DiaryMobileView.tsx`

**Step 1: Create DiaryDocketSummary**

Collapsible card showing labour/plant from approved dockets. Three states: dockets exist (collapsed), expanded, no dockets.

```tsx
// DiaryDocketSummary.tsx
import { useState } from 'react'
import { Users, Wrench, ChevronDown, ChevronUp, Clock, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DocketSummaryData {
  approvedDockets: Array<{
    id: string
    subcontractor: string
    workerCount: number
    totalLabourHours: number
    machineCount: number
    totalPlantHours: number
    workers: Array<{ name: string; role: string | null; hours: number }>
    machines: Array<{ type: string; description: string | null; idRego: string | null; hours: number }>
  }>
  pendingCount: number
  pendingDockets: Array<{ id: string; subcontractor: string }>
  totals: {
    workers: number
    labourHours: number
    machines: number
    plantHours: number
  }
}

// Also shows manual foreman-entered personnel/plant
interface ManualEntries {
  personnel: Array<{ id: string; name: string; hours?: number }>
  plant: Array<{ id: string; description: string; hoursOperated?: number }>
}

interface DiaryDocketSummaryProps {
  summary: DocketSummaryData | null
  manualEntries: ManualEntries
  loading: boolean
  onTapPending: (docketId: string) => void
  onAddManual: () => void
}

export function DiaryDocketSummary({
  summary, manualEntries, loading, onTapPending, onAddManual
}: DiaryDocketSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-muted rounded-lg">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading docket data...</span>
      </div>
    )
  }

  const hasDockets = summary && (summary.approvedDockets.length > 0 || summary.pendingCount > 0)
  const hasManual = manualEntries.personnel.length > 0 || manualEntries.plant.length > 0

  if (!hasDockets && !hasManual) {
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg border border-dashed">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">No dockets yet today</span>
        </div>
        <button
          onClick={onAddManual}
          className="text-sm text-primary font-medium touch-manipulation min-h-[32px]"
        >
          Add manually
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Collapsed summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 touch-manipulation min-h-[48px]"
      >
        <div className="flex items-center gap-4 text-sm">
          {summary && summary.totals.workers > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4 text-emerald-600" />
              <strong>{summary.totals.workers}</strong> workers
            </span>
          )}
          {summary && summary.totals.machines > 0 && (
            <span className="flex items-center gap-1">
              <Wrench className="h-4 w-4 text-gray-600" />
              <strong>{summary.totals.machines}</strong> machines
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {summary && summary.pendingCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {summary.pendingCount} pending
            </span>
          )}
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t px-4 py-3 space-y-3">
          {summary?.approvedDockets.map(d => (
            <div key={d.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-600" />
                <span className="text-sm font-medium">{d.subcontractor}</span>
              </div>
              <p className="text-xs text-muted-foreground ml-5">
                {d.workerCount} workers · {d.totalLabourHours}hrs
                {d.machineCount > 0 && <> · {d.machineCount} machines · {d.totalPlantHours}hrs</>}
              </p>
            </div>
          ))}

          {summary?.pendingDockets.map(d => (
            <button
              key={d.id}
              onClick={() => onTapPending(d.id)}
              className="flex items-center gap-2 w-full text-left touch-manipulation"
            >
              <Clock className="h-3 w-3 text-amber-500" />
              <span className="text-sm text-amber-600">{d.subcontractor} — pending</span>
            </button>
          ))}

          {/* Totals */}
          {summary && (
            <div className="border-t pt-2 text-xs text-muted-foreground">
              Totals: {summary.totals.workers} workers · {summary.totals.labourHours}hrs
              {summary.totals.machines > 0 && <> · {summary.totals.machines} machines · {summary.totals.plantHours}hrs</>}
            </div>
          )}

          {/* Manual fallback entries */}
          {hasManual && (
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground mb-1">+ Foreman-entered:</p>
              {manualEntries.personnel.map(p => (
                <p key={p.id} className="text-xs ml-3">{p.name} ({p.hours || 0}hrs)</p>
              ))}
              {manualEntries.plant.map(p => (
                <p key={p.id} className="text-xs ml-3">{p.description} ({p.hoursOperated || 0}hrs)</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Wire into DiaryMobileView**

Replace the `{/* <DiaryDocketSummary ... /> */}` comment with the actual component, passing the data from props.

**Step 3: Export from index.ts**

```typescript
export { DiaryDocketSummary } from './DiaryDocketSummary'
```

**Step 4: Commit**

```bash
git add frontend/src/components/foreman/
git commit -m "feat: Add docket summary card with collapsed/expanded states and manual fallback display"
```

---

## Task 7: Frontend — Offline Support + Polish

**Files:**
- Modify: `frontend/src/lib/offlineDb.ts`
- Modify: `frontend/src/components/foreman/DiaryMobileView.tsx`
- Modify: `frontend/src/components/foreman/DiaryTimelineEntry.tsx`

**Step 1: Add new Dexie tables for delivery and event**

In `offlineDb.ts`, add new interfaces (after the existing `OfflineDailyDiary` interface):

```typescript
export interface OfflineDiaryDelivery {
  id: string
  diaryId: string
  description: string
  supplier?: string
  docketNumber?: string
  quantity?: number
  unit?: string
  lotId?: string
  notes?: string
  syncStatus: 'synced' | 'pending' | 'error'
  localUpdatedAt: string
}

export interface OfflineDiaryEvent {
  id: string
  diaryId: string
  eventType: string
  description: string
  notes?: string
  lotId?: string
  syncStatus: 'synced' | 'pending' | 'error'
  localUpdatedAt: string
}
```

**Step 1b: Add Table type declarations to the OfflineDatabase class**

> **Important:** The existing class declares `Table` types for each Dexie table (e.g., `diaries!: Table<OfflineDailyDiary>`). New tables MUST also have declarations, or TypeScript won't expose them on the `offlineDb` instance.

Add these two lines to the `OfflineDatabase` class, alongside the existing table declarations (around line 184):

```typescript
class OfflineDatabase extends Dexie {
  itpChecklists!: Table<OfflineITPChecklist>;
  itpCompletions!: Table<OfflineITPCompletion>;
  syncQueue!: Table<SyncQueueItem>;
  photos!: Table<OfflinePhoto>;
  diaries!: Table<OfflineDailyDiary>;
  dockets!: Table<OfflineDocket>;
  lots!: Table<OfflineLotEditTable>;
  diaryDeliveries!: Table<OfflineDiaryDelivery>;   // ← ADD
  diaryEvents!: Table<OfflineDiaryEvent>;           // ← ADD
```

**Step 1c: Bump Dexie version and add new table stores**

Add a new version block in the constructor (after the existing `this.version(5)` block):

```typescript
// Version 6: Add delivery and event tables for mobile diary timeline
this.version(6).stores({
  itpChecklists: 'id, lotId, templateId, cachedAt',
  itpCompletions: 'id, lotId, checklistItemId, syncStatus, localUpdatedAt',
  syncQueue: '++id, type, action, createdAt',
  photos: 'id, projectId, lotId, entityType, entityId, syncStatus, capturedAt',
  diaries: 'id, projectId, date, status, syncStatus, localUpdatedAt',
  dockets: 'id, projectId, subcontractorCompanyId, date, status, syncStatus, localUpdatedAt',
  lots: 'id, projectId, lotNumber, syncStatus, localUpdatedAt',
  diaryDeliveries: 'id, diaryId, syncStatus, localUpdatedAt',
  diaryEvents: 'id, diaryId, syncStatus, localUpdatedAt',
})
```

**Step 1d: Update `clearAllOfflineData()` to clear new tables**

> **Important:** The existing `clearAllOfflineData()` function (line 341) clears every table explicitly. If you don't add the new tables, they'll retain stale data after logout/clear.

Update the function:

```typescript
export async function clearAllOfflineData(): Promise<void> {
  await offlineDb.itpChecklists.clear();
  await offlineDb.itpCompletions.clear();
  await offlineDb.syncQueue.clear();
  await offlineDb.photos.clear();
  await offlineDb.diaries.clear();
  await offlineDb.dockets.clear();
  await offlineDb.lots.clear();               // ← existing but was missing
  await offlineDb.diaryDeliveries.clear();     // ← ADD
  await offlineDb.diaryEvents.clear();         // ← ADD
}
```

**Step 1e: Update `SyncQueueItem` type to include new sync types**

```typescript
type: 'itp_completion' | 'photo_upload' | 'diary_save' | 'diary_submit' | 'docket_create' | 'docket_submit' | 'lot_edit' | 'lot_conflict' | 'delivery_save' | 'event_save'
```

**Step 2: Add loading skeletons to DiaryMobileView**

When `loading` is true, show skeleton cards matching the timeline entry layout.

**Step 3: Add empty states**

- No diary and isToday: Show "Start your day — tap an action below"
- No diary and not today: Show "No diary for this date"
- Has diary but empty timeline: Show "No entries yet — tap a chip below"

**Step 4: Add pull-to-refresh** (already wired in Task 5 shell — verify it works)

**Step 5: Ensure voice input works on all bottom sheet text fields**

Each sheet's description/notes field should have a `<VoiceInputButton>` next to it.

**Step 6: Commit**

```bash
git add frontend/src/lib/offlineDb.ts frontend/src/components/foreman/
git commit -m "feat: Add offline Dexie schemas, loading skeletons, empty states for mobile diary"
```

---

## Summary

| Task | What | Files | Depends On |
|------|------|-------|------------|
| 1 | Prisma models + migration (incl. createdAt on all diary children) | `schema.prisma` | — |
| 2 | API endpoints (delivery, event, timeline, docket-summary) + frontend TS interfaces | `diary.ts`, `DailyDiaryPage.tsx` | Task 1 |
| 3 | Docket→diary auto-population hook | `dockets.ts` | Task 1 |
| 4 | Mobile layout shell (view, lot, weather, chips) | 4 new components + page wiring | Task 2 |
| 5 | Bottom sheets + timeline entries + parameterized API helpers | 7 new components + page helpers | Task 4 |
| 6 | Docket summary card | 1 new component | Task 2, Task 4 |
| 7 | Offline support + polish (Dexie tables, skeletons, empty states) | `offlineDb.ts` + component updates | Task 5, Task 6 |

**Critical path:** Task 1 → Task 2 → Task 4 → Task 5 → Task 7
**Parallel track:** Task 3 can run alongside Task 2.
**Parallel track:** Task 6 can run alongside Task 5.
