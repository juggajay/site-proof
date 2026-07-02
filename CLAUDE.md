# SiteProof v3 - Developer Guide

Construction quality management platform for civil contractors. Manages lots, ITPs, hold points, NCRs, daily diaries, dockets, progress claims, and documents.

For current workstream state, completed production/security work, and handoff
instructions for a fresh agent, read
[docs/agent-handoff.md](docs/agent-handoff.md).

## Quick Start

```bash
# Backend (runs on :3001)
cd backend && npm install && npm run dev

# Frontend (runs on :5174)
cd frontend && npm install && npm run dev
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
│   │   └── scripts/       # Script helpers and test coverage
│   ├── prisma/           # Database schema
│   └── src/**/*.test.ts  # Vitest unit tests colocated with code
│
└── docs/              # Project documentation
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, TailwindCSS, shadcn/ui |
| State | TanStack Query (server state) |
| Forms | React Hook Form + Zod validation |
| Backend | Express.js REST API |
| Database | PostgreSQL via Prisma ORM, **hosted on Railway** (project `hearty-harmony`). Supabase is **not** the database. |
| Auth | JWT, MFA support. Supabase Auth is **not** in use; the Supabase project is storage-only. |
| Storage | Supabase Storage. Single `documents` bucket in project `vhlvutvzdliwxorfhxxv`. Backend-mediated access is required for document, comment, drawing, test-certificate, and photo files; stored `supabase://documents/...` refs and legacy Supabase URLs are object locators, not UI access URLs. See [docs/supabase-storage-setup.md](docs/supabase-storage-setup.md). |
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
  // Canonical role names live in backend/src/lib/roles.ts.
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
import { AppError } from '../lib/AppError.js'

// Throw typed errors; they bubble to the global errorHandler middleware.
throw AppError.notFound('Lot')
throw AppError.badRequest('Cannot edit a claimed lot', { code: 'LOT_CLAIMED' })
throw AppError.forbidden('You do not have permission to edit lots')
throw AppError.fromZodError(validation.error)

// Response format: { error: { message, code, stack? } }
```

- Global `errorHandler` in `backend/src/middleware/errorHandler.ts`
- Logs to `backend/logs/errors.log` with structured JSON
- Production 5xx errors are captured by Sentry when `SENTRY_DSN` is configured
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
# Backend unit tests (many are DB-backed — see local test DB below)
cd backend && npm test

# Frontend unit tests
cd frontend && npm run test:unit

# Frontend E2E tests
cd frontend && npm run test:e2e

# Type checking
cd backend && npm run type-check
cd frontend && npm run type-check
```

