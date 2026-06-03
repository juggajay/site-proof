import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVISION_FORM,
  DEFAULT_UPLOAD_FORM,
  buildDrawingRevisionFormData,
  buildDrawingSupersedePath,
  buildDrawingUploadFormData,
  buildDrawingUploadPath,
  formatFileSize,
  getMutationDrawing,
  getResponseErrorMessage,
  isDrawingRevisionReady,
  isDrawingUploadReady,
  normalizeRevisionForm,
  normalizeUploadForm,
  type Drawing,
  type DrawingRevisionForm,
  type DrawingUploadForm,
} from './drawingsUploadData';

function makeFile(name = 'plan.pdf'): File {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' });
}

const baseDrawing: Drawing = {
  id: 'drawing-1',
  drawingNumber: 'DWG-001',
  title: 'Site Plan',
  revision: 'A',
  issueDate: '2026-05-01T00:00:00.000Z',
  status: 'for_construction',
  createdAt: '2026-05-01T00:00:00.000Z',
  document: {
    id: 'doc-1',
    filename: 'site-plan.pdf',
    fileUrl: '/uploads/drawings/site-plan.pdf',
    fileSize: 1048576,
    mimeType: 'application/pdf',
    uploadedAt: '2026-05-01T00:00:00.000Z',
    uploadedBy: { id: 'u-1', fullName: 'E2E Admin', email: 'admin@example.com' },
  },
  supersededBy: null,
  supersedes: [],
};

// A minimal Response stub — getResponseErrorMessage only ever calls res.json().
function jsonResponse(payload: unknown): Response {
  return { json: async () => payload } as unknown as Response;
}
function throwingResponse(): Response {
  return {
    json: async () => {
      throw new Error('invalid json');
    },
  } as unknown as Response;
}

