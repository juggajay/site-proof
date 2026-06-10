// Mobile card list for the Drawing Register (PR-M).
// Renders one card per drawing with drawing number, title, revision chip,
// status badge, discipline/date secondary fields, and per-card actions.
// All permission gating mirrors DrawingRegisterTable exactly.
import { useState } from 'react';
import { NativeSelect } from '@/components/ui/native-select';
import { DRAWING_STATUSES, formatFileSize, type Drawing } from '../drawingsUploadData';

interface DrawingMobileListProps {
  drawings: Drawing[];
  hasActiveFilters: boolean;
  canManageDrawings: boolean;
  statusChangePending: boolean;
  handleStatusChange: (drawingId: string, newStatus: string) => void;
  handleOpenDrawing: (drawing: Drawing) => Promise<void>;
  openRevisionModal: (drawing: Drawing) => void;
  setDrawingPendingDelete: (drawing: Drawing | null) => void;
}

// Per-card "More" menu — shown when canManageDrawings is true and there are
// manage actions available (revision + delete). Keeps the card surface clean
// while still offering all desktop row actions at ≥44 px tap targets.
function DrawingCardMoreMenu({
  drawing,
  canRevise,
  onRevision,
  onDelete,
}: {
  drawing: Drawing;
  canRevise: boolean;
  onRevision: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`More actions for ${drawing.drawingNumber}`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted active:bg-muted/80"
      >
        {/* Three-dot vertical icon */}
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 14a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
        </svg>
      </button>

      {open && (
        <>
          {/* Backdrop to close menu on outside click */}
          <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-12 z-20 min-w-[160px] rounded-lg border bg-popover py-1 shadow-md"
          >
            {canRevise && (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-4 py-3 text-sm hover:bg-muted active:bg-muted/80"
                onClick={() => {
                  setOpen(false);
                  onRevision();
                }}
              >
                {/* Refresh / revision icon */}
                <svg
                  className="h-4 w-4 shrink-0"
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
                New Revision
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 active:bg-destructive/20"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              {/* Trash icon */}
              <svg
                className="h-4 w-4 shrink-0"
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
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function DrawingMobileList({
  drawings,
  hasActiveFilters,
  canManageDrawings,
  statusChangePending,
  handleStatusChange,
  handleOpenDrawing,
  openRevisionModal,
  setDrawingPendingDelete,
}: DrawingMobileListProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
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
            : 'Upload your first drawing to get started.'}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y" data-testid="drawing-mobile-list">
      {drawings.map((drawing) => {
        const statusInfo = getStatusInfo(drawing.status);
        const canRevise = canManageDrawings && !drawing.supersededBy;
        const issueDate = formatDate(drawing.issueDate);

        return (
          <div
            key={drawing.id}
            className={`border-l-4 border-l-transparent p-4 ${drawing.supersededBy ? 'opacity-60' : ''}`}
            data-testid={`drawing-card-${drawing.id}`}
          >
            {/* Card header: drawing number + title, revision chip, more-menu */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold leading-tight">{drawing.drawingNumber}</span>
                  {drawing.revision && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      Rev {drawing.revision}
                    </span>
                  )}
                  {drawing.supersededBy && (
                    <span className="text-xs text-warning">(Superseded)</span>
                  )}
                </div>
                {drawing.title && (
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">
                    {drawing.title}
                  </p>
                )}
              </div>

              {/* Primary action: open/download — always visible, 44px tap target */}
              <button
                type="button"
                onClick={() => void handleOpenDrawing(drawing)}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-muted active:bg-muted/80"
                aria-label={`Download ${drawing.drawingNumber}`}
                title="Download"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>

              {/* More-actions menu — only when managing drawings */}
              {canManageDrawings && (
                <DrawingCardMoreMenu
                  drawing={drawing}
                  canRevise={canRevise}
                  onRevision={() => openRevisionModal(drawing)}
                  onDelete={() => setDrawingPendingDelete(drawing)}
                />
              )}
            </div>

            {/* Status badge / selector */}
            <div className="mt-3">
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
            </div>

            {/* Secondary fields: file name/size + issue date */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="truncate max-w-[200px]" title={drawing.document.filename}>
                {drawing.document.filename}
                {drawing.document.fileSize != null && (
                  <span className="ml-1">({formatFileSize(drawing.document.fileSize)})</span>
                )}
              </span>
              {issueDate && <span>{issueDate}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
