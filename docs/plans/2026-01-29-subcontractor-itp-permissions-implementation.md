# Subcontractor ITP Permissions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow contractors to grant subcontractors permission to complete ITPs on specific lots, with optional verification requirement.

**Architecture:** New `LotSubcontractorAssignment` table links subcontractors to lots with ITP permissions. Backend API manages assignments and checks permissions on ITP completion. Frontend modal for assignment and lot detail section for management.

**Tech Stack:** Prisma (PostgreSQL), Express.js, React, TanStack Query, shadcn/ui

---

## Task 1: Add Prisma Model

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Step 1: Add LotSubcontractorAssignment model**

Add after the `SubcontractorUser` model (around line 813):

```prisma
// Lot-level subcontractor assignment with ITP permissions
model LotSubcontractorAssignment {
  id                      String    @id @default(uuid())
  lotId                   String    @map("lot_id")
  subcontractorCompanyId  String    @map("subcontractor_company_id")
  projectId               String    @map("project_id")

  // ITP Permissions
  canCompleteITP          Boolean   @default(false) @map("can_complete_itp")
  itpRequiresVerification Boolean   @default(true) @map("itp_requires_verification")

  // Metadata
  status                  String    @default("active")
  assignedAt              DateTime  @default(now()) @map("assigned_at")
  assignedById            String?   @map("assigned_by_id")
  updatedAt               DateTime  @updatedAt @map("updated_at")

  lot                     Lot       @relation(fields: [lotId], references: [id], onDelete: Cascade)
  subcontractorCompany    SubcontractorCompany @relation(fields: [subcontractorCompanyId], references: [id])
  project                 Project   @relation(fields: [projectId], references: [id])
  assignedBy              User?     @relation("AssignedByUser", fields: [assignedById], references: [id], onDelete: SetNull)

  @@unique([lotId, subcontractorCompanyId])
  @@index([projectId])
  @@index([subcontractorCompanyId])
  @@map("lot_subcontractor_assignments")
}
```

**Step 2: Add relations to existing models**

Add to `Lot` model (after `assignedSubcontractor` relation):
```prisma
  subcontractorAssignments LotSubcontractorAssignment[]
```

Add to `SubcontractorCompany` model (after `assignedLots`):
```prisma
  lotAssignments          LotSubcontractorAssignment[]
```

Add to `Project` model:
```prisma
  lotSubcontractorAssignments LotSubcontractorAssignment[]
```

Add to `User` model (in the relations section):
```prisma
  assignedLotSubcontractors LotSubcontractorAssignment[] @relation("AssignedByUser")
```

**Step 3: Generate Prisma client**

Run: `cd backend && pnpm prisma generate`
Expected: "Generated Prisma Client"

**Step 4: Create migration**

Run: `cd backend && pnpm prisma migrate dev --name add_lot_subcontractor_assignments`
Expected: Migration created successfully

**Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add LotSubcontractorAssignment model for subcontractor ITP permissions"
```

---

## Task 2: Create Lot Assignments API Route

**Files:**
- Create: `backend/src/routes/lotAssignments.ts`
- Modify: `backend/src/index.ts`

**Step 1: Create the route file**

Create `backend/src/routes/lotAssignments.ts`:

```typescript
import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { requireAuth, requireRole } from '../middleware/authMiddleware.js'

export const lotAssignmentsRouter = Router()

// Roles that can manage lot assignments
const ASSIGNMENT_MANAGERS = ['owner', 'admin', 'project_manager', 'site_manager']

