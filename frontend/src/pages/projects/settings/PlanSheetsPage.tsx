import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Map, Plus, Trash2, Edit2, Crosshair } from 'lucide-react';

import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { logError } from '@/lib/logger';
import { extractErrorMessage } from '@/lib/errorHandling';
import { coordinateSystemLabel } from '@/lib/spatial/coordinateSystems';
import {
  ProjectAdminLoadError,
  ProjectAdminResourceGate,
  ProjectAdminStatusBanners,
} from './ProjectAdminPageState';
import { useControlLines } from './controlLinesData';
import {
  useDeletePlanSheet,
  usePlanSheets,
  usePlanSheetsAccess,
  useUpdatePlanSheet,
  type PlanSheetListItem,
} from './planSheetsData';
import { DEFAULT_COORDINATE_SYSTEM } from '@/lib/spatial/coordinateSystems';
import { PlanSheetUploadModal } from './PlanSheetUploadModal';
import { PlanSheetRegistrationModal } from './PlanSheetRegistrationModal';

function RegistrationBadge({ sheet }: { sheet: PlanSheetListItem }) {
  if (sheet.hasRegistration) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        Registered
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
      Not registered
    </span>
  );
}

function PlanSheetsEmptyState({ readOnly, onAdd }: { readOnly: boolean; onAdd: () => void }) {
  return (
    <div className="rounded-lg border p-12 text-center">
      <Map className="mx-auto h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold">No plan sheets yet</h3>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground">
        Upload construction plan PDFs and georeference them so lots can be drawn and viewed on your
        drawings.
      </p>
      <Button type="button" onClick={onAdd} className="mt-4" disabled={readOnly}>
        Add plan sheets
      </Button>
    </div>
  );
}

