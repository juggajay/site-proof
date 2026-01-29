# SiteProof v2 - Developer Guide

Construction quality management platform for civil contractors. Manages lots, ITPs, hold points, NCRs, daily diaries, dockets, progress claims, and documents.

## Quick Start

```bash
# Backend (runs on :3001)
cd backend && pnpm install && pnpm dev

# Frontend (runs on :5173)
cd frontend && pnpm install && pnpm dev
```

## Architecture

```
site-proofv3/
├── frontend/          # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── components/    # UI components by domain
│   │   ├── pages/         # Route pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities (api, auth, pdfGenerator)
│   └── e2e/              # Playwright E2E tests
│
├── backend/           # Express + Prisma + TypeScript
│   ├── src/
│   │   ├── routes/        # REST API endpoints
│   │   ├── middleware/    # Auth, rate limiting, error handling
│   │   ├── lib/           # Utilities (email, roles, encryption)
│   │   └── trpc/          # tRPC router (type-safe API)
│   ├── prisma/           # Database schema
│   └── test/             # Vitest unit tests
│
└── docs/              # Project documentation
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TailwindCSS, shadcn/ui |
| State | TanStack Query (server), Zustand (client) |
| Forms | React Hook Form + Zod validation |
| Backend | Express.js, tRPC v10 |
| Database | PostgreSQL via Prisma ORM (Supabase hosted) |
| Auth | JWT + Supabase Auth, MFA support |
| Storage | Supabase Storage for documents |
| Email | Resend |

## Key Patterns

### API Calls (Frontend)
```tsx
import { apiUrl, apiFetch } from '@/lib/api'

// Simple fetch
const data = await apiFetch<Lot[]>('/api/lots')

// With options
const lot = await apiFetch<Lot>('/api/lots', {
  method: 'POST',
  body: JSON.stringify(lotData)
})
```

### Authentication
```tsx
import { useAuth } from '@/lib/auth'

function Component() {
  const { user, signIn, signOut } = useAuth()
  // user.role: 'owner' | 'admin' | 'project_manager' | 'site_manager' | 'foreman' | 'subcontractor'
}
```

### Role-Based Access
```tsx
import { useCommercialAccess } from '@/hooks/useCommercialAccess'
import { RoleProtectedRoute } from '@/components/auth/RoleProtectedRoute'

// In components
const { hasAccess } = useCommercialAccess()

// In routes (App.tsx)
<RoleProtectedRoute allowedRoles={['owner', 'admin', 'project_manager']}>
  <ClaimsPage />
</RoleProtectedRoute>
```

### Backend Route Pattern
```typescript
// backend/src/routes/example.ts
import { Router } from 'express'
import { authenticateToken } from '../middleware/authMiddleware.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user!.id
  // ... handler logic
})

export { router as exampleRouter }
```

## Database Schema

Core models (see `backend/prisma/schema.prisma`):

- **Company** → Users, Projects
- **Project** → Lots, ITPs, NCRs, Diaries, Dockets, Claims, Documents
- **Lot** → ITPCompletions, TestResults, HoldPointCompletions
- **User** → ProjectUser (role per project)

## Testing

```bash
# Backend unit tests (252 tests)
cd backend && pnpm test

# Frontend E2E tests
cd frontend && pnpm test:e2e

# Type checking
cd backend && pnpm tsc --noEmit
cd frontend && pnpm tsc --noEmit
```

## User Roles

| Role | Access Level |
|------|--------------|
| `owner` | Full access, company settings |
| `admin` | Full project access |
| `project_manager` | Project management, commercial data |
| `site_manager` | Field operations, subcontractor management |
| `foreman` | Daily operations, diary, dockets |
| `subcontractor` | Own dockets, assigned work |

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=...
RESEND_API_KEY=...
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

## Common Tasks

### Add a new page
1. Create page component in `frontend/src/pages/{domain}/`
2. Add route in `frontend/src/App.tsx`
3. Add navigation link if needed

### Add a new API endpoint
1. Create/update route file in `backend/src/routes/`
2. Register in `backend/src/index.ts`
3. Add tests in `backend/test/`

### Add a database model
1. Update `backend/prisma/schema.prisma`
2. Run `cd backend && pnpm prisma migrate dev --name description`
3. Run `pnpm prisma generate`

## Code Style

- TypeScript strict mode
- Functional components with hooks
- Server state via TanStack Query
- Form validation with Zod schemas
- Error boundaries at page level
- Consistent API error handling

## File Size Guidelines

Keep files under 500 lines. Large files should be split:
- Extract reusable components
- Move data fetching to custom hooks
- Separate form logic from display

## Known Large Files (Refactoring Targets)

These files need component extraction:
- `LotDetailPage.tsx` (4,516 lines)
- `LotsPage.tsx` (3,363 lines)
- `pdfGenerator.ts` (2,915 lines)
- `DailyDiaryPage.tsx` (2,669 lines)
