# Supabase Storage Setup for Document Uploads

## Overview

SiteProof uses **Supabase Storage** for persistent document storage in production. This was implemented to solve the issue where uploaded documents were lost when Railway redeployed the backend (Railway uses ephemeral filesystem storage).

## The Problem

Railway's filesystem is ephemeral - any files written to disk are lost when:
- The app redeploys (on every git push)
- The container restarts
- Railway scales or moves the instance

Documents uploaded via the `/api/documents/upload` endpoint were being stored locally at `/uploads/documents/` which meant they disappeared after each deployment.

## The Solution

Documents are now uploaded to **Supabase Storage** when the backend detects Supabase credentials are configured. The flow is:

1. User uploads file via frontend
2. Backend receives file in memory (using multer's `memoryStorage`)
3. Backend uploads file to Supabase Storage bucket
4. Backend stores the Supabase public URL in the database
5. Frontend fetches documents using Supabase URLs

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

## Files Modified

### Backend

**`backend/src/lib/supabase.ts`** (NEW)
- Supabase client initialization
- Helper functions: `isSupabaseConfigured()`, `getSupabasePublicUrl()`
- Exports `DOCUMENTS_BUCKET` constant

**`backend/src/routes/documents.ts`**
- Uses `memoryStorage` instead of `diskStorage` when Supabase is configured
- `uploadToSupabase()` function handles file uploads to Supabase
- `deleteFromSupabase()` function handles file deletion
- Upload routes store Supabase URLs in database instead of local paths

### Frontend

**`frontend/.env.production`**
- Added `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- These are used for direct Supabase access if needed in future

## Environment Variables

### Railway (Backend)

These must be set in Railway's environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Public anon key | `eyJhbGciOiJIUzI1NiIs...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (secret) | `eyJhbGciOiJIUzI1NiIs...` |

### Vercel (Frontend)

Optional - only needed if frontend directly accesses Supabase:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |

## Supabase Configuration

### Project Details
- **Organization:** juggajay's Org Site-Proof Development
- **Project Name:** SiteProof
- **Region:** (check Supabase dashboard)
- **Project URL:** `https://dwumiirtsuqxratjjvhb.supabase.co`

### Storage Bucket
- **Bucket Name:** `documents`
- **Public:** Yes (files are publicly accessible via URL)
- **File Path Pattern:** `{projectId}/{timestamp}-{random}-{filename}`

## How It Works

### Upload Flow

```typescript
// 1. Check if Supabase is configured
if (isSupabaseConfigured()) {
  // 2. Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(filePath, fileBuffer, {
      contentType: file.mimetype,
      upsert: false
    });

  // 3. Get public URL
  const fileUrl = getSupabasePublicUrl('documents', filePath);

  // 4. Store URL in database
  await prisma.document.create({
    data: {
      fileUrl: fileUrl,  // Supabase URL
      // ... other fields
    }
  });
} else {
  // Fallback to local storage (development only)
}
```

### Delete Flow

```typescript
// 1. Check if file is in Supabase
if (document.fileUrl.includes('supabase.co/storage')) {
  // 2. Extract path from URL
  const path = extractPathFromUrl(document.fileUrl);

  // 3. Delete from Supabase
  await supabase.storage.from('documents').remove([path]);
}

// 4. Delete database record
await prisma.document.delete({ where: { id } });
```

## Local Development

For local development, the backend falls back to local filesystem storage when Supabase credentials are not configured. This is detected by `isSupabaseConfigured()`:

```typescript
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey && supabaseUrl !== 'http://localhost:54321')
}
```

To test with Supabase locally, add the environment variables to your `.env` file.

## Migration Notes

### Orphaned Documents

Documents uploaded before this change (stored on Railway's filesystem) are now orphaned - the database records exist but the files are gone. These records should be deleted manually or via a cleanup script.

To identify orphaned documents:
```sql
SELECT * FROM "Document"
WHERE "fileUrl" LIKE '%railway.app/uploads/%';
```

### Future Uploads

All new uploads automatically go to Supabase Storage. No migration is needed for new documents.

## Troubleshooting

### "Failed to fetch" on upload
- Check Railway logs for Supabase errors
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Check Supabase dashboard for storage quota

### PDF not loading
- If URL contains `railway.app/uploads/` - file is orphaned (pre-migration)
- If URL contains `supabase.co/storage/` - check Supabase bucket permissions

### Supabase credentials not working
- Ensure you're using the **Service Role Key** (not anon key) for backend
- Service role key has full access to storage
- Check key hasn't expired

## Related Documentation

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)
- Backend routes: `backend/src/routes/documents.ts`
- Supabase client: `backend/src/lib/supabase.ts`