function RenameModal({
  sheet,
  saving,
  onSubmit,
  onClose,
}: {
  sheet: PlanSheetListItem;
  saving: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(sheet.name);
  return (
    <Modal onClose={() => !saving && onClose()}>
      <ModalHeader>Rename plan sheet</ModalHeader>
      <ModalBody>
        <Label htmlFor="rename-plan-sheet" className="mb-1">
          Name
        </Label>
        <Input
          id="rename-plan-sheet"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => onSubmit(name.trim())}
          disabled={saving || !name.trim()}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

function PlanSheetsTable({
  sheets,
  canManage,
  readOnly,
  deletingId,
  onRegister,
  onRename,
  onRequestDelete,
}: {
  sheets: PlanSheetListItem[];
  canManage: boolean;
  readOnly: boolean;
  deletingId: string | null;
  onRegister: (sheet: PlanSheetListItem) => void;
  onRename: (sheet: PlanSheetListItem) => void;
  onRequestDelete: (sheet: PlanSheetListItem) => void;
}) {
  const showActions = canManage && !readOnly;
  return (
    <div className="rounded-lg border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Page</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Dimensions</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Coordinate system</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Registration</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Created</th>
              {showActions && <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sheets.map((sheet) => (
              <tr key={sheet.id} className="hover:bg-muted/25">
                <td className="px-4 py-3 font-medium">{sheet.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{sheet.pageNumber}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {sheet.imageWidth} × {sheet.imageHeight}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {coordinateSystemLabel(sheet.coordinateSystem)}
                </td>
                <td className="px-4 py-3">
                  <RegistrationBadge sheet={sheet} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(sheet.createdAt).toLocaleDateString()}
                </td>
                {showActions && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRegister(sheet)}
                        className="text-primary hover:bg-primary/5"
                      >
                        <Crosshair className="h-4 w-4" />
                        {sheet.hasRegistration ? 'Re-register' : 'Register'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRename(sheet)}
                        aria-label={`Rename ${sheet.name}`}
                        title="Rename"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRequestDelete(sheet)}
                        disabled={deletingId === sheet.id}
                        className="text-destructive hover:bg-destructive/10"
                        aria-label={`Delete ${sheet.name}`}
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

export function PlanSheetsPage() {
  const { projectId } = useParams();
  const [showUpload, setShowUpload] = useState(false);
  const [registerSheet, setRegisterSheet] = useState<PlanSheetListItem | null>(null);
  const [renameSheet, setRenameSheet] = useState<PlanSheetListItem | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PlanSheetListItem | null>(null);

  const { project, canManage, readOnly, loading: accessLoading } = usePlanSheetsAccess(projectId);
  const sheetsQuery = usePlanSheets(projectId);
  const controlLinesQuery = useControlLines(projectId);
  const updateMutation = useUpdatePlanSheet(projectId);
  const deleteMutation = useDeletePlanSheet(projectId);

  const sheets = sheetsQuery.data ?? [];
  const loading = accessLoading || sheetsQuery.isLoading;
  const loadError = sheetsQuery.error
    ? extractErrorMessage(sheetsQuery.error, 'Could not load plan sheets.')
    : !projectId
      ? 'Project not found'
      : null;

  // Default the upload's coordinate system to the project's control line when one
  // exists — the sheet almost always shares the alignment's datum.
  const defaultCoordinateSystem =
    controlLinesQuery.data?.[0]?.coordinateSystem ?? DEFAULT_COORDINATE_SYSTEM;

  const openUpload = () => {
    if (readOnly || !canManage) return;
    setShowUpload(true);
  };

  const handleRename = async (name: string) => {
    if (!renameSheet || !name) return;
    try {
      await updateMutation.mutateAsync({ id: renameSheet.id, input: { name } });
      toast({ title: 'Plan sheet renamed', description: `Renamed to ${name}.` });
      setRenameSheet(null);
    } catch (error) {
      logError('Failed to rename plan sheet:', error);
      toast({
        title: 'Failed to rename plan sheet',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  const handleDelete = async (sheet: PlanSheetListItem) => {
    try {
      await deleteMutation.mutateAsync(sheet.id);
      toast({ title: 'Plan sheet deleted', description: `${sheet.name} has been removed.` });
      setPendingDelete(null);
    } catch (error) {
      logError('Failed to delete plan sheet:', error);
      toast({
        title: 'Failed to delete plan sheet',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan Sheets</h1>
          <p className="text-muted-foreground">
            Georeferenced construction drawings for placing and viewing lots on the plan.
          </p>
        </div>
        {canManage && (
          <Button type="button" onClick={openUpload} disabled={readOnly}>
            <Plus className="h-4 w-4" />
            Add plan sheets
          </Button>
        )}
      </div>

      <ProjectAdminStatusBanners
        project={project}
        canManage={true}
        readOnly={readOnly}
        deniedMessage=""
        archivedMessage="Archived projects are read-only. Restore the project before editing plan sheets."
      />

      <ProjectAdminLoadError message={loadError} onRetry={() => void sheetsQuery.refetch()} />

      <ProjectAdminResourceGate loading={loading} loadError={loadError} canManage={true}>
        {sheets.length === 0 ? (
          <PlanSheetsEmptyState readOnly={readOnly || !canManage} onAdd={openUpload} />
        ) : (
          <PlanSheetsTable
            sheets={sheets}
            canManage={canManage}
            readOnly={readOnly}
            deletingId={deleteMutation.isLoading ? (pendingDelete?.id ?? null) : null}
            onRegister={setRegisterSheet}
            onRename={setRenameSheet}
            onRequestDelete={setPendingDelete}
          />
        )}
      </ProjectAdminResourceGate>

      {showUpload && projectId && (
        <PlanSheetUploadModal
          projectId={projectId}
          defaultCoordinateSystem={defaultCoordinateSystem}
          onClose={() => setShowUpload(false)}
          onUploaded={() => void sheetsQuery.refetch()}
        />
      )}

      {registerSheet && projectId && (
        <PlanSheetRegistrationModal
          projectId={projectId}
          sheet={registerSheet}
          onClose={() => setRegisterSheet(null)}
          onSaved={() => void sheetsQuery.refetch()}
        />
      )}

      {renameSheet && (
        <RenameModal
          sheet={renameSheet}
          saving={updateMutation.isLoading}
          onSubmit={(name) => void handleRename(name)}
          onClose={() => setRenameSheet(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete plan sheet"
        description={
          <p>
            Delete {pendingDelete?.name ? `"${pendingDelete.name}"` : 'this plan sheet'}? Any lot
            geometry drawn on it will no longer render.
          </p>
        }
        confirmLabel={deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
        variant="destructive"
        confirmDisabled={deleteMutation.isLoading}
        cancelDisabled={deleteMutation.isLoading}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete);
        }}
      />
    </div>
  );
}
