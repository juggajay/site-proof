import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  DrawingDeleteConfirmDialog,
  DrawingFilters,
  DrawingLoadErrorAlert,
  DrawingPagination,
  DrawingRegisterHeader,
  DrawingStatsCards,
} from './DrawingPageSections';
import type { Drawing } from '../drawingsUploadData';

const drawing: Drawing = {
  id: 'drawing-1',
  drawingNumber: 'DWG-001',
  title: 'General Arrangement',
  revision: 'B',
  status: 'for_construction',
  issueDate: '2026-05-01',
  createdAt: '2026-05-01T00:00:00.000Z',
  document: {
    id: 'document-1',
    filename: 'dwg-001.pdf',
    fileUrl: 'https://example.com/dwg-001.pdf',
    fileSize: 1234,
    mimeType: 'application/pdf',
    uploadedAt: '2026-05-01T00:00:00.000Z',
    uploadedBy: null,
  },
  supersededBy: null,
  supersedes: [],
};

describe('DrawingRegisterHeader', () => {
  it('renders actions and reports download/upload clicks', () => {
    const onDownloadCurrentSet = vi.fn();
    const onAddDrawing = vi.fn();
    render(
      <DrawingRegisterHeader
        canManageDrawings
        downloadingCurrentSet={false}
        loading={false}
        hasDrawingError={false}
        hasProjectId
        onDownloadCurrentSet={onDownloadCurrentSet}
        onAddDrawing={onAddDrawing}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Download Current Set' }));
    expect(onDownloadCurrentSet).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add Drawing' }));
    expect(onAddDrawing).toHaveBeenCalledTimes(1);
  });

  it('hides add drawing for read-only users and disables download while unavailable', () => {
    render(
      <DrawingRegisterHeader
        canManageDrawings={false}
        downloadingCurrentSet
        loading={false}
        hasDrawingError={false}
        hasProjectId
        onDownloadCurrentSet={vi.fn()}
        onAddDrawing={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Add Drawing' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Downloading...' })).toBeDisabled();
  });

  it('uses read-only header copy for viewers', () => {
    render(
      <DrawingRegisterHeader
        canManageDrawings={false}
        downloadingCurrentSet={false}
        loading={false}
        hasDrawingError={false}
        hasProjectId
        onDownloadCurrentSet={vi.fn()}
        onAddDrawing={vi.fn()}
      />,
    );

    expect(screen.getByText('View project drawings and revisions')).toBeInTheDocument();
    expect(screen.queryByText(/manage project drawings/i)).not.toBeInTheDocument();
  });
});

describe('DrawingStatsCards', () => {
  it('renders drawing status counts', () => {
    render(
      <DrawingStatsCards stats={{ total: 8, preliminary: 1, forConstruction: 5, asBuilt: 2 }} />,
    );

    expect(screen.getByText('Total Drawings')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Preliminary')).toBeInTheDocument();
    expect(screen.getByText('For Construction')).toBeInTheDocument();
    expect(screen.getByText('As-Built')).toBeInTheDocument();
  });
});

describe('DrawingFilters', () => {
  it('reports status and search interactions', () => {
    const onStatusFilterChange = vi.fn();
    const onSearchQueryChange = vi.fn();
    const onSearch = vi.fn();
    render(
      <DrawingFilters
        filterStatus=""
        searchQuery=""
        onStatusFilterChange={onStatusFilterChange}
        onSearchQueryChange={onSearchQueryChange}
        onSearch={onSearch}
      />,
    );

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'for_construction' } });
    expect(onStatusFilterChange).toHaveBeenCalledWith('for_construction');

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'DWG-001' } });
    expect(onSearchQueryChange).toHaveBeenCalledWith('DWG-001');

    fireEvent.keyDown(screen.getByLabelText('Search'), { key: 'Enter' });
    expect(onSearch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(onSearch).toHaveBeenCalledTimes(2);
  });
});

describe('DrawingPagination', () => {
  it('renders range and reports page navigation', () => {
    const onPreviousPage = vi.fn();
    const onNextPage = vi.fn();
    render(
      <DrawingPagination
        page={2}
        totalPages={4}
        total={85}
        hasPrevPage
        hasNextPage
        showingFrom={51}
        showingTo={85}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      />,
    );

    expect(screen.getByText('Showing 51-85 of 85')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPreviousPage).toHaveBeenCalledTimes(1);
    expect(onNextPage).toHaveBeenCalledTimes(1);
  });
});

describe('DrawingLoadErrorAlert', () => {
  it('renders the error and retries the drawing query', () => {
    const onRetry = vi.fn();
    render(<DrawingLoadErrorAlert error="Failed to load drawings" onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load drawings');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('DrawingDeleteConfirmDialog', () => {
  it('confirms deletion for the selected drawing', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <DrawingDeleteConfirmDialog drawing={drawing} onCancel={onCancel} onConfirm={onConfirm} />,
    );

    expect(screen.getByText('Delete Drawing')).toBeInTheDocument();
    expect(screen.getByText(/DWG-001/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledWith('drawing-1');
  });
});