DB-backed backend tests run against a **local disposable Postgres**:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/siteproof_test
```

`src/test/databaseSafety.ts` refuses to run tests against non-local hosts or
databases whose name lacks a `test`/`e2e`/`ci` marker — never point tests at
Railway. Apply pending migrations to the test DB with
`DATABASE_URL=... npx prisma migrate deploy`.

### Code intelligence audit (fallow)

Every refactor/feature PR should run the advisory quality audit before opening
(from the repo root) and include the pass/warn/fail verdict in the PR body:

```bash
npm run fallow:audit    # audits only files changed vs origin/master
# scripting: fallow audit --base origin/master --format json --quiet || true
```

- Advisory, not a hard gate. `warn` on extraction PRs is often expected (moved
  complexity counts as "new"); investigate `fail` verdicts and new dead-code
  findings — do not "fix" them by weakening `.fallowrc.json`.
- If the `fallow` CLI is not installed (`npm install -g fallow`), say so in the
  PR body instead of skipping silently.
- The ITP template seeders are loaded dynamically via a manifest in
  `backend/scripts/seeds/itp-templates/index.mjs` and are marked
  `dynamicallyLoaded` in `.fallowrc.json` — they are not dead code.

## User Roles

Canonical role values and hierarchy live in `backend/src/lib/roles.ts`. Keep
route guards and docs aligned with that file.

| Role | Access Level |
|------|--------------|
| `owner` | Full access, company settings |
| `admin` | Full project access |
| `project_manager` | Project management, commercial data |
| `quality_manager` | Quality review, NCR, verification, and approval workflows |
| `site_manager` | Field operations, subcontractor management |
| `foreman` | Daily operations, diary, dockets |
| `site_engineer` | Site engineering support and assigned project work |
| `subcontractor_admin` | Subcontractor portal administration for their company |
| `subcontractor` | Own dockets, assigned work |
| `viewer` | Read-only project access where allowed |
| `member` | Base company membership; project permissions come from project assignments |

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...                # Railway Postgres
JWT_SECRET=...                               # >= 32 chars in production
ENCRYPTION_KEY=...                           # 64-char hex; required in production
SUPABASE_URL=https://xxx.supabase.co         # storage project; required in prod
SUPABASE_SERVICE_ROLE_KEY=...                # required in prod for uploads
SUPABASE_ANON_KEY=...                        # optional for server-side
ALLOW_LOCAL_FILE_STORAGE=false               # explicit in prod
RESEND_API_KEY=...
EMAIL_FROM="..."
FRONTEND_URL=https://...                     # https in prod, not localhost
CORS_ALLOWED_ORIGINS=https://...,https://... # optional extra frontend origins/aliases
BACKEND_URL=https://...                      # or API_URL; https in prod, not localhost
TRUST_PROXY=1                                # required behind Railway/CDN; do not use true in prod
SENTRY_DSN=...                               # required in production for backend error monitoring
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001
VITE_SENTRY_DSN=...                          # required in production for frontend error monitoring
# Leave VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY blank in Vercel production
# unless the frontend needs direct browser Supabase access — uploads go
# through the backend with the service role key.
```

## Operational Warnings

### Production database (Railway Postgres)
- **Never run `prisma db push` against production.** It does not record migrations and silently rewrites schema (and can drop data).
- **Never use `--accept-data-loss`** with any Prisma command. If a migration appears destructive, stop and surface it rather than forcing it through.
- **Railway deployments must not run `prisma db push` or `prisma migrate deploy` on startup or pre-deploy.** The Railway service's Custom Start Command and Pre-deploy Command for the backend must be blank (so the Dockerfile `CMD ["node", "dist/index.js"]` runs unchanged).
- Production Prisma migration drift was reconciled on 2026-05-13. The live database matches `backend/prisma/schema.prisma`, and the committed migrations are marked applied. Future schema changes must use reviewed Prisma migrations, not `prisma db push`.

### Production file storage (Supabase)
- File uploads in production **require** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the backend env. Without them, `isSupabaseConfigured()` returns false and uploads fall back to local Railway disk, which is **ephemeral** — files vanish on the next redeploy.
- Do not add new browser surfaces that render raw Supabase `fileUrl` values. Use `getDocumentAccessUrl`, `openDocumentAccessUrl`, `SecureDocumentImage`, or an authenticated backend download route. New upload flows should store `supabase://documents/...` refs where supported. The stored `/storage/v1/object/public/documents/...` values are legacy object locators and should not be treated as durable user-facing links.
- Never commit Supabase keys, the Railway database URL, or any production secret to git. Local credential scratch (e.g. `.gstack/dev-browser/new-supabase-credentials.txt`) lives under git-ignored directories — keep it that way.

## Common Tasks

### Add a new page
1. Create page component in `frontend/src/pages/{domain}/`
2. Add route in `frontend/src/App.tsx`
3. Add navigation link if needed

### Add a new API endpoint
1. Create/update route file in `backend/src/routes/`
2. Register in `backend/src/index.ts`
3. Add focused `*.test.ts` coverage next to the route or helper under `backend/src/`

### Add a database model
1. Update `backend/prisma/schema.prisma`
2. Run `cd backend && npm run db:migrate -- --name description`
3. Run `npm run db:generate`

