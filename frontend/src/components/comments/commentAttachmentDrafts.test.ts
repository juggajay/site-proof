import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_FILE_SIZE,
  collectAttachmentDrafts,
  removeAttachmentDraftAt,
  revokeAttachmentPreviews,
  validateAttachmentFile,
  type PendingAttachment,
} from './commentAttachmentDrafts';

function makeFile(name: string, type: string, size = 1024): File {
  const file = new File(['x'], name, { type });
  // File contents would need to actually be `size` bytes long; override the
  // getter instead so size-limit tests don't allocate 10MB buffers.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
let createObjectURLMock: ReturnType<typeof vi.fn<(blob: Blob | MediaSource) => string>>;
let revokeObjectURLMock: ReturnType<typeof vi.fn<(url: string) => void>>;

beforeEach(() => {
  let previewCount = 0;
  createObjectURLMock = vi.fn(() => `blob:preview-${++previewCount}`);
  revokeObjectURLMock = vi.fn();
  URL.createObjectURL = createObjectURLMock;
  URL.revokeObjectURL = revokeObjectURLMock;
});

afterEach(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

describe('validateAttachmentFile', () => {
  it('accepts every allowed MIME type at exactly the size limit', () => {
    for (const type of ALLOWED_ATTACHMENT_TYPES) {
      expect(validateAttachmentFile(makeFile('a.bin', type, MAX_ATTACHMENT_FILE_SIZE))).toBeNull();
    }
  });

  it('rejects oversize files with the exact size message', () => {
    expect(
      validateAttachmentFile(makeFile('big.pdf', 'application/pdf', MAX_ATTACHMENT_FILE_SIZE + 1)),
    ).toBe('File "big.pdf" exceeds the 10MB size limit.');
  });

  it('rejects unsupported types with the exact format message', () => {
    expect(validateAttachmentFile(makeFile('run.exe', 'application/x-msdownload'))).toBe(
      'File "run.exe" is not a supported format. Allowed: images, PDF, Word, Excel, text files.',
    );
  });

  it('reports the size error first when both size and type are invalid', () => {
    expect(
      validateAttachmentFile(
        makeFile('big.exe', 'application/x-msdownload', MAX_ATTACHMENT_FILE_SIZE + 1),
      ),
    ).toBe('File "big.exe" exceeds the 10MB size limit.');
  });
});

describe('collectAttachmentDrafts', () => {
  it('creates preview URLs for images only', () => {
    const image = makeFile('photo.png', 'image/png');
    const doc = makeFile('spec.pdf', 'application/pdf');

    const { accepted, errors } = collectAttachmentDrafts([image, doc]);

    expect(errors).toEqual([]);
    expect(accepted).toEqual([
      { file: image, preview: 'blob:preview-1' },
      { file: doc, preview: undefined },
    ]);
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(createObjectURLMock).toHaveBeenCalledWith(image);
  });

  it('keeps valid files while reporting per-file errors in selection order', () => {
    const tooBig = makeFile('big.pdf', 'application/pdf', MAX_ATTACHMENT_FILE_SIZE + 1);
    const wrongType = makeFile('run.exe', 'application/x-msdownload');
    const ok = makeFile('notes.txt', 'text/plain');

    const { accepted, errors } = collectAttachmentDrafts([tooBig, wrongType, ok]);

    expect(accepted).toEqual([{ file: ok, preview: undefined }]);
    expect(errors).toEqual([
      'File "big.pdf" exceeds the 10MB size limit.',
      'File "run.exe" is not a supported format. Allowed: images, PDF, Word, Excel, text files.',
    ]);
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  it('returns empty results for an empty selection', () => {
    expect(collectAttachmentDrafts([])).toEqual({ accepted: [], errors: [] });
  });
});

describe('removeAttachmentDraftAt', () => {
  it('removes the draft at the index without mutating the input array', () => {
    const withPreview: PendingAttachment = {
      file: makeFile('a.png', 'image/png'),
      preview: 'blob:a',
    };
    const withoutPreview: PendingAttachment = { file: makeFile('b.pdf', 'application/pdf') };
    const drafts = [withPreview, withoutPreview];

    expect(removeAttachmentDraftAt(drafts, 0)).toEqual([withoutPreview]);
    expect(drafts).toEqual([withPreview, withoutPreview]);
  });

  it('revokes only the removed draft preview URL', () => {
    const drafts: PendingAttachment[] = [
      { file: makeFile('a.png', 'image/png'), preview: 'blob:a' },
      { file: makeFile('b.png', 'image/png'), preview: 'blob:b' },
    ];

    removeAttachmentDraftAt(drafts, 0);

    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:a');
  });

  it('does not revoke anything when the removed draft has no preview', () => {
    const drafts: PendingAttachment[] = [
      { file: makeFile('a.png', 'image/png'), preview: 'blob:a' },
      { file: makeFile('b.pdf', 'application/pdf') },
    ];

    removeAttachmentDraftAt(drafts, 1);

    expect(revokeObjectURLMock).not.toHaveBeenCalled();
  });
});

describe('revokeAttachmentPreviews', () => {
  it('revokes every preview URL and skips drafts without one', () => {
    const drafts: PendingAttachment[] = [
      { file: makeFile('a.png', 'image/png'), preview: 'blob:a' },
      { file: makeFile('b.pdf', 'application/pdf') },
      { file: makeFile('c.jpg', 'image/jpeg'), preview: 'blob:c' },
    ];

    revokeAttachmentPreviews(drafts);

    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2);
    expect(revokeObjectURLMock).toHaveBeenNthCalledWith(1, 'blob:a');
    expect(revokeObjectURLMock).toHaveBeenNthCalledWith(2, 'blob:c');
  });
});