describe('drawings upload data helpers', () => {
  describe('path builders', () => {
    it('builds the drawing upload path', () => {
      expect(buildDrawingUploadPath()).toBe('/api/drawings');
    });

    it('builds and encodes the supersede path', () => {
      expect(buildDrawingSupersedePath('drawing-1')).toBe('/api/drawings/drawing-1/supersede');
      expect(buildDrawingSupersedePath('a/b c')).toBe('/api/drawings/a%2Fb%20c/supersede');
    });
  });

  describe('getResponseErrorMessage', () => {
    it('returns a string error field', async () => {
      await expect(getResponseErrorMessage(jsonResponse({ error: 'too big' }), 'fb')).resolves.toBe(
        'too big',
      );
    });

    it('returns a nested error.message field', async () => {
      await expect(
        getResponseErrorMessage(jsonResponse({ error: { message: 'nested' } }), 'fb'),
      ).resolves.toBe('nested');
    });

    it('falls back to the message field', async () => {
      await expect(
        getResponseErrorMessage(jsonResponse({ message: 'plain message' }), 'fb'),
      ).resolves.toBe('plain message');
    });

    it('uses the fallback when no recognizable field is present', async () => {
      await expect(getResponseErrorMessage(jsonResponse({}), 'fallback')).resolves.toBe('fallback');
    });

    it('uses the fallback when the body is not JSON', async () => {
      await expect(getResponseErrorMessage(throwingResponse(), 'fallback')).resolves.toBe(
        'fallback',
      );
    });
  });

  describe('getMutationDrawing', () => {
    it('returns a bare drawing payload directly', () => {
      expect(getMutationDrawing(baseDrawing)).toBe(baseDrawing);
    });

    it('unwraps a { drawing } envelope', () => {
      expect(getMutationDrawing({ drawing: baseDrawing })).toBe(baseDrawing);
    });

    it('returns undefined for a message-only envelope', () => {
      expect(getMutationDrawing({ message: 'done' })).toBeUndefined();
    });
  });

  describe('form normalization', () => {
    it('trims upload number/title/revision and preserves the rest', () => {
      const form: DrawingUploadForm = {
        drawingNumber: '  DWG-9  ',
        title: '  Plan  ',
        revision: '  B  ',
        issueDate: '2026-05-09',
        status: 'for_construction',
      };
      expect(normalizeUploadForm(form)).toEqual({
        drawingNumber: 'DWG-9',
        title: 'Plan',
        revision: 'B',
        issueDate: '2026-05-09',
        status: 'for_construction',
      });
    });

    it('trims revision number/title and preserves the rest', () => {
      const form: DrawingRevisionForm = {
        revision: '  C  ',
        title: '  Issued  ',
        issueDate: '2026-05-10',
        status: 'as_built',
      };
      expect(normalizeRevisionForm(form)).toEqual({
        revision: 'C',
        title: 'Issued',
        issueDate: '2026-05-10',
        status: 'as_built',
      });
    });
  });

  describe('readiness checks', () => {
    it('requires a file and a non-blank drawing number to upload', () => {
      expect(
        isDrawingUploadReady(makeFile(), { ...DEFAULT_UPLOAD_FORM, drawingNumber: 'DWG-1' }),
      ).toBe(true);
      expect(isDrawingUploadReady(null, { ...DEFAULT_UPLOAD_FORM, drawingNumber: 'DWG-1' })).toBe(
        false,
      );
      expect(
        isDrawingUploadReady(makeFile(), { ...DEFAULT_UPLOAD_FORM, drawingNumber: '   ' }),
      ).toBe(false);
    });

    it('requires a file and a non-blank revision to supersede', () => {
      expect(isDrawingRevisionReady(makeFile(), { ...DEFAULT_REVISION_FORM, revision: 'B' })).toBe(
        true,
      );
      expect(isDrawingRevisionReady(null, { ...DEFAULT_REVISION_FORM, revision: 'B' })).toBe(false);
      expect(isDrawingRevisionReady(makeFile(), { ...DEFAULT_REVISION_FORM, revision: '  ' })).toBe(
        false,
      );
    });
  });

  describe('buildDrawingUploadFormData', () => {
    it('appends required fields and includes optional fields when present', () => {
      const file = makeFile('drainage.pdf');
      const fd = buildDrawingUploadFormData('project-1', file, {
        drawingNumber: 'DWG-003',
        title: 'Drainage',
        revision: 'A',
        issueDate: '2026-05-09',
        status: 'for_construction',
      });
      expect(fd.get('file')).toBeInstanceOf(File);
      expect((fd.get('file') as File).name).toBe('drainage.pdf');
      expect(fd.get('projectId')).toBe('project-1');
      expect(fd.get('drawingNumber')).toBe('DWG-003');
      expect(fd.get('title')).toBe('Drainage');
      expect(fd.get('revision')).toBe('A');
      expect(fd.get('issueDate')).toBe('2026-05-09');
      expect(fd.get('status')).toBe('for_construction');
    });

    it('omits blank optional fields', () => {
      const fd = buildDrawingUploadFormData('project-1', makeFile(), {
        drawingNumber: 'DWG-004',
        title: '   ',
        revision: '',
        issueDate: '',
        status: 'preliminary',
      });
      expect(fd.get('title')).toBeNull();
      expect(fd.get('revision')).toBeNull();
      expect(fd.get('issueDate')).toBeNull();
      expect(fd.get('drawingNumber')).toBe('DWG-004');
      expect(fd.get('status')).toBe('preliminary');
    });
  });

  describe('buildDrawingRevisionFormData', () => {
    it('appends the revision and status without a projectId', () => {
      const fd = buildDrawingRevisionFormData(makeFile('rev-b.pdf'), {
        revision: 'B',
        title: 'Issued',
        issueDate: '2026-05-10',
        status: 'for_construction',
      });
      expect(fd.get('file')).toBeInstanceOf(File);
      expect(fd.get('projectId')).toBeNull();
      expect(fd.get('revision')).toBe('B');
      expect(fd.get('title')).toBe('Issued');
      expect(fd.get('issueDate')).toBe('2026-05-10');
      expect(fd.get('status')).toBe('for_construction');
    });

    it('omits blank title and issue date but always sends the revision', () => {
      const fd = buildDrawingRevisionFormData(makeFile(), {
        revision: 'C',
        title: '  ',
        issueDate: '',
        status: 'as_built',
      });
      expect(fd.get('title')).toBeNull();
      expect(fd.get('issueDate')).toBeNull();
      expect(fd.get('revision')).toBe('C');
      expect(fd.get('status')).toBe('as_built');
    });
  });

  describe('formatFileSize', () => {
    it('formats nullish and zero sizes as Unknown', () => {
      expect(formatFileSize(null)).toBe('Unknown');
      expect(formatFileSize(0)).toBe('Unknown');
    });

    it('formats bytes, kilobytes, and megabytes', () => {
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
    });
  });
});
