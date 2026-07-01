import { describe, expect, it, vi } from 'vitest';

import { attachHoldPointEvidenceDocuments } from './evidenceAttachments.js';

function buildTx() {
  return {
    document: {
      findMany: vi.fn(),
    },
    iTPCompletion: {
      upsert: vi.fn(),
    },
    iTPCompletionAttachment: {
      createMany: vi.fn(),
    },
  };
}

describe('attachHoldPointEvidenceDocuments', () => {
  it('validates same-lot documents, upserts a pending completion, and attaches unique ids', async () => {
    const tx = buildTx();
    tx.document.findMany.mockResolvedValue([{ id: 'doc-1' }, { id: 'doc-2' }]);
    tx.iTPCompletion.upsert.mockResolvedValue({ id: 'completion-1' });
    tx.iTPCompletionAttachment.createMany.mockResolvedValue({ count: 2 });

    const result = await attachHoldPointEvidenceDocuments(tx, {
      projectId: 'project-1',
      lotId: 'lot-1',
      itpInstanceId: 'itp-1',
      itpChecklistItemId: 'item-1',
      documentIds: ['doc-1', ' doc-2 ', 'doc-1'],
    });

    expect(result).toEqual({
      completionId: 'completion-1',
      documentIds: ['doc-1', 'doc-2'],
    });
    expect(tx.document.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['doc-1', 'doc-2'] },
        projectId: 'project-1',
        lotId: 'lot-1',
      },
      select: { id: true },
    });
    expect(tx.iTPCompletion.upsert).toHaveBeenCalledWith({
      where: {
        itpInstanceId_checklistItemId: {
          itpInstanceId: 'itp-1',
          checklistItemId: 'item-1',
        },
      },
      update: {},
      create: {
        itpInstanceId: 'itp-1',
        checklistItemId: 'item-1',
        status: 'pending',
      },
      select: { id: true },
    });
    expect(tx.iTPCompletionAttachment.createMany).toHaveBeenCalledWith({
      data: [
        { completionId: 'completion-1', documentId: 'doc-1' },
        { completionId: 'completion-1', documentId: 'doc-2' },
      ],
      skipDuplicates: true,
    });
  });

  it('rejects evidence documents that do not belong to the hold point lot', async () => {
    const tx = buildTx();
    tx.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);

    await expect(
      attachHoldPointEvidenceDocuments(tx, {
        projectId: 'project-1',
        lotId: 'lot-1',
        itpInstanceId: 'itp-1',
        itpChecklistItemId: 'item-1',
        documentIds: ['doc-1', 'doc-foreign'],
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Evidence documents must belong to this hold point lot',
    });

    expect(tx.iTPCompletion.upsert).not.toHaveBeenCalled();
    expect(tx.iTPCompletionAttachment.createMany).not.toHaveBeenCalled();
  });
});