// POST /api/lots/:lotId/subcontractors - Assign subcontractor to lot
lotAssignmentsRouter.post('/:lotId/subcontractors', requireAuth, requireRole(ASSIGNMENT_MANAGERS), async (req, res) => {
  try {
    const { lotId } = req.params
    const { subcontractorCompanyId, canCompleteITP = false, itpRequiresVerification = true } = req.body
    const user = req.user!

    if (!subcontractorCompanyId) {
      return res.status(400).json({ error: 'subcontractorCompanyId is required' })
    }

    // Get lot with project info
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      select: { id: true, projectId: true }
    })

    if (!lot) {
      return res.status(404).json({ error: 'Lot not found' })
    }

    // Verify subcontractor belongs to this project
    const subcontractorCompany = await prisma.subcontractorCompany.findFirst({
      where: {
        id: subcontractorCompanyId,
        projectId: lot.projectId,
        status: 'approved'
      }
    })

    if (!subcontractorCompany) {
      return res.status(400).json({ error: 'Subcontractor not found or not approved for this project' })
    }

    // Check for existing assignment
    const existing = await prisma.lotSubcontractorAssignment.findUnique({
      where: {
        lotId_subcontractorCompanyId: { lotId, subcontractorCompanyId }
      }
    })

    if (existing && existing.status === 'active') {
      return res.status(409).json({ error: 'Subcontractor already assigned to this lot' })
    }

    // Create or reactivate assignment
    const assignment = existing
      ? await prisma.lotSubcontractorAssignment.update({
          where: { id: existing.id },
          data: {
            status: 'active',
            canCompleteITP,
            itpRequiresVerification,
            assignedById: user.id,
            assignedAt: new Date()
          },
          include: {
            subcontractorCompany: { select: { id: true, companyName: true } }
          }
        })
      : await prisma.lotSubcontractorAssignment.create({
          data: {
            lotId,
            subcontractorCompanyId,
            projectId: lot.projectId,
            canCompleteITP,
            itpRequiresVerification,
            assignedById: user.id
          },
          include: {
            subcontractorCompany: { select: { id: true, companyName: true } }
          }
        })

    res.status(201).json(assignment)
  } catch (error) {
    console.error('Assign subcontractor to lot error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/lots/:lotId/subcontractors - List assignments for a lot
lotAssignmentsRouter.get('/:lotId/subcontractors', requireAuth, async (req, res) => {
  try {
    const { lotId } = req.params
    const user = req.user!

    const assignments = await prisma.lotSubcontractorAssignment.findMany({
      where: {
        lotId,
        status: 'active'
      },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true, primaryContactName: true, primaryContactEmail: true }
        },
        assignedBy: {
          select: { id: true, fullName: true }
        }
      },
      orderBy: { assignedAt: 'desc' }
    })

    // If user is a subcontractor, only return their own assignment
    if (user.roleInCompany === 'subcontractor' || user.roleInCompany === 'subcontractor_admin') {
      const subcontractorUser = await prisma.subcontractorUser.findFirst({
        where: { userId: user.id }
      })

      if (subcontractorUser) {
        const filtered = assignments.filter(a => a.subcontractorCompanyId === subcontractorUser.subcontractorCompanyId)
        return res.json(filtered)
      }
      return res.json([])
    }

    res.json(assignments)
  } catch (error) {
    console.error('Get lot assignments error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/lots/:lotId/subcontractors/mine - Get current user's assignment
lotAssignmentsRouter.get('/:lotId/subcontractors/mine', requireAuth, async (req, res) => {
  try {
    const { lotId } = req.params
    const user = req.user!

    // Find user's subcontractor company
    const subcontractorUser = await prisma.subcontractorUser.findFirst({
      where: { userId: user.id }
    })

    if (!subcontractorUser) {
      return res.status(404).json({ error: 'Not a subcontractor' })
    }

    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: {
        lotId,
        subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
        status: 'active'
      },
      include: {
        subcontractorCompany: {
          select: { id: true, companyName: true }
        }
      }
    })

    if (!assignment) {
      return res.status(404).json({ error: 'No assignment found for this lot' })
    }

    res.json(assignment)
  } catch (error) {
    console.error('Get my lot assignment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/lots/:lotId/subcontractors/:assignmentId - Update assignment permissions
lotAssignmentsRouter.patch('/:lotId/subcontractors/:assignmentId', requireAuth, requireRole(ASSIGNMENT_MANAGERS), async (req, res) => {
  try {
    const { lotId, assignmentId } = req.params
    const { canCompleteITP, itpRequiresVerification } = req.body

    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: { id: assignmentId, lotId }
    })

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    const updated = await prisma.lotSubcontractorAssignment.update({
      where: { id: assignmentId },
      data: {
        ...(canCompleteITP !== undefined ? { canCompleteITP } : {}),
        ...(itpRequiresVerification !== undefined ? { itpRequiresVerification } : {})
      },
      include: {
        subcontractorCompany: { select: { id: true, companyName: true } }
      }
    })

    res.json(updated)
  } catch (error) {
    console.error('Update lot assignment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/lots/:lotId/subcontractors/:assignmentId - Remove assignment (soft delete)
lotAssignmentsRouter.delete('/:lotId/subcontractors/:assignmentId', requireAuth, requireRole(ASSIGNMENT_MANAGERS), async (req, res) => {
  try {
    const { lotId, assignmentId } = req.params

    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: { id: assignmentId, lotId }
    })

    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    await prisma.lotSubcontractorAssignment.update({
      where: { id: assignmentId },
      data: { status: 'removed' }
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Remove lot assignment error:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})
```

**Step 2: Register route in index.ts**

Add import at top of `backend/src/index.ts`:
```typescript
import { lotAssignmentsRouter } from './routes/lotAssignments.js'
```

Add route registration (after `app.use('/api/lots', lotsRouter)`):
```typescript
app.use('/api/lots', lotAssignmentsRouter)
```

**Step 3: Verify TypeScript compiles**

Run: `cd backend && pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/routes/lotAssignments.ts backend/src/index.ts
git commit -m "feat: add lot subcontractor assignment API endpoints"
```

---

## Task 3: Update ITP Completion Endpoint

**Files:**
- Modify: `backend/src/routes/itp.ts`

**Step 1: Update the completion logic**

Find the section around line 1233-1237 where `verificationStatus` is set:

```typescript
// Feature #271: Subcontractor completions require head contractor verification
let verificationStatus: string | undefined
if (isSubcontractor && isFinished && newStatus === 'completed') {
  verificationStatus = 'pending_verification'
}
```

Replace with:

```typescript
// Feature #271: Subcontractor completions - check lot assignment for ITP permissions
let verificationStatus: string | undefined
if (isSubcontractor && isFinished && newStatus === 'completed') {
  // Get the ITP instance to find the lot
  const itpInstanceForPermCheck = await prisma.iTPInstance.findUnique({
    where: { id: itpInstanceId },
    select: { lotId: true }
  })

  if (itpInstanceForPermCheck?.lotId && subcontractorUser) {
    // Check if subcontractor has ITP completion permission for this lot
    const assignment = await prisma.lotSubcontractorAssignment.findFirst({
      where: {
        lotId: itpInstanceForPermCheck.lotId,
        subcontractorCompanyId: subcontractorUser.subcontractorCompanyId,
        status: 'active',
        canCompleteITP: true
      }
    })

    if (!assignment) {
      return res.status(403).json({
        error: 'Not authorized to complete ITP items on this lot'
      })
    }

    // Set verification status based on assignment config
    verificationStatus = assignment.itpRequiresVerification
      ? 'pending_verification'
      : 'verified'
  } else {
    // Fallback to requiring verification if no assignment found
    verificationStatus = 'pending_verification'
  }
}
```

**Step 2: Update notification logic**

Find the section around line 1389-1391:

```typescript
// Feature #271: Notify head contractor when subcontractor completes an item
let subbieCompletionNotification = null
if (isSubcontractor && isFinished && newStatus === 'completed') {
```

Replace the condition with:

```typescript
// Feature #271: Notify head contractor when subcontractor completes an item (only if verification required)
let subbieCompletionNotification = null
if (isSubcontractor && isFinished && newStatus === 'completed' && verificationStatus === 'pending_verification') {
```

**Step 3: Verify TypeScript compiles**

Run: `cd backend && pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add backend/src/routes/itp.ts
git commit -m "feat: check lot assignment permissions for subcontractor ITP completion"
```

---

## Task 4: Migrate Existing Assignments

**Files:**
- Create: `backend/prisma/migrations/[timestamp]_migrate_existing_lot_assignments/migration.sql`

**Step 1: Create migration script**

Run: `cd backend && pnpm prisma migrate dev --name migrate_existing_lot_assignments --create-only`

Then edit the created migration file to add:

```sql
-- Migrate existing lot.assignedSubcontractorId to LotSubcontractorAssignment table
INSERT INTO "lot_subcontractor_assignments" (
  "id",
  "lot_id",
  "subcontractor_company_id",
  "project_id",
  "can_complete_itp",
  "itp_requires_verification",
  "status",
  "assigned_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  l."id",
  l."assigned_subcontractor_id",
  l."project_id",
  false,
  true,
  'active',
  NOW(),
  NOW()
FROM "lots" l
WHERE l."assigned_subcontractor_id" IS NOT NULL
ON CONFLICT ("lot_id", "subcontractor_company_id") DO NOTHING;
```

**Step 2: Run migration**

Run: `cd backend && pnpm prisma migrate dev`
Expected: Migration applied successfully

**Step 3: Commit**

```bash
git add backend/prisma/migrations/
git commit -m "feat: migrate existing lot subcontractor assignments to new table"
```

---

## Task 5: Update GET /api/lots to Include Assignments

**Files:**
- Modify: `backend/src/routes/lots.ts`

**Step 1: Update the lots query**

Find the `prisma.lot.findMany` call around line 60-84 and add `subcontractorAssignments` to the select:

```typescript
const lots = await prisma.lot.findMany({
  where: whereClause,
  select: {
    id: true,
    lotNumber: true,
    description: true,
    status: true,
    activityType: true,
    chainageStart: true,
    chainageEnd: true,
    offset: true,
    offsetCustom: true,
    layer: true,
    areaZone: true,
    budgetAmount: true,
    assignedSubcontractorId: true,
    assignedSubcontractor: {
      select: {
        companyName: true,
      }
    },
    // New: Include subcontractor assignments with ITP permissions
    subcontractorAssignments: {
      where: { status: 'active' },
      select: {
        id: true,
        subcontractorCompanyId: true,
        canCompleteITP: true,
        itpRequiresVerification: true,
        subcontractorCompany: {
          select: { id: true, companyName: true }
        }
      }
    },
    createdAt: true,
  },
  orderBy: { lotNumber: 'asc' },
})
```

**Step 2: Commit**

```bash
git add backend/src/routes/lots.ts
git commit -m "feat: include subcontractor assignments in GET /api/lots response"
```

---

## Task 6: Create AssignSubcontractorModal Component

**Files:**
- Create: `frontend/src/components/lots/AssignSubcontractorModal.tsx`

**Step 1: Create the modal component**

```tsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'

interface SubcontractorCompany {
  id: string
  companyName: string
  status: string
}

interface LotSubcontractorAssignment {
  id: string
  subcontractorCompanyId: string
  canCompleteITP: boolean
  itpRequiresVerification: boolean
  subcontractorCompany: {
    id: string
    companyName: string
  }
}

interface AssignSubcontractorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lotId: string
  lotNumber: string
  projectId: string
  existingAssignment?: LotSubcontractorAssignment | null
}

export function AssignSubcontractorModal({
  open,
  onOpenChange,
  lotId,
  lotNumber,
  projectId,
  existingAssignment
}: AssignSubcontractorModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const isEditing = !!existingAssignment

  const [selectedSubcontractor, setSelectedSubcontractor] = useState(
    existingAssignment?.subcontractorCompanyId || ''
  )
  const [canCompleteITP, setCanCompleteITP] = useState(
    existingAssignment?.canCompleteITP || false
  )
  const [itpRequiresVerification, setItpRequiresVerification] = useState(
    existingAssignment?.itpRequiresVerification ?? true
  )

  // Fetch approved subcontractors for this project
  const { data: subcontractors = [] } = useQuery({
    queryKey: ['subcontractors', projectId],
    queryFn: async () => {
      const response = await apiFetch<{ subcontractors: SubcontractorCompany[] }>(
        `/api/subcontractors?projectId=${projectId}`
      )
      return response.subcontractors.filter(s => s.status === 'approved')
    },
    enabled: open && !isEditing
  })

  // Fetch existing assignments to filter out already assigned subcontractors
  const { data: existingAssignments = [] } = useQuery({
    queryKey: ['lot-assignments', lotId],
    queryFn: () => apiFetch<LotSubcontractorAssignment[]>(`/api/lots/${lotId}/subcontractors`),
    enabled: open && !isEditing
  })

  const availableSubcontractors = subcontractors.filter(
    s => !existingAssignments.some(a => a.subcontractorCompanyId === s.id)
  )

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (isEditing && existingAssignment) {
        return apiFetch(`/api/lots/${lotId}/subcontractors/${existingAssignment.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ canCompleteITP, itpRequiresVerification })
        })
      }
      return apiFetch(`/api/lots/${lotId}/subcontractors`, {
        method: 'POST',
        body: JSON.stringify({
          subcontractorCompanyId: selectedSubcontractor,
          canCompleteITP,
          itpRequiresVerification
        })
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] })
      queryClient.invalidateQueries({ queryKey: ['lots'] })
      toast({
        title: isEditing ? 'Permissions updated' : 'Subcontractor assigned',
        description: isEditing
          ? 'ITP permissions have been updated.'
          : 'Subcontractor has been assigned to this lot.'
      })
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save assignment',
        variant: 'destructive'
      })
    }
  })

  const handleSubmit = () => {
    if (!isEditing && !selectedSubcontractor) {
      toast({
        title: 'Error',
        description: 'Please select a subcontractor',
        variant: 'destructive'
      })
      return
    }
    assignMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Subcontractor Permissions' : 'Assign Subcontractor'} - {lotNumber}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!isEditing && (
            <div className="space-y-2">
              <Label>Subcontractor Company</Label>
              <Select value={selectedSubcontractor} onValueChange={setSelectedSubcontractor}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subcontractor..." />
                </SelectTrigger>
                <SelectContent>
                  {availableSubcontractors.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableSubcontractors.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No available subcontractors. All approved subcontractors are already assigned.
                </p>
              )}
            </div>
          )}

          {isEditing && (
            <div className="text-sm text-muted-foreground">
              Editing permissions for: <strong>{existingAssignment?.subcontractorCompany.companyName}</strong>
            </div>
          )}

          <div className="space-y-3">
            <Label>ITP Permissions</Label>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="canCompleteITP"
                checked={canCompleteITP}
                onCheckedChange={(checked) => setCanCompleteITP(checked === true)}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="canCompleteITP"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Allow ITP completion
                </label>
                <p className="text-sm text-muted-foreground">
                  Subcontractor can complete checklist items
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="itpRequiresVerification"
                checked={itpRequiresVerification}
                onCheckedChange={(checked) => setItpRequiresVerification(checked === true)}
                disabled={!canCompleteITP}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="itpRequiresVerification"
                  className={`text-sm font-medium leading-none ${!canCompleteITP ? 'opacity-50' : ''}`}
                >
                  Require verification (recommended)
                </label>
                <p className={`text-sm text-muted-foreground ${!canCompleteITP ? 'opacity-50' : ''}`}>
                  Completions need head contractor approval
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={assignMutation.isPending || (!isEditing && !selectedSubcontractor)}
          >
            {assignMutation.isPending ? 'Saving...' : isEditing ? 'Save' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/src/components/lots/AssignSubcontractorModal.tsx
git commit -m "feat: add AssignSubcontractorModal component"
```

---

## Task 7: Add Subcontractor Section to LotDetailPage

**Files:**
- Modify: `frontend/src/pages/lots/LotDetailPage.tsx`

**Step 1: Add imports**

At the top of the file, add:
```tsx
import { AssignSubcontractorModal } from '@/components/lots/AssignSubcontractorModal'
```

**Step 2: Add state for modal**

In the component, add state:
```tsx
const [assignModalOpen, setAssignModalOpen] = useState(false)
const [editingAssignment, setEditingAssignment] = useState<LotSubcontractorAssignment | null>(null)
```

**Step 3: Add query for assignments**

Add a query to fetch assignments:
```tsx
const { data: assignments = [] } = useQuery({
  queryKey: ['lot-assignments', lotId],
  queryFn: () => apiFetch<LotSubcontractorAssignment[]>(`/api/lots/${lotId}/subcontractors`),
  enabled: !!lotId
})
```

**Step 4: Add remove mutation**

```tsx
const removeAssignmentMutation = useMutation({
  mutationFn: (assignmentId: string) =>
    apiFetch(`/api/lots/${lotId}/subcontractors/${assignmentId}`, { method: 'DELETE' }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['lot-assignments', lotId] })
    toast({ title: 'Subcontractor removed from lot' })
  }
})
```

**Step 5: Add Subcontractor Section JSX**

Add this section in the appropriate place in the UI (after the lot details section):

```tsx
{/* Subcontractor Assignments Section */}
<div className="rounded-lg border p-4">
  <div className="flex items-center justify-between mb-4">
    <h3 className="font-semibold">Assigned Subcontractors</h3>
    {canManageLot && (
      <Button size="sm" onClick={() => setAssignModalOpen(true)}>
        <Plus className="h-4 w-4 mr-1" />
        Add
      </Button>
    )}
  </div>

  {assignments.length === 0 ? (
    <p className="text-sm text-muted-foreground">No subcontractors assigned</p>
  ) : (
    <div className="space-y-2">
      {assignments.map(assignment => (
        <div key={assignment.id} className="flex items-center justify-between p-3 bg-muted rounded-md">
          <div>
            <div className="font-medium">{assignment.subcontractorCompany.companyName}</div>
            <div className="text-sm text-muted-foreground">
              ITP: {assignment.canCompleteITP ? (
                <>
                  <span className="text-green-600">Can complete</span>
                  {assignment.itpRequiresVerification && (
                    <span className="text-amber-600 ml-2">Requires verification</span>
                  )}
                </>
              ) : (
                <span className="text-gray-500">View only</span>
              )}
            </div>
          </div>
          {canManageLot && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingAssignment(assignment)
                  setAssignModalOpen(true)
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => removeAssignmentMutation.mutate(assignment.id)}
              >
                Remove
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )}
</div>

{/* Assignment Modal */}
<AssignSubcontractorModal
  open={assignModalOpen}
  onOpenChange={(open) => {
    setAssignModalOpen(open)
    if (!open) setEditingAssignment(null)
  }}
  lotId={lotId!}
  lotNumber={lot?.lotNumber || ''}
  projectId={lot?.projectId || ''}
  existingAssignment={editingAssignment}
/>
```

**Step 6: Add type definition**

Add at top of file or in types.ts:
```tsx
interface LotSubcontractorAssignment {
  id: string
  subcontractorCompanyId: string
  canCompleteITP: boolean
  itpRequiresVerification: boolean
  subcontractorCompany: {
    id: string
    companyName: string
  }
  assignedBy?: {
    id: string
    fullName: string
  }
}
```

**Step 7: Commit**

```bash
git add frontend/src/pages/lots/LotDetailPage.tsx frontend/src/pages/lots/types.ts
git commit -m "feat: add subcontractor assignments section to LotDetailPage"
```

---

## Task 8: Update MobileITPChecklist for Subcontractor Permissions

**Files:**
- Modify: `frontend/src/components/foreman/MobileITPChecklist.tsx`

**Step 1: Add query for user's assignment**

Add near the top of the component:
```tsx
const { data: myAssignment } = useQuery({
  queryKey: ['my-lot-assignment', lotId],
  queryFn: () => apiFetch<LotSubcontractorAssignment>(`/api/lots/${lotId}/subcontractors/mine`).catch(() => null),
  enabled: !!lotId && isSubcontractor
})
```

**Step 2: Calculate canComplete**

Add after the query:
```tsx
// Subcontractors need canCompleteITP permission, others can complete by default
const canCompleteItems = isSubcontractor ? (myAssignment?.canCompleteITP ?? false) : true
```

**Step 3: Update completion button**

Find where completion buttons are rendered and add the disabled state:

```tsx
disabled={!canCompleteItems || isItemLockedByHoldPoint(item)}
```

**Step 4: Add read-only notice for subcontractors without permission**

```tsx
{isSubcontractor && !canCompleteItems && (
  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
    <p className="text-sm text-amber-800">
      You can view this ITP but do not have permission to complete items.
      Contact the head contractor to request completion access.
    </p>
  </div>
)}
```

**Step 5: Commit**

```bash
git add frontend/src/components/foreman/MobileITPChecklist.tsx
git commit -m "feat: check subcontractor ITP permissions in MobileITPChecklist"
```

---

## Task 9: Test Full Flow

**Manual Testing Checklist:**

1. **As head contractor:**
   - [ ] Navigate to a lot detail page
   - [ ] Click "Add" in Assigned Subcontractors section
   - [ ] Select a subcontractor
   - [ ] Toggle "Allow ITP completion" on
   - [ ] Toggle "Require verification" on/off
   - [ ] Click Assign
   - [ ] Verify assignment appears in list
   - [ ] Click Edit, change permissions, save
   - [ ] Click Remove, verify subcontractor is removed

2. **As subcontractor (with canCompleteITP: false):**
   - [ ] Navigate to assigned lot
   - [ ] Open ITP checklist
   - [ ] Verify "View only" notice appears
   - [ ] Verify completion buttons are disabled

3. **As subcontractor (with canCompleteITP: true, itpRequiresVerification: true):**
   - [ ] Navigate to assigned lot
   - [ ] Open ITP checklist
   - [ ] Complete an item
   - [ ] Verify status shows "Awaiting verification"

4. **As subcontractor (with canCompleteITP: true, itpRequiresVerification: false):**
   - [ ] Navigate to assigned lot
   - [ ] Complete an item
   - [ ] Verify status shows "Completed" (auto-approved)

**Step: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```

---

## Summary

| Task | Description | Files Changed |
|------|-------------|---------------|
| 1 | Prisma model | schema.prisma |
| 2 | API endpoints | lotAssignments.ts, index.ts |
| 3 | ITP completion check | itp.ts |
| 4 | Data migration | migration.sql |
| 5 | Update GET /api/lots | lots.ts |
| 6 | Assignment modal | AssignSubcontractorModal.tsx |
| 7 | Lot detail section | LotDetailPage.tsx |
| 8 | Mobile ITP check | MobileITPChecklist.tsx |
| 9 | Manual testing | Various |

Total estimated commits: 9
