import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_UPLOAD_FORM } from '../documentsUploadData';
import { DocumentUploadModal } from './DocumentUploadModal';

function renderModal({ uploading = false } = {}) {
  return render(
    <DocumentUploadModal
      selectedFiles={[]}
      uploadForm={EMPTY_UPLOAD_FORM}
      uploading={uploading}
      uploadProgress={0}
      uploadedCount={0}
      imageDimensions={null}
      dimensionWarning={null}
      fileInputRef={createRef<HTMLInputElement>()}
      lots={[]}
      formatFileSize={(bytes) => `${bytes ?? 0} B`}
      onClose={vi.fn()}
      onFileSelect={vi.fn()}
      onModalDrop={vi.fn()}
      onFormChange={vi.fn()}
      onUpload={vi.fn()}
    />,
  );
}

describe('DocumentUploadModal', () => {
  it('advertises backend-supported Outlook email uploads', () => {
    renderModal();

    expect(screen.getByLabelText('Select Files')).toHaveAttribute(
      'accept',
      '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.eml,.msg',
    );
    expect(
      screen.getByText('PDF, DOC, XLS, JPG, PNG, EML, MSG up to 50MB (select multiple files)'),
    ).toBeInTheDocument();
  });

  it('locks file and metadata inputs while uploading', () => {
    renderModal({ uploading: true });

    expect(screen.getByLabelText('Select Files')).toBeDisabled();
    expect(screen.getByLabelText('Document Type *')).toBeDisabled();
    expect(screen.getByLabelText('Category')).toBeDisabled();
    expect(screen.getByLabelText('Link to Lot (optional)')).toBeDisabled();
    expect(screen.getByLabelText('Description')).toBeDisabled();
  });
});
