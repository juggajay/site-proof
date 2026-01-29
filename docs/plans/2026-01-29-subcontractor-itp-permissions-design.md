# Subcontractor ITP Permissions Design

**Date:** 2026-01-29
**Status:** Ready for Implementation

## Overview

Allow contractors to grant subcontractors permission to complete ITPs on specific lots, with optional verification requirement.

## Requirements

1. **Lot-level permissions** - Each lot assignment has independent ITP settings
2. **Two toggles:**
   - `canCompleteITP` - Enables subcontractor to complete checklist items
   - `itpRequiresVerification` - Completions need head contractor approval
3. **Full item access** - When enabled, subcontractor can complete all ITP items (hold points still lockable)
4. **Set during assignment, editable later** - Permissions configurable at assignment and from lot detail page
5. **Future-proof** - Supports multiple subcontractors per lot

## Data Model

### New Table: LotSubcontractorAssignment

```prisma
model LotSubcontractorAssignment {
  id                      String    @id @default(cuid())
  lotId                   String
  lot                     Lot       @relation(fields: [lotId], references: [id], onDelete: Cascade)
  subcontractorCompanyId  String
  subcontractorCompany    SubcontractorCompany @relation(fields: [subcontractorCompanyId], references: [id])
  projectId               String
  project                 Project   @relation(fields: [projectId], references: [id])

  // ITP Permissions
  canCompleteITP          Boolean   @default(false)
  itpRequiresVerification Boolean   @default(true)

  // Metadata
  status                  String    @default("active")  // active | removed
  assignedAt              DateTime  @default(now())
  assignedById            String?
  assignedBy              User?     @relation(fields: [assignedById], references: [id], onDelete: SetNull)
  updatedAt               DateTime  @updatedAt

  @@unique([lotId, subcontractorCompanyId])
  @@index([projectId])
  @@index([subcontractorCompanyId])
}
```

### Migration Notes

- Existing `lot.assignedSubcontractorId` data migrated to new table
- Default permissions: `canCompleteITP: false`, `itpRequiresVerification: true`
- Old column removed in separate cleanup migration after verification

## API Endpoints

### New Endpoints

| Method | Endpoint | Description | Permissions |
|--------|----------|-------------|-------------|
| POST | `/api/lots/:lotId/subcontractors` | Assign subcontractor to lot | owner, admin, project_manager, site_manager |
| PATCH | `/api/lots/:lotId/subcontractors/:assignmentId` | Update permissions | owner, admin, project_manager, site_manager |
| DELETE | `/api/lots/:lotId/subcontractors/:assignmentId` | Remove assignment (soft delete) | owner, admin, project_manager, site_manager |
| GET | `/api/lots/:lotId/subcontractors` | List assignments | All project members |
| GET | `/api/lots/:lotId/subcontractors/mine` | Get current user's assignment | Subcontractors |

### Modified Endpoints

**`POST /api/itp/completions`**
- Check `canCompleteITP` before allowing subcontractor completion
- Set `verificationStatus` based on `itpRequiresVerification`:
  - `true` → `pending_verification` (existing behavior)
  - `false` → `verified` (auto-approved)

**`GET /api/lots`**
- Include `subcontractorAssignments` in response

## Frontend Components

### 1. AssignSubcontractorModal

**Location:** `frontend/src/components/lots/AssignSubcontractorModal.tsx`

Fields:
- Subcontractor dropdown (approved project subcontractors)
- "Allow ITP completion" checkbox (default: unchecked)
- "Require verification" checkbox (default: checked, disabled unless ITP completion enabled)

### 2. Lot Detail Page - Subcontractor Section

**Location:** `frontend/src/pages/lots/LotDetailPage.tsx`

New section showing:
- List of assigned subcontractors
- ITP permission status for each
- Edit/Remove actions
- Add button to open assignment modal

### 3. MobileITPChecklist Updates

**Location:** `frontend/src/components/foreman/MobileITPChecklist.tsx`

- Fetch assignment via `/api/lots/:lotId/subcontractors/mine`
- If `canCompleteITP: false` → Read-only view
- If `canCompleteITP: true` → Full completion UI
- Show appropriate status badges after completion

## Verification Flow

### When `itpRequiresVerification: true`

```
Subcontractor completes item
        ↓
verificationStatus: pending_verification
        ↓
Notification to project managers
        ↓
Head contractor verifies/rejects
```

### When `itpRequiresVerification: false`

```
Subcontractor completes item
        ↓
verificationStatus: verified (auto-approved)
        ↓
No notification needed
```

## Implementation Order

| Phase | Task | Files |
|-------|------|-------|
| 1 | Add Prisma model + migration | `schema.prisma`, migration SQL |
| 2 | Create assignment API endpoints | `backend/src/routes/lotAssignments.ts` |
| 3 | Update ITP completion endpoint | `backend/src/routes/itp.ts` |
| 4 | Migrate existing assignments | Migration script |
| 5 | Add AssignSubcontractorModal | `frontend/src/components/lots/AssignSubcontractorModal.tsx` |
| 6 | Add subcontractor section to LotDetailPage | `frontend/src/pages/lots/LotDetailPage.tsx` |
| 7 | Update MobileITPChecklist permissions | `frontend/src/components/foreman/MobileITPChecklist.tsx` |
| 8 | Test full flow | Manual + E2E tests |
| 9 | Remove old `assignedSubcontractorId` | Cleanup migration (later) |

## User Flows

### Contractor Assigning Subcontractor

1. Opens lot detail page
2. Clicks "Add Subcontractor" in subcontractor section
3. Selects subcontractor from dropdown
4. Configures ITP permissions
5. Clicks "Assign"

### Contractor Editing Permissions

1. Opens lot detail page
2. Finds subcontractor in list
3. Clicks "Edit"
4. Modifies permissions
5. Clicks "Save"

### Subcontractor Completing ITP

1. Views assigned lot
2. Opens ITP checklist
3. If `canCompleteITP: true`:
   - Completes checklist items
   - Sees "Awaiting verification" or "Completed" based on settings
4. If `canCompleteITP: false`:
   - Views checklist as read-only

## Security Considerations

- Permission check on every ITP completion request
- Subcontractors only see their own assignments
- Soft delete preserves audit trail
- `assignedById` tracked for accountability
