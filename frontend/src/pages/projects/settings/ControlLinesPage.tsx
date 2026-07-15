import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spline, Plus, Trash2, Edit2, FileUp, ScanText } from 'lucide-react';

import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logError } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/errorHandling';
import { useAiStatus } from '@/hooks/useAiStatus';
import {
  coordinateSystemLabel,
  defaultCoordinateSystemForState,
} from '@/lib/spatial/coordinateSystems';
import type { ControlPoint } from './controlPointsParsing';
import {
  ProjectAdminLoadError,
  ProjectAdminResourceGate,
  ProjectAdminStatusBanners,
} from './ProjectAdminPageState';
import { ControlLineFormModal } from './ControlLineFormModal';
import { ControlLineImportModal } from './ControlLineImportModal';
import { SetoutImportModal } from './SetoutImportModal';
import {
  useControlLines,
  useControlLinesAccess,
  useCreateControlLine,
  useDeleteControlLine,
  useUpdateControlLine,
  type ControlLine,
  type ControlLineInput,
} from './controlLinesData';

function chainageRange(points: ControlPoint[]): string {
  if (points.length === 0) return '-';
  const chainages = points.map((p) => p.chainage);
  const min = Math.min(...chainages);
  const max = Math.max(...chainages);
  return `${min.toLocaleString()} – ${max.toLocaleString()}`;
}

function ControlLinesEmptyState({ readOnly, onAdd }: { readOnly: boolean; onAdd: () => void }) {
  return (
    <div className="rounded-lg border p-12 text-center">
      <Spline className="mx-auto h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">No control lines yet</h3>
      <p className="mt-2 text-muted-foreground">
        Add a control line (alignment) so lots can be placed by chainage and offset.
      </p>
      <Button type="button" onClick={onAdd} className="mt-4" disabled={readOnly}>
        Add First Control Line
      </Button>
    </div>
  );
}

