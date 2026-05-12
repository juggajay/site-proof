# Supabase Storage Setup

## Overview

SiteProof uses **Supabase Storage** for durable file storage in production.
**Supabase is not the database** — the production database is Postgres hosted
on Railway. The Supabase project exists solely to hold uploaded files.

Railway's container filesystem is ephemeral: any files written to local
disk are lost when the container redeploys, restarts, or is moved. Anything
that needs to survive a redeploy must live in Supabase Storage (or be
migrated there).

## Project / bucket

- **Supabase project ref:** `vhlvutvzdliwxorfhxxv`
- **Public URL host:** `https://vhlvutvzdliwxorfhxxv.supabase.co`
- **Region:** Sydney (`ap-southeast-2`)
- **Bucket:** `documents`
- **Bucket visibility:** **public** (the app stores public
  `/storage/v1/object/public/documents/...` URLs in DB rows; the bucket
  must stay public for those links to resolve in browsers)

Previous project ref `dwumiirtsuqxratjjvhb` was deprovisioned by Supabase
after the free-tier 90-day deletion window. URLs referencing that host no
longer resolve and are unrecoverable.

## Storage prefixes (one bucket, six prefixes)

All six customer-facing upload surfaces share the `documents` bucket and
differ only in the prefix they write under. Project-scoped surfaces nest
under `<projectId>`; per-user / per-company surfaces nest under
`<userId>` / `<companyId>`.

| Feature | Storage path inside `documents` bucket | Backend route file |
|---|---|---|
| General documents | `<projectId>/<unique>-<filename>` | `backend/src/routes/documents.ts` |
| Comment attachments | `comments/<projectId>/<unique>-<filename>` | `backend/src/routes/comments.ts` |
| Drawings | `drawings/<projectId>/<unique>-<filename>` | `backend/src/routes/drawings.ts` |
| Test result certificates | `certificates/<projectId>/cert-<unique>.<ext>` | `backend/src/routes/testResults.ts` |
| Avatars | `avatars/<userId>/avatar-<userId>-<uuid>.<ext>` | `backend/src/routes/auth.ts` |
| Company logos | `company-logos/<companyId>/company-logo-<companyId>-<uuid>.<ext>` | `backend/src/routes/company.ts` |

The full public URL for a stored object is:

```
https://vhlvutvzdliwxorfhxxv.supabase.co/storage/v1/object/public/documents/<prefix>/<scope-id>/<filename>
```

where `<scope-id>` is the `projectId` for the first four surfaces, the
`userId` for avatars, or the `companyId` for company logos.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│   Frontend  │────▶│  Railway API    │────▶│ Supabase Storage │
│  (Vercel)   │     │   (Backend)     │     │   (documents)    │
└─────────────┘     └─────────────────┘     └──────────────────┘
                            │
                            ▼
                    ┌─────────────────┐
                    │ Railway Postgres│
                    │   (metadata)    │
                    └─────────────────┘
