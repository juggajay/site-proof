# SiteProof v3 - Developer Guide

Construction quality management platform for civil contractors. Manages lots, ITPs, hold points, NCRs, daily diaries, dockets, progress claims, and documents.

## Quick Start

```bash
# Backend (runs on :3001)
cd backend && pnpm install && pnpm dev

# Frontend (runs on :5174)
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
| State | TanStack Query (server state) |
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
import { requireAuth } from '../middleware/authMiddleware.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

router.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id
  // ... handler logic
})

export { router as exampleRouter }
```

## Error Handling

### Backend
```typescript
// Errors bubble to global errorHandler middleware
// Throw with statusCode and code for proper handling
const error = new Error('Resource not found') as any
error.statusCode = 404
error.code = 'NOT_FOUND'
throw error

// Response format: { error: { message, code, stack? } }
```

- Global `errorHandler` in `backend/src/middleware/errorHandler.ts`
- Logs to `backend/logs/errors.log` with structured JSON
- 500+ errors logged as `error`, 4xx as `warn`
- Stack traces only in development

### Frontend
```typescript
import { apiFetch, ApiError } from '@/lib/api'

try {
  const data = await apiFetch<Lot>('/api/lots/123')
} catch (err) {
  if (err instanceof ApiError) {
    // err.status: HTTP status code
    // err.body: Response body text
    console.error(`API Error ${err.status}:`, err.body)
  }
}
```

- `ApiError` class wraps non-OK responses
- TanStack Query handles retries and error states automatically
- Use `error` property from `useQuery`/`useMutation` for UI feedback

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
FRONTEND_URL=http://localhost:5174
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

## Security Checklist

### Backend
- [ ] Always use `requireAuth` middleware on protected routes
- [ ] Check user permissions in route handler (don't trust client-side checks)
- [ ] Validate all input with Zod schemas before processing
- [ ] Use Prisma parameterized queries (never raw SQL with user input)
- [ ] Verify user belongs to company/project before returning data
- [ ] Never log sensitive data (tokens, passwords, API keys)
- [ ] Sanitize file names before storage upload

### Frontend
- [ ] Never store sensitive data in localStorage (except auth token)
- [ ] Use `RoleProtectedRoute` for page-level access control
- [ ] Validate forms with Zod before submission
- [ ] Don't expose internal IDs or error details to users
- [ ] Sanitize user-generated content before rendering

### Environment
- [ ] Keep `.env` files out of git (check `.gitignore`)
- [ ] Use different JWT_SECRET per environment
- [ ] Rotate Supabase service keys periodically
- [ ] Review Supabase RLS policies when adding tables

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

---

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests – then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` with patterns learned
