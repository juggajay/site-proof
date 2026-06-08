import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Request-shape coverage for the shared, standalone `uploadItpEvidencePhoto`.
 *
 * This is the single upload-then-attach used by BOTH the HC lot-detail path
 * (via `useLotPhotoUpload`) and the subcontractor portal page. The tests pin the
 * two behaviors that PR-c turned on for the subbie path (GPS geotag +
 * `encodeURIComponent` on the attachment URL), and the two that must stay OFF for
 * subbies (AI classification, offline/IndexedDB write-through): this function
 * performs ONLY the upload POST and the attach POST — nothing else.
 */

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn(), authFetch: vi.fn() };
});

// Mock only getGPSLocation; keep the real validation helpers/constants.
// `vi.hoisted` so the mock is initialized before the hoisted vi.mock factory.
const { getGPSLocationMock } = vi.hoisted(() => ({ getGPSLocationMock: vi.fn() }));
vi.mock('../lib/itpEvidence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/itpEvidence')>();
  return { ...actual, getGPSLocation: getGPSLocationMock };
});

import { apiFetch, authFetch } from '@/lib/api';
import { uploadItpEvidencePhoto } from './useLotPhotoUpload';

const ATTACHMENT = {
  id: 'attachment-1',
  documentId: 'document-1',
  document: {
    id: 'document-1',
    filename: 'photo.jpg',
    fileUrl: 'https://example.test/photo.jpg',
    caption: null,
    uploadedAt: '2026-06-08T00:00:00.000Z',
    uploadedBy: null,
    gpsLatitude: null,
    gpsLongitude: null,
  },
};

function mockUploadOk() {
  vi.mocked(authFetch).mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'document-1' }),
  } as unknown as Response);
  vi.mocked(apiFetch).mockResolvedValue({ attachment: ATTACHMENT });
}

const file = new File(['x'], 'site-photo.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => vi.clearAllMocks());

describe('uploadItpEvidencePhoto', () => {
  it('uploads the file with the documents-API metadata and returns the attachment', async () => {
    getGPSLocationMock.mockResolvedValue({ latitude: -33.8688, longitude: 151.2093 });
    mockUploadOk();

    const result = await uploadItpEvidencePhoto({
      projectId: 'project-1',
      lotId: 'lot-1',
      completionId: 'completion-1',
      file,
    });

    expect(result).toBe(ATTACHMENT);

    // The upload call is a multipart POST with the documents-API fields.
    expect(authFetch).toHaveBeenCalledTimes(1);
    const [uploadUrl, uploadOptions] = vi.mocked(authFetch).mock.calls[0] as [string, RequestInit];
    expect(uploadUrl).toBe('/api/documents/upload');
    expect(uploadOptions.method).toBe('POST');
    const formData = uploadOptions.body as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get('file')).toBe(file);
    expect(formData.get('projectId')).toBe('project-1');
    expect(formData.get('lotId')).toBe('lot-1');
    expect(formData.get('documentType')).toBe('photo');
    expect(formData.get('category')).toBe('itp_evidence');
    expect(String(formData.get('caption'))).toContain('ITP Evidence Photo - ');
  });

  it('sends the captured GPS coordinates on the attachment (geotag parity with HC)', async () => {
    getGPSLocationMock.mockResolvedValue({ latitude: -33.8688, longitude: 151.2093 });
    mockUploadOk();

    await uploadItpEvidencePhoto({
      projectId: 'project-1',
      lotId: 'lot-1',
      completionId: 'completion-1',
      file,
    });

    expect(getGPSLocationMock).toHaveBeenCalledTimes(1);
    const [, attachOptions] = vi.mocked(apiFetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(attachOptions.body as string);
    expect(body.gpsLatitude).toBe(-33.8688);
    expect(body.gpsLongitude).toBe(151.2093);
    expect(body.documentId).toBe('document-1');
  });

  it('sends null coordinates when no GPS fix is available (does not abort the upload)', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    mockUploadOk();

    await uploadItpEvidencePhoto({
      projectId: 'project-1',
      lotId: 'lot-1',
      completionId: 'completion-1',
      file,
    });

    const [, attachOptions] = vi.mocked(apiFetch).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(attachOptions.body as string);
    expect(body.gpsLatitude).toBeNull();
    expect(body.gpsLongitude).toBeNull();
  });

  it('encodeURIComponent-encodes the completionId in the attachment URL', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    mockUploadOk();

    await uploadItpEvidencePhoto({
      projectId: 'project-1',
      lotId: 'lot-1',
      completionId: 'a/b c',
      file,
    });

    const [attachUrl] = vi.mocked(apiFetch).mock.calls[0] as [string, RequestInit];
    expect(attachUrl).toBe(`/api/itp/completions/${encodeURIComponent('a/b c')}/attachments`);
    // The raw, unencoded id must never reach the URL.
    expect(attachUrl).not.toContain('a/b c');
  });

  it('does NOT classify the photo and makes NO extra requests (classify/offline stay off)', async () => {
    getGPSLocationMock.mockResolvedValue({ latitude: 1, longitude: 2 });
    mockUploadOk();

    await uploadItpEvidencePhoto({
      projectId: 'project-1',
      lotId: 'lot-1',
      completionId: 'completion-1',
      file,
    });

    // Exactly two requests: the upload (authFetch) and the attach (apiFetch).
    expect(authFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    // No AI classification endpoint is ever hit from this shared function.
    const allUrls = [
      ...vi.mocked(authFetch).mock.calls.map((c) => c[0]),
      ...vi.mocked(apiFetch).mock.calls.map((c) => c[0]),
    ];
    expect(allUrls.some((url) => typeof url === 'string' && url.includes('/classify'))).toBe(false);
    expect(
      allUrls.some((url) => typeof url === 'string' && url.includes('save-classification')),
    ).toBe(false);
  });

  it('throws when the upload response is not ok and never attempts the attach', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    vi.mocked(authFetch).mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'upload failed',
    } as unknown as Response);

    await expect(
      uploadItpEvidencePhoto({
        projectId: 'project-1',
        lotId: 'lot-1',
        completionId: 'completion-1',
        file,
      }),
    ).rejects.toMatchObject({ status: 500 });
    // The attach POST must not run after a failed upload.
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('requires projectId and lotId before doing any request', async () => {
    getGPSLocationMock.mockResolvedValue(null);

    await expect(
      uploadItpEvidencePhoto({
        projectId: undefined,
        lotId: 'lot-1',
        completionId: 'completion-1',
        file,
      }),
    ).rejects.toThrow('Project and lot are required to upload ITP evidence.');
    expect(authFetch).not.toHaveBeenCalled();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