```

The backend holds the Supabase **service role key** and writes/reads on
the server side. The frontend renders public URLs directly (no Supabase
SDK required in the browser).

## Verified durable flows

All six customer-facing upload surfaces have been verified end-to-end
against production with a real owner account and throwaway 1×1 PNG /
PDF fixtures:

| Flow | Upload | Public download | Replacement removes old object | Delete removes Supabase object |
|---|---|---|---|---|
| Documents | ✅ | ✅ | n/a (new versions, prior objects retained by design) | ✅ |
| Comment attachments | ✅ | ✅ | n/a | ✅ |
| Drawings | ✅ | ✅ | ✅ (supersede creates a new object; old object retained until DELETE) | ✅ |
| Test result certificates | ✅ (single + batch) | ✅ | n/a | ✅ |
| Avatars | ✅ | ✅ | ✅ (POST `/api/auth/avatar` over an existing avatar) | ✅ (DELETE `/api/auth/avatar`) |
| Company logos | ✅ | ✅ | ✅ (POST `/api/company/logo`, or PATCH `/api/company` with a different `logoUrl`) | ✅ (PATCH `/api/company` with `logoUrl: ""` removes the previous Supabase object — PR #9) |

Smoke evidence:
- Documents / comments / drawings / certificates — PR #4 + PR #5 smokes
  (cert-DELETE leak found and fixed in PR #5; documented in PR #6).
- Avatars / company logos — PR #7 production smoke on 2026-05-12.
  Verified URL prefix, 200 on public GET after upload, 200 on the new
  URL after replacement, 4xx (Supabase storage 400) on the previous URL
  after replacement, and (for avatars) 4xx on the deleted URL after
  DELETE.
- Company-logo PATCH cleanup — PR #9 production smoke on 2026-05-12.
  Verified that PATCH `/api/company` with the same Supabase URL plus a
  querystring leaves the object intact (path-based comparison), and
  that PATCH `/api/company` with `logoUrl: ""` removes the previous
  Supabase object (cache-busted public GET returned 400).

For surfaces with a DELETE handler, deleting through the app:
- Atomically deletes the linked `documents` row (where applicable).
- Best-effort removes the Supabase object (failure is logged via
  `logWarn` so the DB remains the source of truth).

The implementations all follow the same shape in their respective route
files: a conditional `multer.memoryStorage()` when
`isSupabaseConfigured()` is true (else local `diskStorage`), a private
`upload*ToSupabase()` helper that builds the prefix path, and a
`delete*FromSupabase()` helper used by DELETE handlers and
transaction-failure rollback.

## Required production environment variables

In the Railway backend service (`site-proof` in project
`hearty-harmony`):

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Project URL, e.g. `https://vhlvutvzdliwxorfhxxv.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only secret). Required for upload + delete to work. |
| `SUPABASE_ANON_KEY` | Optional server-side. |
| `ALLOW_LOCAL_FILE_STORAGE` | Set to `false` explicitly in production. |

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are missing,
`isSupabaseConfigured()` returns false and upload routes silently fall
back to writing to the container's local disk. **That filesystem is
ephemeral.** Anything written there is lost on the next deploy. The
production env must always have these set.

For the **frontend** (Vercel): `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` should be left **blank** unless the frontend
needs direct browser Supabase access. Uploads go through the Railway
backend; the browser only needs the public file URL returned by the API.

## Operational warnings

These apply regardless of which file you are editing:

- **Never run `prisma db push` against production.** It is non-replayable
  schema-write that does not record migrations, can silently rewrite
  columns, and may drop data.
- **Never use `--accept-data-loss`** with any Prisma command. If a
  command warns about data loss, stop and surface the diff rather than
  forcing it through.
- **Railway deployments must not run `prisma db push` or
  `prisma migrate deploy` on startup or pre-deploy.** The Railway
  service's Custom Start Command and Pre-deploy Command for the backend
  must be blank, so the Dockerfile `CMD ["node", "dist/index.js"]` runs
  unchanged. Earlier deploys ran `npx prisma db push` as a Pre-deploy
  Command, which broke deploys and risked schema/data drift.
- **File uploads in production require Supabase env vars to be present.**
  See the table above. If those vars go missing, uploads silently fall
  back to ephemeral disk.
- **Never commit Supabase keys** (or the Railway database URL) to git.
  Keep credential scratch files inside `.gstack/` or another
  git-ignored directory.

## Backend code references

- `backend/src/lib/supabase.ts` — module-level Supabase client,
  `isSupabaseConfigured()`, `getSupabaseClient()`, `getSupabasePublicUrl()`,
  `getSupabaseStoragePath()`, and the `DOCUMENTS_BUCKET` constant
  (`'documents'`).
- `backend/src/routes/documents.ts` — general documents (single +
  versioning + delete).
- `backend/src/routes/comments.ts` — comment attachments under the
  `comments/` prefix.
