import { describe, expect, it } from 'vitest';
import { buildNcrDetailPdfData } from './ncrDetailPdfData';
import type { NCR } from './types';

const buildNcr = (overrides: Partial<NCR> = {}): NCR => ({
  id: 'ncr-1',
  ncrNumber: 'NCR-0042',
  description: 'Pipe bedding failed inspection.',
  category: 'workmanship',
  severity: 'major',
  status: 'closed',
  qmApprovalRequired: true,
  qmApprovedAt: '2026-06-05T01:00:00.000Z',
  qmApprovedBy: { id: 'qm-1', fullName: 'Quinn Manager', email: 'qm@example.com' },
  raisedBy: { fullName: 'Riley Inspector', email: 'riley@example.com' },
  responsibleSubcontractor: { id: 'sub-1', companyName: 'Drainage Co' },
  responsibleSubcontractorId: 'sub-1',
  dueDate: '2026-06-07T00:00:00.000Z',
  createdAt: '2026-06-01T00:00:00.000Z',
  rootCauseCategory: 'Method',
  rootCauseDescription: 'Crew used the wrong bedding material.',
  proposedCorrectiveAction: 'Remove bedding and reinstate with specified material.',
  responseSubmittedAt: '2026-06-02T00:00:00.000Z',
  project: { id: 'project-1', name: 'Pacific Highway Upgrade', projectNumber: 'PHU-001' },
  ncrLots: [{ lot: { lotNumber: 'DR-042', description: 'Drainage run 42' } }],
  clientNotifiedAt: '2026-06-03T00:00:00.000Z',
  lessonsLearned: 'Add material check to pre-start.',
  closedAt: '2026-06-06T00:00:00.000Z',
  closedBy: { fullName: 'Casey Closer', email: 'casey@example.com' },
  verificationNotes: 'Replacement bedding verified against the spec.',
  ncrEvidence: [
    {
      id: 'evidence-1',
      evidenceType: 'rectification_photo',
      uploadedAt: '2026-06-04T00:00:00.000Z',
      document: {
        id: 'document-1',
        filename: 'rectified-bedding.jpg',
        fileUrl: 'https://storage.example.com/public/rectified-bedding.jpg',
        mimeType: 'image/jpeg',
        uploadedAt: '2026-06-04T00:00:00.000Z',
      },
    },
  ],
  ...overrides,
});

describe('buildNcrDetailPdfData', () => {
  it('maps the real NCR register shape into a complete PDF payload', () => {
    const data = buildNcrDetailPdfData(buildNcr());

    expect(data.ncr).toEqual(
      expect.objectContaining({
        ncrNumber: 'NCR-0042',
        rootCauseCategory: 'Method',
        rootCause: 'Crew used the wrong bedding material.',
        proposedAction: 'Remove bedding and reinstate with specified material.',
        verificationNotes: 'Replacement bedding verified against the spec.',
        lessonsLearned: 'Add material check to pre-start.',
        responsibleSubcontractor: { companyName: 'Drainage Co' },
        closedAt: '2026-06-06T00:00:00.000Z',
        closedBy: { fullName: 'Casey Closer', email: 'casey@example.com' },
      }),
    );
    expect(data.project).toEqual({ name: 'Pacific Highway Upgrade', projectNumber: 'PHU-001' });
    expect(data.lots).toEqual([{ lotNumber: 'DR-042', description: 'Drainage run 42' }]);
    expect(data.ncr.evidence).toEqual([
      {
        id: 'evidence-1',
        evidenceType: 'rectification_photo',
        uploadedAt: '2026-06-04T00:00:00.000Z',
        document: {
          id: 'document-1',
          filename: 'rectified-bedding.jpg',
          mimeType: 'image/jpeg',
          uploadedAt: '2026-06-04T00:00:00.000Z',
        },
      },
    ]);
    expect(JSON.stringify(data)).not.toContain('storage.example.com');
    expect(data.timeline?.map((event) => event.action)).toEqual([
      'NCR raised',
      'Response submitted',
      'Client notified',
      'QM approved',
      'NCR closed',
    ]);
    expect(data.timeline?.[1]).toEqual(
      expect.objectContaining({
        performedBy: 'Drainage Co',
        notes: 'Remove bedding and reinstate with specified material.',
      }),
    );
  });

  it('falls back cleanly for unassigned NCRs with no evidence', () => {
    const data = buildNcrDetailPdfData(
      buildNcr({
        responsibleSubcontractor: null,
        responsibleSubcontractorId: null,
        qmApprovedAt: null,
        qmApprovedBy: null,
        closedAt: null,
        closedBy: null,
        ncrEvidence: undefined,
        responseSubmittedAt: null,
        clientNotifiedAt: null,
      }),
    );

    expect(data.ncr.responsibleUser).toBeNull();
    expect(data.ncr.responsibleSubcontractor).toBeNull();
    expect(data.ncr.evidence).toEqual([]);
    expect(data.timeline?.map((event) => event.action)).toEqual(['NCR raised']);
  });
});
