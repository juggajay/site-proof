// Feature #242: Delay Register Page - View and export all delays from diaries
import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { apiFetch, authFetch, getAuthToken } from '@/lib/api';
import { sanitizeCsvFilename } from '@/lib/csv';
import { downloadBlob } from '@/lib/downloads';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { MobileDataCard } from '@/components/ui/MobileDataCard';

interface Delay {
  id: string;
  diaryId: string;
  diaryDate: string;
  diaryStatus: string;
  delayType: string;
  startTime: string | null;
  endTime: string | null;
  durationHours: number | null;
  description: string;
  impact: string | null;
}

interface DelaySummary {
  totalDelays: number;
  totalHours: number;
  byType: Record<string, { count: number; totalHours: number }>;
}

interface DelayRegisterResponse {
  delays: Delay[];
  summary: DelaySummary;
}

const DELAY_TYPES = [
  { id: 'weather', label: 'Weather' },
  { id: 'material_shortage', label: 'Material Shortage' },
  { id: 'equipment_breakdown', label: 'Equipment Breakdown' },
  { id: 'labour_shortage', label: 'Labour Shortage' },
  { id: 'client_instruction', label: 'Client Instruction' },
  { id: 'design_issue', label: 'Design Issue' },
  { id: 'site_access', label: 'Site Access' },
  { id: 'other', label: 'Other' },
];

function getContentDispositionFilename(contentDisposition: string): string | undefined {
  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1].trim());
    } catch {
      return undefined;
    }
  }

  return (
    contentDisposition.match(/filename="([^"]+)"/i)?.[1] ??
    contentDisposition.match(/filename=([^;]+)/i)?.[1]?.trim()
  );
}

function getDelayExportFilename(contentDisposition: string): string {
  return sanitizeCsvFilename(
    getContentDispositionFilename(contentDisposition) || 'delay-register.csv',
  );
}

export function DelayRegisterPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [delays, setDelays] = useState<Delay[]>([]);
  const [summary, setSummary] = useState<DelaySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);

  // Filters
  const [filterType, setFilterType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const buildDelayPath = useCallback(
    (exportCsv = false) => {
      if (!projectId) return null;

      const params = new URLSearchParams();
      if (filterType) params.append('delayType', filterType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const queryString = params.toString();
      const basePath = `/api/diary/project/${encodeURIComponent(projectId)}/delays${exportCsv ? '/export' : ''}`;
      return queryString ? `${basePath}?${queryString}` : basePath;
    },
    [projectId, filterType, startDate, endDate],
  );

  const fetchDelays = useCallback(async () => {
    const path = buildDelayPath();
    if (!path) {
      setLoading(false);
      setError('Project not found');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DelayRegisterResponse>(path);
      setDelays(data.delays || []);
      setSummary(data.summary || null);
    } catch (err) {
      logError('Error fetching delays:', err);
      setDelays([]);
      setSummary(null);
      setError(extractErrorMessage(err, 'Failed to load delays'));
    } finally {
      setLoading(false);
    }
  }, [buildDelayPath]);

  useEffect(() => {
    fetchDelays();
  }, [fetchDelays]);

  const handleExport = async () => {
    if (exportingRef.current) return;

    const path = buildDelayPath(true);
    if (!path) {
      setError('Project not found');
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError('You must be signed in to export delays');
      return;
    }

    exportingRef.current = true;
    setExporting(true);
    setError(null);
    try {
      const response = await authFetch(path);

      if (!response.ok) {
        throw new Error(`Delay export failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/csv') && !contentType.includes('application/octet-stream')) {
        throw new Error(
          `Delay export returned unexpected content type: ${contentType || 'unknown'}`,
        );
      }

      const blob = await response.blob();
      const disposition = response.headers.get('content-disposition') || '';
      downloadBlob(blob, getDelayExportFilename(disposition), 'delay-register.csv');
    } catch (err) {
      logError('Export failed:', err);
      setError('Failed to export delays. Please try again.');
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getDelayTypeLabel = (type: string) => {
    const found = DELAY_TYPES.find((t) => t.id === type);
    return found?.label || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Delay Register</h1>
          <p className="text-muted-foreground">
            View and export all delays recorded in daily diaries
          </p>
        </div>
        <Link
          to={`/projects/${encodeURIComponent(projectId || '')}/diary`}
          className="text-sm text-primary hover:underline"
        >
          ← Back to Diary
        </Link>
      </div>

      {/* Filters */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Delay Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              {DELAY_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={delays.length === 0 || exporting}
            className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export to Excel (CSV)'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700" role="alert">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium">{error}</p>
            <button
              type="button"
              onClick={() => void fetchDelays()}
              className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      {!error && summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="text-3xl font-bold text-red-600">{summary.totalDelays}</div>
            <div className="text-sm text-muted-foreground">Total Delays</div>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <div className="text-3xl font-bold text-orange-600">
              {summary.totalHours.toFixed(1)}
            </div>
            <div className="text-sm text-muted-foreground">Total Hours Lost</div>
          </div>
          <div className="rounded-lg border bg-card p-4 md:col-span-2">
            <div className="text-sm font-medium mb-2">By Category</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(summary.byType).map(([type, data]) => (
                <span key={type} className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700">
                  {getDelayTypeLabel(type)}: {data.count} ({data.totalHours.toFixed(1)}h)
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delays Table */}
      <div className={isMobile ? '' : 'rounded-lg border bg-card'}>
        {error ? null : loading ? (
          <div className="p-8 text-center text-muted-foreground rounded-lg border bg-card">
            Loading delays...
          </div>
        ) : delays.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground rounded-lg border bg-card">
            No delays found{' '}
            {filterType || startDate || endDate ? 'matching your filters' : 'in any diary entries'}
          </div>
        ) : isMobile ? (
          /* Mobile Card View */
          <div className="space-y-3">
            {delays.map((delay) => (
              <MobileDataCard
                key={delay.id}
                title={formatDate(delay.diaryDate)}
                subtitle={delay.description}
                status={{
                  label: getDelayTypeLabel(delay.delayType),
                  variant: 'error',
                }}
                fields={[
                  {
                    label: 'Duration',
                    value: delay.durationHours ? `${delay.durationHours.toFixed(1)}h` : '-',
                    priority: 'primary',
                  },
                  {
                    label: 'Time',
                    value:
                      delay.startTime && delay.endTime
                        ? `${delay.startTime} - ${delay.endTime}`
                        : '-',
                    priority: 'primary',
                  },
                  { label: 'Impact', value: delay.impact || '-', priority: 'secondary' },
                ]}
                onClick={() =>
                  navigate(
                    `/projects/${encodeURIComponent(projectId || '')}/diary?date=${encodeURIComponent(delay.diaryDate.split('T')[0])}`,
                  )
                }
              />
            ))}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Impact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                    Diary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {delays.map((delay) => (
                  <tr key={delay.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{formatDate(delay.diaryDate)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-700">
                        {getDelayTypeLabel(delay.delayType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {delay.startTime && delay.endTime
                        ? `${delay.startTime} - ${delay.endTime}`
                        : delay.startTime || delay.endTime || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-red-600">
                      {delay.durationHours ? `${delay.durationHours.toFixed(1)}h` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate" title={delay.description}>
                      {delay.description}
                    </td>
                    <td
                      className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate"
                      title={delay.impact || ''}
                    >
                      {delay.impact || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        to={`/projects/${encodeURIComponent(projectId || '')}/diary?date=${encodeURIComponent(delay.diaryDate.split('T')[0])}`}
                        className="text-primary hover:underline"
                      >
                        View Diary →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