- `backend/src/routes/drawings.ts` — drawings under the `drawings/`
  prefix (PR #4). DELETE removes the Supabase object.
- `backend/src/routes/testResults.ts` — single + batch certificate
  upload under the `certificates/` prefix (PR #4). DELETE handler in PR
  #5 added removal of the linked `Document` row + Supabase object.
- `backend/src/routes/auth.ts` — avatars under the `avatars/<userId>/`
  prefix (PR #7). POST replaces the previous avatar's Supabase object;
  DELETE removes the current one.
- `backend/src/routes/company.ts` — company logos under the
  `company-logos/<companyId>/` prefix (PR #7). POST `/api/company/logo`
  replaces the previous logo's Supabase object. PATCH `/api/company`
  with a `logoUrl` change also removes the previous object best-effort
  (PR #9). Cleanup compares Supabase storage paths (not raw URLs) so a
  PATCH that saves the same object with a different querystring keeps
  the active file intact.

## Known follow-ups (not solved by this doc)

These are separate from the cutover and are documented here so future
sessions know they remain open:

- **Orphan audit / cleanup is COMPLETE (2026-05-12).** PR #12 fixed the
  remaining comment-attachment Supabase-cleanup leak so new orphans do
  not accrue from that code path. The 24 operator-owned orphan DB rows
  surfaced by the audit were deleted in a single read-write
  SERIALIZABLE transaction:
  - 11 `documents` rows (5 dead-Supabase drawings + 4 local `/uploads/`
    documents + 2 current-Supabase certificate rows whose objects were
    already missing).
  - 13 `comment_attachments` rows (11 local `/uploads/` + 2
    `example.com` test fixtures).

  Post-cleanup verification returned **0 rows** for every DB orphan
  check (existence-by-ID for both tables, plus re-runs of Q5 / Q6 / Q7
  / Q10 / Q15). The single PR #7 storage-only `company-logos/...`
  object was deleted via the Supabase Storage dashboard; the
  post-delete unauthenticated public GET against its path returns
  HTTP 400 with the Supabase "object missing" envelope. Backup of all
  24 deleted rows (sha256-hashed) was captured before deletion and
  retained for emergency restore.
- **Prisma migration drift / baseline** remains a separate workstream.
  The live schema has a few unique constraints declared in
  `prisma/schema.prisma` but not present in the database. Read-only
  duplicate checks have run; the data is compatible. Applying the
  constraints needs to be done deliberately (backup → drift SQL →
  review → apply → baseline migration history) and **not** with
  `prisma db push`.

## Local development

For local development, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
in `backend/.env` to either:
- The same production project (acceptable for a solo developer; uploads
  during dev will live in production storage), or
- A separate Supabase project dedicated to local/dev (recommended once
  there is real usage).

If both are blank, the backend falls back to writing to
`backend/uploads/...` on the local filesystem. That is fine for local
dev; it must not be relied on in production.

Tests are pinned to disk-storage mode via `vitest.config.ts`, which
clears `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_ANON_KEY` in the test env so upload tests never accidentally
hit a real Supabase project.

## Troubleshooting

### Upload returns 5xx with "Supabase upload failed"
- Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in the
  Railway backend env (Variables tab).
- Confirm the `documents` bucket exists in the Supabase project and is
  public.
- Check Railway logs for the error returned by `@supabase/supabase-js`.

### File link returns 404 / 400 from the public URL
- If `file_url` host matches the current `SUPABASE_URL` and the path
  starts with `/storage/v1/object/public/documents/`: confirm the
  object exists via the Supabase dashboard's Storage browser or a
  service-role list call. Could be a recent delete (cache may serve
  stale 200 briefly via CloudFlare).
- If `file_url` host is `dwumiirtsuqxratjjvhb.supabase.co`: that
  project is deprovisioned and every row of this shape was deleted by
  the 2026-05-12 orphan cleanup. A row matching this pattern in
  production now is **unexpected** — investigate how it got there
  (recent migration import? data restore?) before touching it.
- If `file_url` starts with `/uploads/...`: same as above — every such
  row was deleted on 2026-05-12. A new one is unexpected and worth
  investigating, not silently tolerated.

### After cutover, an old DB row references the dead project
Do not "fix" by editing `file_url` to point at the new host — the
file is not there. The 2026-05-12 orphan cleanup removed every such
row that existed at that time; if one reappears, investigate how it
got there before taking any action.

## Related documentation

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- Top-level developer guide: [`CLAUDE.md`](../CLAUDE.md)
