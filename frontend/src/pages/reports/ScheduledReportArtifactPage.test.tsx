import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authFetch } from '@/lib/api';
import { downloadBlob } from '@/lib/downloads';
import { ScheduledReportArtifactPage } from './ScheduledReportArtifactPage';

vi.mock('@/lib/api', () => ({
  authFetch: vi.fn(),
}));

vi.mock('@/lib/downloads', () => ({
  downloadBlob: vi.fn(),
}));

const authFetchMock = vi.mocked(authFetch);
const downloadBlobMock = vi.mocked(downloadBlob);

function renderPage(path = '/reports/scheduled-runs/run-1/artifact') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/reports/scheduled-runs/:runId/artifact"
          element={<ScheduledReportArtifactPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ScheduledReportArtifactPage', () => {
  beforeEach(() => {
    authFetchMock.mockReset();
    downloadBlobMock.mockReset();
  });

  it('downloads the scheduled report artifact through the authenticated API', async () => {
    authFetchMock.mockResolvedValueOnce(
      new Response('pdf bytes', {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="Lot_Status_Report.pdf"',
        },
      }),
    );

    renderPage();

    await waitFor(() =>
      expect(authFetchMock).toHaveBeenCalledWith('/api/reports/scheduled-runs/run-1/artifact'),
    );
    await waitFor(() => expect(downloadBlobMock).toHaveBeenCalledTimes(1));
    const [blob, filename, fallback] = downloadBlobMock.mock.calls[0];
    expect(blob.type).toBe('application/pdf');
    expect(filename).toBe('Lot_Status_Report.pdf');
    expect(fallback).toBe('scheduled-report.pdf');
    expect(screen.getByText('Your report download has started.')).toBeInTheDocument();
  });

  it('surfaces a missing artifact error', async () => {
    authFetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));

    renderPage();

    expect(await screen.findByText('This scheduled report file could not be found.')).toBeVisible();
    expect(downloadBlobMock).not.toHaveBeenCalled();
  });
});
