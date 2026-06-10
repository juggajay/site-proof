import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DeleteDocumentDialog,
  DocumentCategorySummary,
  DocumentDragOverlay,
  DocumentsLoadErrorAlert,
  DocumentsPageHeader,
} from './DocumentsPageChrome';

describe('DocumentsPageHeader', () => {
  it('opens the upload modal', () => {
    const onUpload = vi.fn();
    render(<DocumentsPageHeader onUpload={onUpload} />);

    fireEvent.click(screen.getByRole('button', { name: 'Upload Document' }));

    expect(onUpload).toHaveBeenCalledTimes(1);
  });

  it('renders the context help affordance', () => {
    render(<DocumentsPageHeader onUpload={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Help for Document Management' }),
    ).toBeInTheDocument();
  });
});

describe('DocumentDragOverlay', () => {
  it('renders only while dragging', () => {
    const { rerender } = render(<DocumentDragOverlay isDragging={false} />);

    expect(screen.queryByText('Drop file here to upload')).not.toBeInTheDocument();

    rerender(<DocumentDragOverlay isDragging />);

    expect(screen.getByText('Drop file here to upload')).toBeInTheDocument();
  });
});

describe('DocumentsLoadErrorAlert', () => {
  it('renders retryable load errors', () => {
    const onRetry = vi.fn();
    render(<DocumentsLoadErrorAlert error="Failed to load documents" onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load documents');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('DocumentCategorySummary', () => {
  it('selects categories using the lower-case filter value', () => {
    const onSelectCategory = vi.fn();
    render(
      <DocumentCategorySummary
        categories={{ Drawings: 3, Photos: 2 }}
        onSelectCategory={onSelectCategory}
      />,
    );

    fireEvent.click(screen.getByText('Drawings: 3'));

    expect(onSelectCategory).toHaveBeenCalledWith('drawings');
  });
});

describe('DeleteDocumentDialog', () => {
  it('confirms the pending document delete', () => {
    const onConfirmDelete = vi.fn();
    render(
      <DeleteDocumentDialog
        documentPendingDelete={{ id: 'doc-1', filename: 'drawing.pdf' }}
        onCancel={vi.fn()}
        onConfirmDelete={onConfirmDelete}
      />,
    );

    expect(screen.getByText(/"drawing.pdf"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirmDelete).toHaveBeenCalledWith('doc-1');
  });
});
