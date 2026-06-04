import { useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import type { DocketDetailPDFData } from '@/lib/pdfGenerator';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { DocketApprovalsMobileView } from '@/components/foreman/DocketApprovalsMobileView';
import { logError } from '@/lib/logger';
import { buildScopedCsvFilename, downloadCsv } from '@/lib/csv';
import {
  type Docket,
  type ProjectResponse,
  useDocketApprovalsQuery,
  useDocketProjectQuery,
} from './docketApprovalsData';
import {
  type DocketActionType,
  HOURS_INPUT_ERROR,
  parseHoursInput,
  statusLabels,
} from './docketActionData';
import { DocketActionModal } from './components/DocketActionModal';
import { CreateDocketModal } from './components/CreateDocketModal';
import { DocketApprovalsTable } from './components/DocketApprovalsTable';

const EMPTY_DOCKETS: Docket[] = [];

export function DocketApprovalsPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for filtering — initialise from URL
  const initialStatus = searchParams.get('status') || 'all';
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);

  // State for create docket modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newDocketDate, setNewDocketDate] = useState('');
  const [newDocketLabourHours, setNewDocketLabourHours] = useState('');
  const [newDocketPlantHours, setNewDocketPlantHours] = useState('');
  const [newDocketNotes, setNewDocketNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // State for approve/reject/view modal — only the trigger lives here; all of the
  // modal's own working state (notes, adjusted hours, detail entries, submission)
  // lives inside DocketActionModal.
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<DocketActionType>('approve');
  const [selectedDocket, setSelectedDocket] = useState<Docket | null>(null);
  const creatingRef = useRef(false);
  const submittingDocketRef = useRef<string | null>(null);
  const printingDocketRef = useRef<string | null>(null);
  const [printingDocketId, setPrintingDocketId] = useState<string | null>(null);

  const docketsQuery = useDocketApprovalsQuery(projectId, statusFilter);
  const projectQuery = useDocketProjectQuery(projectId);
  const { refetch: refetchDocketsQuery } = docketsQuery;
  const dockets = docketsQuery.data ?? EMPTY_DOCKETS;
  const loading = docketsQuery.isLoading;
  const loadError =
    docketsQuery.error && !docketsQuery.data
      ? extractErrorMessage(docketsQuery.error, 'Failed to fetch dockets')
      : null;
  const projectInfo = projectQuery.data ?? null;

  const refetchDockets = useCallback(async () => {
    await refetchDocketsQuery();
  }, [refetchDocketsQuery]);

  // Role checks - use roleInCompany which is the field returned from the backend
  const userRole = user?.roleInCompany || user?.role;
  const isSubcontractor = userRole === 'subcontractor' || userRole === 'subcontractor_admin';
  const projectLabel = projectInfo?.name || projectId || 'this project';
  const subcontractorSetupHref = projectId ? `/projects/${projectId}/subcontractors` : '/projects';

  const canApprove = ['owner', 'admin', 'project_manager', 'site_manager', 'foreman'].includes(
    userRole || '',
  );

  // Sync filter changes to URL query params
  const handleFilterChange = (newFilter: string) => {
    setStatusFilter(newFilter);
    if (newFilter === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ status: newFilter });
    }
  };

  // Mobile: tap a docket card — open detail view for any docket
  const handleTapDocket = (docket: Docket) => {
    if (docket.status === 'pending_approval' && canApprove) {
      openActionModal(docket, 'approve');
    } else {
      openActionModal(docket, 'view');
    }
  };

  // Exclude drafts from the approvals view — only submitted dockets belong here
  const submittedDockets = useMemo(() => {
    return dockets.filter((d) => d.status !== 'draft');
  }, [dockets]);

  // Computed values
  const filteredDockets = useMemo(() => {
    if (statusFilter === 'all') return submittedDockets;
    return submittedDockets.filter((d) => d.status === statusFilter);
  }, [submittedDockets, statusFilter]);

  const pendingCount = useMemo(() => {
    return submittedDockets.filter((d) => d.status === 'pending_approval').length;
  }, [submittedDockets]);

  const totalLabourHours = useMemo(() => {
    return filteredDockets.reduce((sum, d) => sum + (d.labourHours || 0), 0);
  }, [filteredDockets]);

  const totalPlantHours = useMemo(() => {
    return filteredDockets.reduce((sum, d) => sum + (d.plantHours || 0), 0);
  }, [filteredDockets]);

  // Create a new docket
  const handleCreateDocket = async () => {
    if (creatingRef.current) return;

    if (!newDocketDate) {
      toast({ variant: 'error', description: 'Date is required' });
      return;
    }

    const labourHours = parseHoursInput(newDocketLabourHours);
    const plantHours = parseHoursInput(newDocketPlantHours);
    if (labourHours === null || plantHours === null) {
      toast({ variant: 'warning', description: HOURS_INPUT_ERROR });
      return;
    }

    creatingRef.current = true;
    setCreating(true);

    try {
      await apiFetch(`/api/dockets`, {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          date: newDocketDate,
          labourHours,
          plantHours,
          notes: newDocketNotes.trim() || null,
        }),
      });

      toast({ variant: 'success', description: 'Docket created successfully' });
      setCreateModalOpen(false);
      setNewDocketDate('');
      setNewDocketLabourHours('');
      setNewDocketPlantHours('');
      setNewDocketNotes('');
      await refetchDockets();
    } catch (error) {
      logError('Error creating docket:', error);
      toast({
        variant: 'error',
        description: extractErrorMessage(error, 'Failed to create docket'),
      });
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  // Submit a draft docket for approval
  const handleSubmitDocket = async (docket: Docket) => {
    if (submittingDocketRef.current === docket.id) return;

    submittingDocketRef.current = docket.id;
    try {
      await apiFetch(`/api/dockets/${encodeURIComponent(docket.id)}/submit`, { method: 'POST' });
      toast({ variant: 'success', description: 'Docket submitted for approval' });
      await refetchDockets();
    } catch (error) {
      logError('Error submitting docket:', error);
      toast({
        variant: 'error',
        description: extractErrorMessage(error, 'Failed to submit docket'),
      });
    } finally {
      submittingDocketRef.current = null;
    }
  };

  // Open the approve/reject/view modal. DocketActionModal mounts fresh each time,
  // seeds its own adjusted-hours/notes state from the docket, and fetches the
  // detail entries via its keyed query.
  const openActionModal = (docket: Docket, type: DocketActionType) => {
    setSelectedDocket(docket);
    setActionType(type);
    setActionModalOpen(true);
  };

  // Export dockets to CSV
  const handleExportCSV = () => {
    const headers = [
      'Docket #',
      'Subcontractor',
      'Date',
      'Notes',
      'Labour Hours',
      'Plant Hours',
      'Status',
      'Submitted At',
      'Approved At',
    ];
    const rows = filteredDockets.map((docket) => [
      docket.docketNumber,
      docket.subcontractor,
      docket.date,
      docket.notes || '-',
      docket.labourHours,
      docket.plantHours,
      statusLabels[docket.status] || docket.status,
      docket.submittedAt ? new Date(docket.submittedAt).toLocaleDateString('en-AU') : '-',
      docket.approvedAt ? new Date(docket.approvedAt).toLocaleDateString('en-AU') : '-',
    ]);

    downloadCsv(buildScopedCsvFilename('dockets', projectInfo?.name || projectId), [
      headers,
      ...rows,
    ]);
  };

  const handlePrintDocket = async (docket: Docket) => {
    if (printingDocketRef.current === docket.id) return;

    printingDocketRef.current = docket.id;
    setPrintingDocketId(docket.id);

    try {
      let project: ProjectResponse['project'] = { name: 'Unknown Project', projectNumber: null };
      try {
        if (projectId) {
          const projectResponse = await apiFetch<ProjectResponse>(
            `/api/projects/${encodeURIComponent(projectId)}`,
          );
          project = projectResponse.project;
        }
      } catch {
        // Use default project info when a docket PDF can still be generated.
      }

      const pdfData: DocketDetailPDFData = {
        docket: {
          id: docket.id,
          docketNumber: docket.docketNumber,
          date: docket.date,
          status: docket.status,
          notes: docket.notes,
          labourHours: docket.labourHours,
          plantHours: docket.plantHours,
          totalLabourSubmitted: docket.totalLabourSubmitted,
          totalLabourApproved: docket.totalLabourApproved,
          totalPlantSubmitted: docket.totalPlantSubmitted,
          totalPlantApproved: docket.totalPlantApproved,
          submittedAt: docket.submittedAt,
          approvedAt: docket.approvedAt,
          foremanNotes: docket.foremanNotes,
        },
        subcontractor: {
          name: docket.subcontractor,
        },
        project: {
          name: project?.name || 'Unknown Project',
          projectNumber: project?.projectNumber || null,
        },
      };

      const { generateDocketDetailPDF } = await import('@/lib/pdfGenerator');
      await generateDocketDetailPDF(pdfData);
      toast({ title: 'Docket PDF downloaded', variant: 'success' });
    } catch (err) {
      logError('Error generating docket PDF:', err);
      toast({ title: 'Failed to generate PDF', variant: 'error' });
    } finally {
      printingDocketRef.current = null;
      setPrintingDocketId(null);
    }
  };

  return (
    <>
      {isMobile ? (
        <DocketApprovalsMobileView
          dockets={dockets}
          filteredDockets={filteredDockets}
          loading={loading}
          statusFilter={statusFilter}
          setStatusFilter={handleFilterChange}
          pendingCount={pendingCount}
          totalLabourHours={totalLabourHours}
          totalPlantHours={totalPlantHours}
          loadError={loadError}
          canApprove={canApprove}
          subcontractorSetupHref={subcontractorSetupHref}
          onApprove={(d) => openActionModal(d, 'approve')}
          onQuery={(d) => openActionModal(d, 'query')}
          onReject={(d) => openActionModal(d, 'reject')}
          onTapDocket={handleTapDocket}
          onRefresh={refetchDockets}
        />
      ) : (
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Docket Approvals</h1>
              <p className="text-sm text-muted-foreground">
                Review and approve subcontractor dockets for project {projectLabel}
              </p>
            </div>
            <div className="flex gap-2">
              {dockets.length > 0 && (
                <Button variant="outline" onClick={handleExportCSV}>
                  Export CSV
                </Button>
              )}
              {isSubcontractor && (
                <Button onClick={() => setCreateModalOpen(true)}>Create Docket</Button>
              )}
              <Button
                variant={statusFilter === 'all' ? 'secondary' : 'outline'}
                onClick={() => handleFilterChange('all')}
              >
                All Dockets
              </Button>
              <Button
                variant={statusFilter === 'pending_approval' ? 'default' : 'outline'}
                onClick={() => handleFilterChange('pending_approval')}
              >
                Pending ({pendingCount})
              </Button>
            </div>
          </div>

          {loadError && (
            <div
              className="rounded-lg border border-destructive/30 bg-destructive/10 p-4"
              role="alert"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-destructive">{loadError}</p>
                <Button type="button" variant="outline" onClick={() => void refetchDockets()}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {/* Dockets Table */}
          {!loadError && (
            <DocketApprovalsTable
              loading={loading}
              filteredDockets={filteredDockets}
              submittedDockets={submittedDockets}
              statusFilter={statusFilter}
              subcontractorSetupHref={subcontractorSetupHref}
              canApprove={canApprove}
              isSubcontractor={isSubcontractor}
              printingDocketId={printingDocketId}
              onTapDocket={handleTapDocket}
              onPrintDocket={handlePrintDocket}
              onSubmitDocket={handleSubmitDocket}
              onApprove={(d) => openActionModal(d, 'approve')}
              onQuery={(d) => openActionModal(d, 'query')}
              onReject={(d) => openActionModal(d, 'reject')}
            />
          )}

          {/* Operational Summary */}
          <div className="rounded-lg border p-4">
            <h2 className="text-lg font-semibold mb-4">Operational Summary</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Pending Approvals</span>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Total Labour Hours</span>
                <p className="text-2xl font-bold">{totalLabourHours}h</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Total Plant Hours</span>
                <p className="text-2xl font-bold">{totalPlantHours}h</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Docket Modal — renders for both mobile & desktop */}
      {createModalOpen && (
        <CreateDocketModal
          date={newDocketDate}
          onDateChange={setNewDocketDate}
          labourHours={newDocketLabourHours}
          onLabourHoursChange={setNewDocketLabourHours}
          plantHours={newDocketPlantHours}
          onPlantHoursChange={setNewDocketPlantHours}
          notes={newDocketNotes}
          onNotesChange={setNewDocketNotes}
          creating={creating}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={handleCreateDocket}
        />
      )}

      {/* Approve/Reject/View Modal */}
      {actionModalOpen && selectedDocket && (
        <DocketActionModal
          docket={selectedDocket}
          initialActionType={actionType}
          canApprove={canApprove}
          onClose={() => setActionModalOpen(false)}
          onActionComplete={async () => {
            setActionModalOpen(false);
            setSelectedDocket(null);
            await refetchDockets();
          }}
        />
      )}
    </>
  );
}
