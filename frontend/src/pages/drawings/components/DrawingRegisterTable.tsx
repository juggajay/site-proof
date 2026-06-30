// Feature #250: Drawing Register table region moved out of DrawingsPage.
// The loading/error/empty/table JSX below is moved verbatim from the page, and
// prop names intentionally match the page's variable names so the markup stays
// byte-identical with the pre-extraction page. The one rename: the page-owned
// statusChangeMutation.isPending arrives as the statusChangePending prop.
//
// PR-M: when isMobile is true, renders DrawingMobileList (card view) instead of
// the overflow table — desktop output is byte-for-byte unchanged.
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { DRAWING_STATUSES, formatFileSize, type Drawing } from '../drawingsUploadData';
import { DrawingMobileList } from './DrawingMobileList';

interface DrawingRegisterTableProps {
  loading: boolean;
  error: string | null;
  drawings: Drawing[];
  hasActiveFilters: boolean;
  canManageDrawings: boolean;
  /** True while the page's status-change mutation is in flight. */
  statusChangePending: boolean;
  handleStatusChange: (drawingId: string, newStatus: string) => void;
  handleOpenDrawing: (drawing: Drawing) => Promise<void>;
  openRevisionModal: (drawing: Drawing) => void;
  setDrawingPendingDelete: (drawing: Drawing | null) => void;
  /** When true, renders a mobile card list instead of the overflow table. */
  isMobile?: boolean;
}

export function DrawingRegisterTable({
  loading,
  error,
  drawings,
  hasActiveFilters,
  canManageDrawings,
  statusChangePending,
  handleStatusChange,
  handleOpenDrawing,
  openRevisionModal,
  setDrawingPendingDelete,
  isMobile = false,
}: DrawingRegisterTableProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusInfo = (status: string) => {
    return (
      DRAWING_STATUSES.find((s) => s.id === status) || {
        id: status,
        label: status,
        color: 'bg-muted text-foreground',
      }
    );
  };

  // Loading and error states are the same for both views.
  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading drawings...</div>;
  }

  if (error) {
    return null;
  }

  // Mobile card list — renders when the page detects a narrow viewport.
  if (isMobile) {
    return (
      <DrawingMobileList
        drawings={drawings}
        hasActiveFilters={hasActiveFilters}
        canManageDrawings={canManageDrawings}
        statusChangePending={statusChangePending}
        handleStatusChange={handleStatusChange}
        handleOpenDrawing={handleOpenDrawing}
        openRevisionModal={openRevisionModal}
        setDrawingPendingDelete={setDrawingPendingDelete}
      />
    );
  }

  // Desktop: overflow table — byte-for-byte identical to the pre-PR output.
  if (drawings.length === 0) {
    return (
      <div className="p-12 text-center">
        <svg
          className="mx-auto h-12 w-12 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-4 text-lg font-medium">No drawings found</h3>
        <p className="mt-2 text-muted-foreground">
          {hasActiveFilters
            ? 'No drawings match the current filters.'
            : canManageDrawings
              ? 'Upload your first drawing to get started.'
              : 'No project drawings are available yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">Drawing No.</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Title</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Revision</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Issue Date</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">File</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {drawings.map((drawing) => {
            const statusInfo = getStatusInfo(drawing.status);
            return (
              <tr
                key={drawing.id}
                className={`hover:bg-muted/30 ${drawing.supersededBy ? 'opacity-60' : ''}`}
              >
                <td className="px-4 py-3">
                  <span className="font-medium">{drawing.drawingNumber}</span>
                  {drawing.supersededBy && (
                    <span className="ml-2 text-xs text-warning">(Superseded)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">{drawing.title || '-'}</td>
                <td className="px-4 py-3 text-sm">{drawing.revision || '-'}</td>
                <td className="px-4 py-3 text-sm">{formatDate(drawing.issueDate)}</td>
                <td className="px-4 py-3">
                  {canManageDrawings ? (
                    <NativeSelect
                      aria-label={`Status for ${drawing.drawingNumber}`}
                      value={drawing.status}
                      disabled={statusChangePending}
                      onChange={(e) => handleStatusChange(drawing.id, e.target.value)}
                      className={`rounded-full px-3 py-1 text-xs font-medium h-auto ${statusInfo.color}`}
                    >
                      {DRAWING_STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : (
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="truncate max-w-[150px]" title={drawing.document.filename}>
                      {drawing.document.filename}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({formatFileSize(drawing.document.fileSize)})
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void handleOpenDrawing(drawing)}
                      className="rounded-md p-2 hover:bg-muted"
                      aria-label={`Download ${drawing.drawingNumber}`}
                      title="Download"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </button>
                    {canManageDrawings && !drawing.supersededBy && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openRevisionModal(drawing)}
                        className="h-8 w-8 hover:bg-muted"
                        aria-label={`Upload new revision for ${drawing.drawingNumber}`}
                        title="Upload New Revision"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                      </Button>
                    )}
                    {canManageDrawings && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDrawingPendingDelete(drawing)}
                        className="text-destructive hover:bg-destructive/10 h-8 w-8"
                        aria-label={`Delete ${drawing.drawingNumber}`}
                        title="Delete"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
