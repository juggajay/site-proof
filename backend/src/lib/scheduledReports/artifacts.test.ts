import fs from 'fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadScheduledReportArtifactBuffer, storeScheduledReportArtifact } from './artifacts.js';
import { resolveUploadPath } from '../uploadPaths.js';

vi.mock('../supabase.js', () => ({
  DOCUMENTS_BUCKET: 'documents',
  getSupabaseClient: vi.fn(() => {
    throw new Error('Supabase storage is not configured');
  }),
  getSupabaseStoragePath: vi.fn(() => null),
  getSupabaseStorageReference: vi.fn(
    (bucket: string, storagePath: string) => `supabase://${bucket}/${storagePath}`,
  ),
  isSupabaseConfigured: vi.fn(() => false),
}));

const createdArtifactUrls: string[] = [];

afterEach(async () => {
  await Promise.all(
    createdArtifactUrls.splice(0).map(async (artifactUrl) => {
      await fs.promises.unlink(resolveUploadPath(artifactUrl, 'scheduled-reports')).catch(() => {});
    }),
  );
});

describe('scheduled report artifacts', () => {
  it('adopts an existing local artifact when a retry stores the same run again', async () => {
    const projectId = `artifact-project-${Date.now()}`;
    const scheduleId = `artifact-schedule-${Date.now()}`;
    const runId = `artifact-run-${Date.now()}`;
    const pdfBuffer = Buffer.from('%PDF-1.4\nidempotent scheduled report\n');

    const firstStore = await storeScheduledReportArtifact({
      projectId,
      scheduleId,
      runId,
      reportName: 'Lot Status Report',
      pdfBuffer,
      now: new Date('2026-06-30T02:00:00.000Z'),
    });
    createdArtifactUrls.push(firstStore.artifactFileUrl);

    const secondStore = await storeScheduledReportArtifact({
      projectId,
      scheduleId,
      runId,
      reportName: 'Lot Status Report',
      pdfBuffer,
      now: new Date('2026-06-30T02:01:00.000Z'),
    });

    expect(secondStore.artifactFileUrl).toBe(firstStore.artifactFileUrl);
    expect(secondStore.artifactSha256).toBe(firstStore.artifactSha256);

    const loaded = await loadScheduledReportArtifactBuffer({
      id: runId,
      scheduleId,
      projectId,
      artifactFileUrl: firstStore.artifactFileUrl,
      artifactReportName: firstStore.artifactReportName,
      artifactFilename: firstStore.artifactFilename,
      artifactMimeType: firstStore.artifactMimeType,
      artifactFileSize: firstStore.artifactFileSize,
      artifactSha256: firstStore.artifactSha256,
    });

    expect(loaded.equals(pdfBuffer)).toBe(true);
  });
});