function ControlLinesTable({
  controlLines,
  canManage,
  readOnly,
  deletingId,
  onEdit,
  onRequestDelete,
}: {
  controlLines: ControlLine[];
  canManage: boolean;
  readOnly: boolean;
  deletingId: string | null;
  onEdit: (line: ControlLine) => void;
  onRequestDelete: (line: ControlLine) => void;
}) {
  const showActions = canManage && !readOnly;
  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Coordinate system</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Points</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Chainage range</th>
              {showActions && <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {controlLines.map((line) => (
              <tr key={line.id} className="hover:bg-muted/25">
                <td className="px-4 py-3 font-medium">{line.name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {coordinateSystemLabel(line.coordinateSystem)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{line.points.length}</td>
                <td className="px-4 py-3 text-muted-foreground">{chainageRange(line.points)}</td>
                {showActions && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(line)}
                        className="text-primary hover:bg-primary/5"
                        aria-label={`Edit ${line.name}`}
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRequestDelete(line)}
                        disabled={deletingId === line.id}
                        className="text-destructive hover:bg-destructive/10"
                        aria-label={`Delete ${line.name}`}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ControlLinesPage() {
  const { projectId } = useParams();
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSetoutImport, setShowSetoutImport] = useState(false);
  const [editingLine, setEditingLine] = useState<ControlLine | null>(null);
  const [linePendingDelete, setLinePendingDelete] = useState<ControlLine | null>(null);

  const { project, canManage, readOnly, loading: accessLoading } = useControlLinesAccess(projectId);
  const { aiConfigured } = useAiStatus();
  const controlLinesQuery = useControlLines(projectId);
  const createMutation = useCreateControlLine(projectId);
  const updateMutation = useUpdateControlLine(projectId);
  const deleteMutation = useDeleteControlLine(projectId);

  const controlLines = controlLinesQuery.data ?? [];
  // CRS suggested for new geometry: an existing control line's CRS wins (keep
  // geometry consistent), otherwise suggest the zone derived from the project's
  // state. Always user-confirmable in each modal.
  const suggestedCoordinateSystem =
    controlLines[0]?.coordinateSystem ?? defaultCoordinateSystemForState(project?.state);
  const loading = accessLoading || controlLinesQuery.isLoading;
  const loadError = controlLinesQuery.error
    ? extractErrorMessage(controlLinesQuery.error, 'Could not load control lines.')
    : !projectId
      ? 'Project not found'
      : null;
  const saving = createMutation.isLoading || updateMutation.isLoading;

  const openAddModal = () => {
    if (readOnly || !canManage) return;
    setEditingLine(null);
    setShowModal(true);
  };

  const openEditModal = (line: ControlLine) => {
    if (readOnly || !canManage) return;
    setEditingLine(line);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingLine(null);
  };

  const handleSubmit = async (input: ControlLineInput) => {
    if (!projectId) return;
    try {
      if (editingLine) {
        await updateMutation.mutateAsync({ id: editingLine.id, input });
        toast({ title: 'Control line updated', description: `${input.name} has been updated.` });
      } else {
        await createMutation.mutateAsync(input);
        toast({ title: 'Control line created', description: `${input.name} has been added.` });
      }
      closeModal();
    } catch (error) {
      logError('Failed to save control line:', error);
      toast({
        title: 'Failed to save control line',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  const handleDelete = async (line: ControlLine) => {
    if (!projectId) return;
    try {
      await deleteMutation.mutateAsync(line.id);
      toast({ title: 'Control line deleted', description: `${line.name} has been removed.` });
      setLinePendingDelete(null);
    } catch (error) {
      logError('Failed to delete control line:', error);
      toast({
        title: 'Failed to delete control line',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Control Lines</h1>
          <p className="text-muted-foreground">
            Survey alignments used to place lots by chainage and offset.
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowImport(true)}
              disabled={readOnly}
            >
              <FileUp className="h-4 w-4" />
              Import from file
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSetoutImport(true)}
              disabled={readOnly || !aiConfigured}
              title={
                aiConfigured
                  ? undefined
                  : "AI extraction isn't configured on this server. Add points with “Import from file” or “Add Control Line” instead."
              }
            >
              <ScanText className="h-4 w-4" />
              Import from setout sheet
            </Button>
            <Button type="button" onClick={openAddModal} disabled={readOnly}>
              <Plus className="h-4 w-4" />
              Add Control Line
            </Button>
          </div>
        )}
      </div>

      {/* Read access is granted to every internal role, so there is no "denied"
          state here — canManage stays true and only the write buttons above are
          gated. The banner still surfaces the archived read-only state. */}
      <ProjectAdminStatusBanners
        project={project}
        canManage={true}
        readOnly={readOnly}
        deniedMessage=""
        archivedMessage="Archived projects are read-only. Restore the project before editing control lines."
      />

      <ProjectAdminLoadError message={loadError} onRetry={() => void controlLinesQuery.refetch()} />

      <ProjectAdminResourceGate loading={loading} loadError={loadError} canManage={true}>
        {controlLines.length === 0 ? (
          <ControlLinesEmptyState readOnly={readOnly || !canManage} onAdd={openAddModal} />
        ) : (
          <ControlLinesTable
            controlLines={controlLines}
            canManage={canManage}
            readOnly={readOnly}
            deletingId={deleteMutation.isLoading ? (linePendingDelete?.id ?? null) : null}
            onEdit={openEditModal}
            onRequestDelete={setLinePendingDelete}
          />
        )}
      </ProjectAdminResourceGate>

      {showModal && (
        <ControlLineFormModal
          initial={editingLine}
          saving={saving}
          onSubmit={(input) => void handleSubmit(input)}
          onClose={closeModal}
          defaultCoordinateSystem={suggestedCoordinateSystem}
        />
      )}

      {showImport && projectId && (
        <ControlLineImportModal
          projectId={projectId}
          defaultCoordinateSystem={suggestedCoordinateSystem}
          onClose={() => setShowImport(false)}
        />
      )}

      {showSetoutImport && projectId && (
        <SetoutImportModal
          projectId={projectId}
          defaultCoordinateSystem={suggestedCoordinateSystem}
          onClose={() => setShowSetoutImport(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(linePendingDelete)}
        title="Delete Control Line"
        description={
          <>
            <p>
              Delete {linePendingDelete?.name ? `"${linePendingDelete.name}"` : 'this control line'}
              ?
            </p>
            <p>Lot geometry generated from this control line may no longer render on the map.</p>
          </>
        }
        confirmLabel={deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
        variant="destructive"
        confirmDisabled={deleteMutation.isLoading}
        cancelDisabled={deleteMutation.isLoading}
        onCancel={() => setLinePendingDelete(null)}
        onConfirm={() => {
          if (linePendingDelete) void handleDelete(linePendingDelete);
        }}
      />
    </div>
  );
}
