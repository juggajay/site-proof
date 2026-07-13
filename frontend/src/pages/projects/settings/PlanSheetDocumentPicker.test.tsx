import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PlanSheetDocumentPicker } from './PlanSheetDocumentPicker';

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock };
});

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const DOCS = [
  {
    id: 'd1',
    filename: 'C-101 Rev D.pdf',
    mimeType: 'application/pdf',
    uploadedAt: '2026-01-05T00:00:00Z',
  },
  {
    id: 'd2',
    filename: 'site-photo.jpg',
    mimeType: 'image/jpeg',
    uploadedAt: '2026-01-06T00:00:00Z',
  },
  { id: 'd3', filename: 'S-200 Structural', mimeType: null, uploadedAt: '2026-01-07T00:00:00Z' },
];

describe('PlanSheetDocumentPicker', () => {
  beforeEach(() => apiFetchMock.mockReset());

  it('lists only PDF documents (by mime type or .pdf name) and hides non-PDFs', async () => {
    apiFetchMock.mockResolvedValue({ documents: DOCS });
    render(<PlanSheetDocumentPicker projectId="p1" onSelect={vi.fn()} />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByText('C-101 Rev D.pdf')).toBeInTheDocument());
    expect(screen.queryByText('site-photo.jpg')).not.toBeInTheDocument();
    // A .pdf name with a null mime type still qualifies; a non-pdf name does not.
    expect(screen.queryByText('S-200 Structural')).not.toBeInTheDocument();
  });

  it('filters the list by the search box and emits the chosen document', async () => {
    apiFetchMock.mockResolvedValue({
      documents: [
        DOCS[0],
        {
          id: 'd4',
          filename: 'D-300 Drainage.pdf',
          mimeType: 'application/pdf',
          uploadedAt: '2026-01-08T00:00:00Z',
        },
      ],
    });
    const onSelect = vi.fn();
    render(<PlanSheetDocumentPicker projectId="p1" onSelect={onSelect} />, { wrapper: wrapper() });

    await waitFor(() => expect(screen.getByText('D-300 Drainage.pdf')).toBeInTheDocument());
    await userEvent.type(screen.getByLabelText('Search documents'), 'drainage');
    expect(screen.queryByText('C-101 Rev D.pdf')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('D-300 Drainage.pdf'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'd4' }));
  });

  it('shows an empty state when the project has no PDF documents', async () => {
    apiFetchMock.mockResolvedValue({ documents: [DOCS[1]] });
    render(<PlanSheetDocumentPicker projectId="p1" onSelect={vi.fn()} />, { wrapper: wrapper() });

    await waitFor(() =>
      expect(screen.getByText(/No PDF documents in this project yet/i)).toBeInTheDocument(),
    );
  });

  it('requests the project documents list with a bounded page size', async () => {
    apiFetchMock.mockResolvedValue({ documents: DOCS });
    render(<PlanSheetDocumentPicker projectId="p1" onSelect={vi.fn()} />, { wrapper: wrapper() });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith('/api/documents/p1?limit=100');
  });

  it('renders each row with its uploaded date', async () => {
    apiFetchMock.mockResolvedValue({ documents: [DOCS[0]] });
    render(<PlanSheetDocumentPicker projectId="p1" onSelect={vi.fn()} />, { wrapper: wrapper() });

    const row = await screen.findByText('C-101 Rev D.pdf');
    // formatDocumentDate renders an en-AU date string; assert the year is present.
    expect(within(row.closest('button')!).getByText(/2026/)).toBeInTheDocument();
  });
});
