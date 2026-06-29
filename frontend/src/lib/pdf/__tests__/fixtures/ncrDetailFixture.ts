import type { NCRDetailData } from '../../../pdfGenerator';

export const majorNcrDetailFixture: NCRDetailData = {
  ncr: {
    ncrNumber: 'NCR-0009',
    description: 'Honeycombing identified on headwall concrete face after formwork strip.',
    category: 'workmanship',
    severity: 'major',
    status: 'pending_review',
    rootCauseCategory: 'Work method',
    rootCause: 'Insufficient vibration around congested reinforcement.',
    proposedAction: 'Break out defective concrete and reinstate with approved repair mortar.',
    actionTaken: 'Repair methodology submitted for superintendent review.',
    preventativeMeasures: 'Brief crew on vibration pattern and add pre-pour checklist hold point.',
    verificationNotes: 'QM requested photo evidence before final closure.',
    lessonsLearned: 'Increase inspection frequency when reinforcement congestion is high.',
    qmApprovalRequired: true,
    qmApprovedAt: null,
    qmApprovedBy: null,
    raisedBy: {
      fullName: 'Quinn Manager',
      email: 'quinn@example.com',
    },
    responsibleUser: {
      fullName: 'Sam Supervisor',
      email: 'sam@example.com',
    },
    dueDate: '2026-06-04T00:00:00.000Z',
    closedAt: null,
    closedBy: null,
    createdAt: '2026-05-28T01:30:00.000Z',
    evidence: [
      {
        id: 'ncr-evidence-1',
        evidenceType: 'rectification_photo',
        uploadedAt: '2026-05-29T04:15:00.000Z',
        document: {
          id: 'doc-1',
          filename: 'headwall-repair-photo.jpg',
          mimeType: 'image/jpeg',
          uploadedAt: '2026-05-29T04:10:00.000Z',
        },
      },
    ],
  },
  project: {
    name: 'Pacific Highway Upgrade',
    projectNumber: 'PHU-001',
  },
  lots: [
    {
      lotNumber: 'STR-042',
      description: 'Headwall concrete repair',
    },
  ],
  timeline: [
    {
      action: 'NCR raised',
      performedBy: 'Quinn Manager',
      performedAt: '2026-05-28T01:30:00.000Z',
      notes: 'Photos attached in document register.',
    },
  ],
};
