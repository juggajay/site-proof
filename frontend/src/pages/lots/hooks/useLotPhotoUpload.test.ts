import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChangeEvent } from 'react';

/**
 * Coverage for the shared ITP evidence upload path.
 *
 * `uploadItpEvidencePhoto` is the single upload-then-attach used by BOTH the
 * HC lot-detail path (via `useLotPhotoUpload`) and the subcontractor portal
 * page. The tests pin the two behaviors that PR-c turned on for the subbie
 * path (GPS geotag + `encodeURIComponent` on the attachment URL) and that AI
 * classification stays OFF here: this function performs ONLY the upload POST
 * and the attach POST — nothing else.
 *
 * `uploadItpEvidencePhotoWithOfflineFallback` wraps it with the offline
 * pipeline: a retriable network failure (offline, timeout, fetch-level
 * failure, 5xx) queues the photo via capturePhotoOffline with an explicit ITP
 * completion attachment intent (the sync worker uploads then attaches it),
 * while a definitive 4xx is re-thrown. The hook-level
 * tests prove the handlers surface each outcome honestly (merge + toast,
 * "Saved Offline" toast, error path) and hold the shared in-flight guard.
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

vi.mock('@/lib/offlineDb', () => ({ capturePhotoOffline: vi.fn() }));
vi.mock('@/lib/auth', () => ({ useAuth: vi.fn(() => ({ user: { id: 'user-7' } })) }));
vi.mock('@/components/ui/toaster', () => ({ toast: vi.fn() }));
vi.mock('@/lib/errorHandling', () => ({ handleApiError: vi.fn() }));
vi.mock('@/lib/logger', () => ({ devLog: vi.fn(), devWarn: vi.fn(), logError: vi.fn() }));

import { apiFetch, ApiError, authFetch } from '@/lib/api';
import { capturePhotoOffline } from '@/lib/offlineDb';
import { handleApiError } from '@/lib/errorHandling';
import { toast } from '@/components/ui/toaster';
import {
  uploadItpEvidencePhoto,
  uploadItpEvidencePhotoWithOfflineFallback,
  useLotPhotoUpload,
} from './useLotPhotoUpload';
import type { ITPInstance } from '../types';

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
  vi.mocked(capturePhotoOffline).mockResolvedValue({ id: 'photo-1' } as Awaited<
    ReturnType<typeof capturePhotoOffline>
  >);
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
    // And no offline write: the pure function never touches the offline DB.
    expect(capturePhotoOffline).not.toHaveBeenCalled();
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

describe('uploadItpEvidencePhotoWithOfflineFallback', () => {
  const params = {
    projectId: 'project-1',
    lotId: 'lot-1',
    completionId: 'completion-1',
    checklistItemId: 'item-1',
    file,
    capturedBy: 'user-7',
  };

  it('returns the attachment and never touches the offline queue when the upload succeeds', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    mockUploadOk();

    const result = await uploadItpEvidencePhotoWithOfflineFallback(params);

    expect(result).toEqual({ status: 'attached', attachment: ATTACHMENT });
    expect(capturePhotoOffline).not.toHaveBeenCalled();
  });

  it("queues the photo through the offline pipeline with entityType 'itp' on a fetch-level failure", async () => {
    getGPSLocationMock.mockResolvedValue({ latitude: -33.8688, longitude: 151.2093 });
    vi.mocked(authFetch).mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await uploadItpEvidencePhotoWithOfflineFallback(params);

    expect(result).toEqual({ status: 'queued', photoId: 'photo-1' });
    expect(capturePhotoOffline).toHaveBeenCalledTimes(1);
    const [projectId, capturedFile, options] = vi.mocked(capturePhotoOffline).mock.calls[0];
    expect(projectId).toBe('project-1');
    expect(capturedFile).toBe(file);
    expect(options).toMatchObject({
      lotId: 'lot-1',
      entityType: 'itp',
      entityId: 'completion-1',
      completionId: 'completion-1',
      checklistItemId: 'item-1',
      attachAs: 'itp_completion_attachment',
      documentType: 'photo',
      category: 'itp_evidence',
      capturedBy: 'user-7',
      gpsLatitude: -33.8688,
      gpsLongitude: 151.2093,
    });
    expect(String(options.caption)).toContain('ITP Evidence Photo - ');
  });

  it('queues the photo when the upload responds with a 5xx', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    vi.mocked(authFetch).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'service unavailable',
    } as unknown as Response);

    const result = await uploadItpEvidencePhotoWithOfflineFallback(params);

    expect(result).toEqual({ status: 'queued', photoId: 'photo-1' });
    expect(capturePhotoOffline).toHaveBeenCalledTimes(1);
  });

  it('queues the photo when the upload succeeded but the attach step failed retriably', async () => {
    // Today this exact case orphans the document and drops the photo reference;
    // the fallback must queue the photo so the evidence still attaches later.
    getGPSLocationMock.mockResolvedValue(null);
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'document-1' }),
    } as unknown as Response);
    vi.mocked(apiFetch).mockRejectedValue(new ApiError(500, 'attach blew up'));

    const result = await uploadItpEvidencePhotoWithOfflineFallback(params);

    expect(result).toEqual({ status: 'queued', photoId: 'photo-1' });
    expect(capturePhotoOffline).toHaveBeenCalledTimes(1);
  });

  it('re-throws a definitive 4xx without queueing', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    vi.mocked(authFetch).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    } as unknown as Response);

    await expect(uploadItpEvidencePhotoWithOfflineFallback(params)).rejects.toMatchObject({
      status: 400,
    });
    expect(capturePhotoOffline).not.toHaveBeenCalled();
  });

  it('re-throws the missing project/lot guard error without queueing', async () => {
    await expect(
      uploadItpEvidencePhotoWithOfflineFallback({ ...params, projectId: undefined }),
    ).rejects.toThrow('Project and lot are required to upload ITP evidence.');
    expect(capturePhotoOffline).not.toHaveBeenCalled();
  });
});

describe('useLotPhotoUpload — handleAddPhoto outcomes', () => {
  const instanceFixture: ITPInstance = {
    id: 'instance-1',
    template: {
      id: 'template-1',
      name: 'Earthworks ITP',
      checklistItems: [
        {
          id: 'item-1',
          description: 'Compaction',
          category: 'General',
          responsibleParty: 'contractor',
          isHoldPoint: false,
          pointType: 'standard',
          evidenceRequired: 'photo',
          order: 0,
          testType: null,
          acceptanceCriteria: null,
        },
      ],
    },
    completions: [
      {
        id: 'completion-1',
        checklistItemId: 'item-1',
        isCompleted: false,
        isNotApplicable: false,
        isFailed: false,
        notes: null,
        completedAt: null,
        completedBy: null,
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        attachments: [],
      },
    ],
  } as unknown as ITPInstance;

  function setup() {
    const setItpInstance = vi.fn();
    const setUpdatingCompletion = vi.fn();
    const updatingCompletionRef = { current: null as string | null };
    const refetchReadiness = vi.fn();
    const rendered = renderHook(() =>
      useLotPhotoUpload({
        projectId: 'project-1',
        lotId: 'lot-1',
        itpInstance: instanceFixture,
        setItpInstance,
        setUpdatingCompletion,
        updatingCompletionRef,
        refetchReadiness,
      }),
    );
    return {
      rendered,
      setItpInstance,
      setUpdatingCompletion,
      updatingCompletionRef,
      refetchReadiness,
    };
  }

  function changeEvent() {
    return {
      target: { files: [file], value: 'site-photo.jpg' },
    } as unknown as ChangeEvent<HTMLInputElement>;
  }

  function expectItpPhotoQueuedForCompletion() {
    expect(capturePhotoOffline).toHaveBeenCalledWith(
      'project-1',
      file,
      expect.objectContaining({
        entityType: 'itp',
        entityId: 'completion-1',
        completionId: 'completion-1',
        checklistItemId: 'item-1',
        attachAs: 'itp_completion_attachment',
      }),
    );
  }

  it('success: merges the attachment into the instance and runs AI classification', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    vi.mocked(authFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'document-1' }),
    } as unknown as Response);
    vi.mocked(apiFetch).mockImplementation(async (url: string) => {
      if (url.includes('/attachments')) return { attachment: ATTACHMENT };
      if (url.includes('/classify')) {
        return {
          documentId: 'document-1',
          suggestedClassification: 'itp_evidence',
          confidence: 0.9,
          categories: ['itp_evidence'],
        };
      }
      throw new Error(`Unexpected apiFetch ${url}`);
    });
    const { rendered, setItpInstance, setUpdatingCompletion, refetchReadiness } = setup();

    await act(async () => {
      await rendered.result.current.handleAddPhoto('completion-1', 'item-1', changeEvent());
    });

    // The functional update must append the new attachment to the completion.
    const updater = setItpInstance.mock.calls[0][0] as (prev: ITPInstance) => ITPInstance;
    const next = updater(instanceFixture);
    expect(next.completions[0].attachments).toEqual([ATTACHMENT]);

    // A successful online attach refetches readiness (photos feed the readiness card).
    expect(refetchReadiness).toHaveBeenCalledTimes(1);

    // Classification ran and opened the modal.
    await waitFor(() =>
      expect(rendered.result.current.classificationModal).toMatchObject({
        documentId: 'document-1',
        filename: 'site-photo.jpg',
      }),
    );

    // The shared in-flight guard was held for the row, then released.
    expect(setUpdatingCompletion).toHaveBeenNthCalledWith(1, 'item-1');
    expect(setUpdatingCompletion).toHaveBeenLastCalledWith(null);
    expect(handleApiError).not.toHaveBeenCalled();
  });

  it('retriable failure: queues offline, toasts "Saved Offline", and skips merge + classification', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    vi.mocked(authFetch).mockRejectedValue(new TypeError('Failed to fetch'));
    const { rendered, setItpInstance, setUpdatingCompletion, updatingCompletionRef } = setup();

    await act(async () => {
      await rendered.result.current.handleAddPhoto('completion-1', 'item-1', changeEvent());
    });

    expectItpPhotoQueuedForCompletion();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Saved Offline',
        description: expect.stringContaining('saved on this device'),
      }),
    );
    // No attachment exists yet, so nothing is merged and nothing is classified.
    expect(setItpInstance).not.toHaveBeenCalled();
    const classifyHit = vi
      .mocked(apiFetch)
      .mock.calls.some(([url]) => typeof url === 'string' && url.includes('/classify'));
    expect(classifyHit).toBe(false);
    expect(handleApiError).not.toHaveBeenCalled();
    // Guard released even on the queued path.
    expect(setUpdatingCompletion).toHaveBeenLastCalledWith(null);
    expect(updatingCompletionRef.current).toBeNull();
  });

  it('definitive 4xx: surfaces the error and does not queue', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    vi.mocked(authFetch).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'validation failed',
    } as unknown as Response);
    const { rendered, setItpInstance } = setup();

    await act(async () => {
      await rendered.result.current.handleAddPhoto('completion-1', 'item-1', changeEvent());
    });

    expect(handleApiError).toHaveBeenCalledWith(expect.any(ApiError), 'Failed to upload photo');
    expect(capturePhotoOffline).not.toHaveBeenCalled();
    expect(setItpInstance).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved Offline' }));
  });

  it('blocks a double submit while the same item is already in flight', async () => {
    const { rendered, updatingCompletionRef } = setup();
    updatingCompletionRef.current = 'item-1';

    await act(async () => {
      await rendered.result.current.handleAddPhoto('completion-1', 'item-1', changeEvent());
    });

    expect(authFetch).not.toHaveBeenCalled();
    expect(capturePhotoOffline).not.toHaveBeenCalled();
  });

  it('mobile handler: queues offline and toasts "Saved Offline" on a retriable failure', async () => {
    getGPSLocationMock.mockResolvedValue(null);
    // Completion exists in the fixture, so no creation POST runs; the upload
    // itself dies at the fetch level and must fall back to the queue.
    vi.mocked(authFetch).mockRejectedValue(new TypeError('Failed to fetch'));
    const { rendered } = setup();

    await act(async () => {
      await rendered.result.current.handleMobileAddPhoto('item-1', file);
    });

    expectItpPhotoQueuedForCompletion();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Saved Offline' }));
    expect(handleApiError).not.toHaveBeenCalled();
  });
});
