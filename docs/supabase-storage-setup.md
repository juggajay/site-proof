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

## Storage prefixes (one bucket, four prefixes)

All four customer-facing upload surfaces share the `documents` bucket and
differ only in the prefix they write under:

| Feature | Storage path inside `documents` bucket | Backend route file |
|---|---|---|
| General documents | `<projectId>/<unique>-<filename>` | `backend/src/routes/documents.ts` |
| Comment attachments | `comments/<projectId>/<unique>-<filename>` | `backend/src/routes/comments.ts` |
| Drawings | `drawings/<projectId>/<unique>-<filename>` | `backend/src/routes/drawings.ts` |
| Test result certificates | `certificates/<projectId>/cert-<unique>.<ext>` | `backend/src/routes/testResults.ts` |

The full public URL for a stored object is:

```
https://vhlvutvzdliwxorfhxxv.supabase.co/storage/v1/object/public/documents/<prefix>/<projectId>/<filename>
```

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

End-to-end production smoke tests have verified the full lifecycle
(upload → durable Supabase object → public download → delete →
Supabase object removed → bucket prefix empty) for:

| Flow | Single upload | Batch upload | Download | Delete removes Supabase object |
|---|---|---|---|---|
| Documents | ✅ | n/a | ✅ | ✅ |
| Comment attachments | ✅ | n/a | ✅ | ✅ |
| Drawings | ✅ | n/a | ✅ | ✅ |
| Test result certificates | ✅ | ✅ | ✅ | ✅ |

For each surface, deleting through the app:
- Atomically deletes the linked `documents` row.
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

## Known follow-ups (not solved by this doc)

These are separate from the cutover and are documented here so future
sessions know they remain open:

- **2 orphan `documents` rows** from the earlier post-cutover smoke
  test still exist for the test project's `certificates/` prefix.
  These point at Supabase object paths that no longer exist (the
  storage objects were cleaned up manually after the leak was found).
  No automated cleanup yet — leave them in place until the broader
  orphan-audit follow-up decides on policy. Do not run a one-shot
  `DELETE FROM documents` without explicit approval.
- **Historic orphan-audit follow-up** covers the larger pre-cutover
  residue: roughly 9 cert/drawing rows pointing at the deprovisioned
  `dwumiirtsuqxratjjvhb` host, plus 11 comment_attachment rows with
  bare `/uploads/...` paths from when comment attachments were on
  Railway disk. Files are unrecoverable; what to do with the DB rows
  (broken-link UI, admin restore, archive, hard-delete) is a product
  decision.
- **Avatars and company logos** still write to ephemeral Railway disk
  (`/uploads/avatars/`, `/uploads/company-logos/`). Both tables are
  currently empty in production so there is no live data loss, but the
  moment a customer uploads via those features, files start dying on
  every redeploy. Lower priority because they are non-customer-facing
  and self-recoverable (a user can re-upload an avatar), but they
  should follow the same migration shape as PR #4 and PR #5.
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
  project is deprovisioned; the file is gone (see historic
  orphan-audit follow-up).
- If `file_url` starts with `/uploads/...`: that file is on the
  container's ephemeral disk and was wiped on a previous redeploy.

### After cutover, an old DB row references the dead project
Do not "fix" by editing `file_url` to point at the new host — the
file is not there. Leave the row as-is until the orphan-audit
follow-up runs.

## Related documentation

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- Top-level developer guide: [`CLAUDE.md`](../CLAUDE.md)
