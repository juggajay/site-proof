# SiteProof

Construction quality management platform for tracking inspections, hold points, and compliance documentation.

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- PostgreSQL client tools (`pg_dump` and `pg_restore`) for production backups

### Environment Variables

Create a `.env` file in the `backend` directory from `backend/.env.example`.
For local development, the defaults can point at local services. For production,
startup validation requires real public URLs, durable file storage, and strong
secrets.

```env
# Required in all deployed environments
DATABASE_URL=postgresql://user:password@db.example.com:5432/siteproof
JWT_SECRET=<32+ character random secret>
ENCRYPTION_KEY=<64 hex characters from 32 random bytes>
FRONTEND_URL=https://app.example.com
BACKEND_URL=https://api.example.com
API_URL=https://api.example.com

# Production email delivery
RESEND_API_KEY=re_live_key
EMAIL_FROM=noreply@example.com

# Production file storage
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>

# Optional but recommended production settings
RATE_LIMIT_STORE=database
SUPPORT_RATE_LIMIT_MAX=10
WEBHOOK_DELIVERY_TIMEOUT_MS=10000
ERROR_LOG_MAX_BYTES=5242880
GOOGLE_REDIRECT_URI=https://api.example.com/api/auth/google/callback
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:push@example.com
```

Create a `.env` file in the `frontend` directory from `frontend/.env.example`
for local development only. Production frontend builds validate public URLs at
build time. Use a same-origin API path when the backend is reverse-proxied under
the frontend domain, or a public HTTPS backend origin:

```env
VITE_API_URL=/api
# Leave blank unless browser Supabase access is enabled for a real project.
VITE_SUPABASE_URL=
```

Do not build production frontend assets with localhost, plain HTTP, or placeholder
`VITE_API_URL` / `VITE_SUPABASE_URL` values.

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Use the generated 64-character hex value directly for `ENCRYPTION_KEY`.
Use a separate generated value, or another high-entropy 32+ character value,
for `JWT_SECRET`.

### Installation

#### Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run migrate:status
npm run dev
```

Use `npx prisma migrate deploy` instead of `migrate dev` in production.
For existing databases, follow [MIGRATION.md](./MIGRATION.md) before marking the baseline migration as applied.

After building the backend and applying migrations in a staging or disposable
production-shaped environment, run the compiled-server smoke check:

```bash
cd backend
npm run build
npm run db:deploy
npm run smoke:production
npm run preflight:integrations
```

The smoke check starts `dist/index.js`, verifies `/health` and `/ready` through
trusted proxy HTTPS headers, and confirms plain HTTP redirects to `BACKEND_URL`.
The integration preflight validates production configuration and performs
read-only checks against configured Resend, Supabase Storage, Google OAuth, and
VAPID push settings.

The current production-readiness checklist and remaining live-verification
blockers are tracked in [docs/production-readiness-audit.md](./docs/production-readiness-audit.md).
When staging or production secrets are configured in GitHub Environments, run
the manual `Production Preflight` workflow before go-live to execute the same
integration checks against real services.

Build the backend container from the backend directory:

```bash
cd backend
docker build -t siteproof-backend .
```

If a corporate proxy or antivirus product intercepts TLS, export its trusted root
certificate as a PEM file and pass it as a BuildKit secret. Do not disable npm
SSL verification:

```bash
docker build --secret id=npm_extra_ca,src=/path/to/root-ca.pem -t siteproof-backend .
```

### Production Backups

Install PostgreSQL client tools on the machine that runs backup commands, then create and verify backups from the backend package:

```bash
cd backend
DATABASE_URL=postgresql://user:password@db.example.com:5432/siteproof npm run db:backup
npm run db:backup:list
npx tsx scripts/backup.ts verify <backup-file>
```

Restore is intentionally explicit because it is destructive:

```bash
cd backend
CONFIRM_RESTORE=<backup-file-name> DATABASE_URL=postgresql://user:password@db.example.com:5432/siteproof npx tsx scripts/backup.ts restore <backup-file>
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:5174` with the API at `http://localhost:3001`.
For production builds, set `VITE_API_URL=/api` or an HTTPS backend origin before
running `npm run build`.

## Architecture

### Frontend

- **React 18** - UI framework
- **Zustand** - State management
- **TailwindCSS** - Styling
- **React Query** - Server state management
- **React Router** - Client-side routing

### Backend

- **Express** - HTTP server
- **Prisma** - Database ORM
- **PostgreSQL** - Database
- **JWT** - Authentication tokens
- **bcrypt** - Password hashing

### Authentication

- JWT-based authentication with configurable expiry
- bcrypt password hashing (12 rounds)
- Optional two-factor authentication (TOTP)

## Security

See [SECURITY.md](./SECURITY.md) for detailed security documentation.

## License

Proprietary - All rights reserved.
