import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithProviders, screen, waitFor } from '@/test/renderWithProviders';
import type { Claim } from '../types';
import { RecordCertificationModal } from './RecordCertificationModal';

const uploadDocumentsMock = vi.hoisted(() => vi.fn());

vi.mock('@/pages/documents/documentsUploadData', () => ({
  uploadDocuments: uploadDocumentsMock,
}));

const CLAIM: Claim = {
  id: 'claim-1',
  claimNumber: 12,
  periodStart: '2026-06-01',
  periodEnd: '2026-06-30',
  status: 'submitted',
  totalClaimedAmount: 1000,
  certifiedAmount: null,
  paidAmount: null,
  submittedAt: '2026-06-30T00:00:00.000Z',
  disputeNotes: null,
  disputedAt: null,
  lotCount: 2,
};

describe('RecordCertificationModal', () => {
  beforeEach(() => {
    uploadDocumentsMock.mockReset();
  });

  it('requires variation notes when the external schedule reduces the certified amount', async () => {
    const onCertify = vi.fn().mockResolvedValue(undefined);

    renderWithProviders(
      <RecordCertificationModal
        claim={CLAIM}
        projectId="project-1"
        onClose={vi.fn()}
        onCertify={onCertify}
      />,
    );

    fireEvent.change(screen.getByLabelText('Certified Amount'), { target: { value: '900' } });

    const recordButton = screen.getByRole('button', { name: 'Record Payment Schedule' });
    expect(
      screen.getByText('Required when the certified amount is less than claimed.'),
    ).toBeInTheDocument();
    expect(recordButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Variation Notes'), {
      target: { value: 'Principal schedule reduced quantity' },
    });

    expect(recordButton).toBeEnabled();
    fireEvent.click(recordButton);

    await waitFor(() => expect(onCertify).toHaveBeenCalledTimes(1));
    expect(onCertify).toHaveBeenCalledWith(
      'claim-1',
      expect.objectContaining({
        certifiedAmount: 900,
        variationNotes: 'Principal schedule reduced quantity',
      }),
    );
  });

  it('uploads an attached certificate and sends its document id when recording certification', async () => {
    const onCertify = vi.fn().mockResolvedValue(undefined);
    uploadDocumentsMock.mockResolvedValue({
      uploadedDocs: [{ id: 'doc-cert-1', filename: 'external-certificate.pdf' }],
      failedUploads: [],
    });

    renderWithProviders(
      <RecordCertificationModal
        claim={CLAIM}
        projectId="project-1"
        onClose={vi.fn()}
        onCertify={onCertify}
      />,
    );

    const file = new File(['%PDF-1.4 certificate'], 'external-certificate.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(document.querySelector('#certification-document-upload') as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(screen.getByText('external-certificate.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Record Payment Schedule' }));

    await waitFor(() => expect(uploadDocumentsMock).toHaveBeenCalledTimes(1));
    expect(uploadDocumentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        files: [file],
        projectId: 'project-1',
        form: expect.objectContaining({
          documentType: 'certificate',
          category: 'certification',
        }),
      }),
    );
    await waitFor(() => expect(onCertify).toHaveBeenCalledTimes(1));
    expect(onCertify).toHaveBeenCalledWith(
      'claim-1',
      expect.objectContaining({
        certifiedAmount: 1000,
        certificationDocumentId: 'doc-cert-1',
      }),
    );
  });

  it('keeps cancel disabled while certification is recording', async () => {
    const onClose = vi.fn();
    const onCertify = vi.fn(
      () =>
        new Promise<void>(() => {
          // Keep the mutation in flight.
        }),
    );

    renderWithProviders(
      <RecordCertificationModal
        claim={CLAIM}
        projectId="project-1"
        onClose={onClose}
        onCertify={onCertify}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Record Payment Schedule' }));

    await waitFor(() => expect(onCertify).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
