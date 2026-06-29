import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Download, FileText } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/api';
import { downloadBlob } from '@/lib/downloads';

type DownloadState = 'downloading' | 'downloaded' | 'error';

function filenameFromContentDisposition(value: string | null): string | null {
  if (!value) return null;

  const filenameStarMatch = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (filenameStarMatch?.[1]) {
    try {
      return decodeURIComponent(filenameStarMatch[1].trim().replace(/^"|"$/g, ''));
    } catch {
      return filenameStarMatch[1].trim().replace(/^"|"$/g, '');
    }
  }

  const filenameMatch = /filename="?([^";]+)"?/i.exec(value);
  return filenameMatch?.[1]?.trim() || null;
}

export function ScheduledReportArtifactPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<DownloadState>('downloading');
  const [error, setError] = useState<string | null>(null);

  const downloadReport = useCallback(async () => {
    if (!runId) {
      setState('error');
      setError('Scheduled report link is missing a run id.');
      return;
    }

    setState('downloading');
    setError(null);

    try {
      const response = await authFetch(
        `/api/reports/scheduled-runs/${encodeURIComponent(runId)}/artifact`,
      );
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? 'This scheduled report file could not be found.'
            : 'This scheduled report could not be downloaded.',
        );
      }

      const blob = await response.blob();
      const filename = filenameFromContentDisposition(response.headers.get('content-disposition'));
      downloadBlob(blob, filename, 'scheduled-report.pdf');
      setState('downloaded');
    } catch (downloadError) {
      setState('error');
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'This scheduled report could not be downloaded.',
      );
    }
  }, [runId]);

  useEffect(() => {
    void downloadReport();
  }, [downloadReport]);

  const isDownloading = state === 'downloading';
  const isDownloaded = state === 'downloaded';

  return (
    <main className="mx-auto flex min-h-[55vh] w-full max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-700">
        {state === 'error' ? <AlertCircle className="h-7 w-7" /> : <FileText className="h-7 w-7" />}
      </div>

      <h1 className="text-2xl font-semibold text-gray-900">Scheduled report</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-gray-600">
        {isDownloading && 'Preparing your report download.'}
        {isDownloaded && 'Your report download has started.'}
        {state === 'error' && (error || 'This scheduled report could not be downloaded.')}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={downloadReport} disabled={isDownloading}>
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? 'Downloading...' : isDownloaded ? 'Download again' : 'Retry download'}
        </Button>
      </div>
    </main>
  );
}
