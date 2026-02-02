# ITP Flexibility Design

## Overview

Remove blocking/locking behavior from ITP completion workflow. Allow users to complete checklist items in any order without system-enforced restrictions.

## Target Users

Tier 2/3 civil contractors who need flexibility in field workflows without bureaucratic friction.

## Design Principles

1. **Guidance over gates** - System informs, doesn't block
2. **Trust the user** - They know their job better than the software
3. **Labels not locks** - Hold points and witness points are categories, not enforcement mechanisms

## Changes

### 1. Remove Item Locking (Frontend)

**Files affected:**
- `frontend/src/components/itp/ITPChecklistSection.tsx`
- `frontend/src/components/itp/ITPChecklistItem.tsx`
- `frontend/src/pages/subcontractor-portal/SubcontractorLotITPPage.tsx`

**Current behavior:**
- `isItemLockedByHoldPoint()` function checks if preceding hold points are incomplete
- Locked items show lock icon and disabled state
- Users cannot interact with locked items

**New behavior:**
- Remove all locking logic
- All items always interactive
- Hold/witness points show distinct styling but don't restrict access

### 2. Remove Sequence Validation (Backend)

**Files affected:**
- `backend/src/routes/itp.ts`

**Current behavior:**
- May validate that preceding items are complete before allowing completion

**New behavior:**
- Accept completion for any item regardless of sequence
- No validation of item order

### 3. Project-Level Verification Setting

**Files affected:**
- `backend/prisma/schema.prisma` (Project model)
- `backend/src/routes/itp.ts` (completion endpoint)
- `frontend/src/pages/projects/ProjectSettingsPage.tsx`

**New setting:**
```
Project.settings.requireSubcontractorVerification: boolean (default: false)
```

**Behavior:**
- `true`: Subcontractor completions set to `pending_verification`
- `false`: Subcontractor completions auto-verified (status = `verified`)

## What Stays the Same

- ITP template structure (checklist items, point types)
- Completion records and status tracking
- NCR creation when items marked as failed
- Evidence/photo attachment workflow
- Signature capture functionality
- Notification system for witness points

## Migration

- Existing projects: No change to current behavior (verification stays on if currently on)
- New projects: Default to `requireSubcontractorVerification: false`

## Success Criteria

- Users can complete any checklist item at any time
- No "locked" or "blocked" states in the UI
- Hold points are visually distinct but not restrictive
- Project admins can toggle verification requirement

## Implementation Summary (Completed 2026-02-02)

### Frontend Changes

1. **`frontend/src/components/foreman/MobileITPChecklist.tsx`**
   - Removed `isItemLockedByHoldPoint()` function
   - Removed all `isLocked` props and conditionals
   - Removed lock icon and disabled states
   - All checklist items are now always interactive

2. **`frontend/src/pages/lots/LotDetailPage.tsx`**
   - Removed `isLockedByHoldPoint` calculation
   - Removed locked styling (opacity, background)
   - Removed disabled button states for locked items
   - Removed 🔒 Locked badge

3. **`frontend/src/pages/projects/settings/ProjectSettingsPage.tsx`**
   - Added `requireSubcontractorVerification` state
   - Added toggle in Notifications tab under "Subcontractor ITP Verification"
   - Setting persists to project.settings JSON

### Backend Changes

1. **`backend/src/routes/itp.ts`** (completions endpoint)
   - Updated subcontractor completion logic to check project settings
   - If `project.settings.requireSubcontractorVerification` is false → auto-verify
   - If true → use lot assignment's `itpRequiresVerification` setting
   - Default behavior: no verification required (auto-verified)

### No Schema Migration Required
- Uses existing `Project.settings` JSON field
- No database changes needed