### Seed global ITP templates
1. Review the seeder list without loading env or opening a DB connection:
   `cd backend && npm run seed:itp -- --list`
2. Preview a filtered run, for example:
   `cd backend && npm run seed:itp -- --state=qld --activity=structures`
3. Execute only with an approved target database:
   `cd backend && npm run seed:itp -- --state=qld --activity=structures --execute`

The seeders are additive and idempotent, but production runs still require an operator-approved plan and a recent backup.

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
- [ ] Keep the Supabase `documents` bucket private; all browser access goes through backend routes (app tables live in Railway Postgres — Supabase RLS is not involved)

## File Size Guidelines

Keep files under 500 lines. Large files should be split: extract reusable
components, move data fetching to custom hooks, separate form logic from
display.

Size lists in docs go stale fast — measure fresh before choosing a refactor
target:

```bash
git ls-files '*.ts' '*.tsx' | grep -vE '\.(test|spec)\.' | xargs wc -l | grep -v ' total$' | sort -rn | head -20
```

Prefer extracting from a large file only when a feature or bug fix already
touches that area, and keep changes behavior-preserving with characterization
coverage.

---

## Workflow Orchestration

### 1. Plan First
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- Write the plan to `tasks/todo.md` with checkable items and check in before
  starting implementation; mark items complete as you go and add a review
  section when done
- If something goes sideways, STOP and re-plan immediately — don't keep pushing

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

#### Model routing (defaults, not limits)

Applies when an expensive orchestrator (e.g. Fable) is dispatching work —
route subagent work to the cheapest model that meets the bar. Rankings
(higher = better). Cost = what we actually pay, not list price. Intelligence =
how hard a problem it can take unsupervised. Taste = UI/UX, code quality, API
design, copy.

| model | cost | intelligence | taste |
|-------|------|--------------|-------|
| gpt-5.5 | 9 | 8 | 5 |
| sonnet-5 | 5 | 5 | 7 |
| opus-4.8 | 4 | 7 | 8 |
| fable-5 | 2 | 9 | 9 |

Cost scores are **per task, not per token**. Sonnet 5's list price is 40%
below Opus 4.8's, but on agentic work it burns more tokens per task (more
tool calls, adaptive thinking on by default, verbose output) and measures
~15% more expensive per completed task (~$2.29 vs ~$2.00, Artificial
Analysis, mid-2026). That's why opus-4.8 outranks sonnet-5 on cost above —
default delegable subagent work to `model: 'opus'`. Re-measure if pricing
or model behavior changes.

How to apply:
- **These are defaults, not limits.** Standing permission to override: if a
  cheaper model's output doesn't meet the bar, rerun with a smarter one without
  asking. Judge the output, not the price tag — escalating costs less than
  shipping mediocre work.
- **Cost is a tie-breaker only.** When axes conflict for anything that ships:
  intelligence > taste > cost.
- **Bulk / mechanical work** (clear-spec implementation, data analysis,
  migrations): gpt-5.5 — effectively free.
- **Anything user-facing** (UI, copy, API design) needs taste ≥ 7.
- **Reviews of plans / implementations:** fable-5 or opus-4.8, optionally gpt-5.5
  as an extra independent perspective.
- **Never use Haiku.**
- **Mechanics:** gpt-5.5 is reachable only through the Codex CLI (`codex exec` /
  `codex review`; here via the `gstack-codex` skill / `codex exec -s read-only`
  with a self-contained prompt). Claude models (sonnet-5, opus-4.8, fable-5) run
  via the Agent/Workflow `model` parameter. To use gpt-5.5 inside a
  workflow/subagent, spawn a thin Claude wrapper (`model: 'sonnet'`,
  `effort: 'low'`) whose prompt tells it to write a self-contained codex prompt,
  run `codex exec` via Bash, and return the output.

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the
  pattern and a rule that prevents the same mistake
- Review lessons at session start

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Go fix failing CI tests without being told how
