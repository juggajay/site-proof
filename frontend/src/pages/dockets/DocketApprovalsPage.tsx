import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { X, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { DocketDetailPDFData } from '@/lib/pdfGenerator';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { useIsMobile } from '@/hooks/useMediaQuery';
import { DocketApprovalsMobileView } from '@/components/foreman/DocketApprovalsMobileView';
import { devLog, logError } from '@/lib/logger';
import { downloadCsv } from '@/lib/csv';

interface Docket {
  id: string;
  docketNumber: string;
  subcontractor: string;
  subcontractorId: string;
  date: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected';
  notes: string | null;
  labourHours: number;
  plantHours: number;
  totalLabourSubmitted: number;
  totalLabourApproved: number;
  totalPlantSubmitted: number;
  totalPlantApproved: number;
  submittedAt: string | null;
  approvedAt: string | null;
  foremanNotes: string | null;
}

interface LabourEntry {
  id: string;
  employee: { name: string; role: string };
  startTime: string | null;
  finishTime: string | null;
  submittedHours: number;
  approvedHours: number;
  hourlyRate: number;
  submittedCost: number;
  approvedCost: number;
}

interface PlantEntry {
  id: string;
  plant: { type: string; description: string; idRego?: string };
  hoursOperated: number;
  wetOrDry: string;
  hourlyRate: number;
  submittedCost: number;
  approvedCost: number;
}

type DocketsResponse = Docket[] | { dockets?: Docket[] };

interface DocketDetailResponse {
  docket?: {
    labourEntries?: LabourEntry[];
    plantEntries?: PlantEntry[];
  };
}

interface ProjectResponse {
  project?: {
    name?: string | null;
    projectNumber?: string | null;
  };
}

const normalizeDockets = (data: DocketsResponse): Docket[] =>
  Array.isArray(data) ? data : data.dockets || [];

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-foreground',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
};

const HOURS_INPUT_ERROR = 'Hours must be a non-negative decimal number.';
const HOURS_INPUT_PATTERN = /^\d+(?:\.\d+)?$/;

function parseHoursInput(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  if (!HOURS_INPUT_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function hasHoursChanged(value: string, submittedHours: number): boolean {
  const parsed = parseHoursInput(value);
  return parsed !== null && parsed !== submittedHours;
}

export function DocketApprovalsPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  // State for dockets and filtering — initialise from URL
  const [dockets, setDockets] = useState<Docket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initialStatus = searchParams.get('status') || 'all';
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);

  // State for create docket modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newDocketDate, setNewDocketDate] = useState('');
  const [newDocketLabourHours, setNewDocketLabourHours] = useState('');
  const [newDocketPlantHours, setNewDocketPlantHours] = useState('');
  const [newDocketNotes, setNewDocketNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // State for approve/reject/view modal
  const [actionModalOpen, setActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'view'>('approve');
  const [selectedDocket, setSelectedDocket] = useState<Docket | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [actionInProgress, setActionInProgress] = useState(false);
  const [adjustedLabourHours, setAdjustedLabourHours] = useState('');
  const [adjustedPlantHours, setAdjustedPlantHours] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const creatingRef = useRef(false);
  const submittingDocketRef = useRef<string | null>(null);
  const actionInProgressRef = useRef(false);
  const printingDocketRef = useRef<string | null>(null);
  const [printingDocketId, setPrintingDocketId] = useState<string | null>(null);

  // State for docket detail entries (fetched on modal open)
  const [detailLoading, setDetailLoading] = useState(false);
  const [labourEntries, setLabourEntries] = useState<LabourEntry[]>([]);
  const [plantEntries, setPlantEntries] = useState<PlantEntry[]>([]);

  // Role checks - use roleInCompany which is the field returned from the backend
  const userRole = user?.roleInCompany || user?.role;
  const isSubcontractor = userRole === 'subcontractor' || userRole === 'subcontractor_admin';

  // Hours validation helper - warn if hours > 24
  const validateHours = (hours: string): { isValid: boolean; warning: string | null } => {
    const normalizedHours = hours.trim();
    if (!normalizedHours) {
      return { isValid: true, warning: null };
    }
    if (normalizedHours.startsWith('-')) {
      return { isValid: false, warning: 'Hours cannot be negative' };
    }
    const numHours = parseHoursInput(hours);
    if (numHours === null) {
      return { isValid: false, warning: HOURS_INPUT_ERROR };
    }
    if (numHours > 24) {
      return { isValid: true, warning: 'Warning: Hours exceed 24 - please verify this is correct' };
    }
    return { isValid: true, warning: null };
  };

  // Validation state for hours inputs
  const labourHoursValidation = validateHours(newDocketLabourHours);
  const plantHoursValidation = validateHours(newDocketPlantHours);
  const adjustedLabourValidation = validateHours(adjustedLabourHours);
  const adjustedPlantValidation = validateHours(adjustedPlantHours);
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

  // Fetch dockets from API
  const fetchDockets = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const queryParams = new URLSearchParams();
      if (projectId) queryParams.append('projectId', projectId);
      if (statusFilter !== 'all') queryParams.append('status', statusFilter);

      const data = await apiFetch<DocketsResponse>(`/api/dockets?${queryParams.toString()}`);
      setDockets(normalizeDockets(data));
    } catch (error) {
      logError('Error fetching dockets:', error);
      setLoadError(extractErrorMessage(error, 'Failed to fetch dockets'));
      setDockets([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter]);

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
      await fetchDockets();
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
      await fetchDockets();
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

  // Open the approve/reject/view modal and fetch detail entries
  const openActionModal = async (docket: Docket, type: 'approve' | 'reject' | 'view') => {
    setSelectedDocket(docket);
    setActionType(type);
    setActionNotes('');
    // Initialize adjusted values with submitted values
    setAdjustedLabourHours(String(docket.labourHours || 0));
    setAdjustedPlantHours(String(docket.plantHours || 0));
    setAdjustmentReason('');
    setLabourEntries([]);
    setPlantEntries([]);
    setActionModalOpen(true);

    // Fetch full docket detail for labour/plant entries
    setDetailLoading(true);
    try {
      const data = await apiFetch<DocketDetailResponse>(
        `/api/dockets/${encodeURIComponent(docket.id)}`,
      );
      setLabourEntries(data.docket?.labourEntries || []);
      setPlantEntries(data.docket?.plantEntries || []);
    } catch (err) {
      logError('Error fetching docket detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle approve or reject action
  const handleAction = async () => {
    if (!selectedDocket || actionInProgressRef.current) return;

    let adjustedLabourHoursValue: number | undefined;
    let adjustedPlantHoursValue: number | undefined;
    if (actionType === 'approve') {
      const parsedAdjustedLabourHours = parseHoursInput(adjustedLabourHours);
      const parsedAdjustedPlantHours = parseHoursInput(adjustedPlantHours);
      if (parsedAdjustedLabourHours === null || parsedAdjustedPlantHours === null) {
        toast({ variant: 'warning', description: HOURS_INPUT_ERROR });
        return;
      }
      adjustedLabourHoursValue = parsedAdjustedLabourHours;
      adjustedPlantHoursValue = parsedAdjustedPlantHours;
    }

    actionInProgressRef.current = true;
    setActionInProgress(true);
    const endpoint = actionType === 'approve' ? 'approve' : 'reject';

    try {
      await apiFetch(`/api/dockets/${encodeURIComponent(selectedDocket.id)}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(
          actionType === 'approve'
            ? {
                foremanNotes: actionNotes.trim() || null,
                adjustedLabourHours: adjustedLabourHoursValue,
                adjustedPlantHours: adjustedPlantHoursValue,
                adjustmentReason: adjustmentReason.trim() || null,
              }
            : {
                reason: actionNotes.trim() || null,
              },
        ),
      });

      toast({
        variant: 'success',
        description: `Docket ${actionType === 'approve' ? 'approved' : 'rejected'} successfully`,
      });
      setActionModalOpen(false);
      setSelectedDocket(null);
      setActionNotes('');
      await fetchDockets();
    } catch (error) {
      logError(`Error ${actionType}ing docket:`, error);
      toast({
        variant: 'error',
        description: extractErrorMessage(error, `Failed to ${actionType} docket`),
      });
    } finally {
      actionInProgressRef.current = false;
      setActionInProgress(false);
    }
  };

  // Fetch dockets on mount and when filter changes
  useEffect(() => {
    fetchDockets();
  }, [fetchDockets]);

  // Feature #735: Real-time docket approval notification polling
  // Poll for updates every 30 seconds when the tab is visible
  useEffect(() => {
    if (!projectId) return;

    let pollInterval: NodeJS.Timeout | null = null;

    const silentFetchDockets = async () => {
      try {
        const queryParams = new URLSearchParams();
        queryParams.append('projectId', projectId);
        if (statusFilter !== 'all') queryParams.append('status', statusFilter);

        const data = await apiFetch<DocketsResponse>(`/api/dockets?${queryParams.toString()}`);
        const newDockets = normalizeDockets(data);

        // Only update if there are actual changes
        setDockets((prevDockets: Docket[]) => {
          const hasChanges =
            newDockets.length !== prevDockets.length ||
            newDockets.some(
              (newDocket: Docket, index: number) =>
                !prevDockets[index] ||
                newDocket.id !== prevDockets[index].id ||
                newDocket.status !== prevDockets[index].status ||
                newDocket.approvedAt !== prevDockets[index].approvedAt ||
                newDocket.totalLabourApproved !== prevDockets[index].totalLabourApproved,
            );
          return hasChanges ? newDockets : prevDockets;
        });
      } catch (err) {
        // Silent fail for background polling
        devLog('Background docket fetch failed:', err);
      }
    };

    const startPolling = () => {
      pollInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          silentFetchDockets();
        }
      }, 30000); // 30 seconds
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        silentFetchDockets();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [projectId, statusFilter]);

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
      docket.submittedAt ? new Date(docket.submittedAt).toLocaleDateString() : '-',
      docket.approvedAt ? new Date(docket.approvedAt).toLocaleDateString() : '-',
    ]);

    downloadCsv(`dockets-${projectId}-${new Date().toISOString().split('T')[0]}.csv`, [
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
          onApprove={(d) => openActionModal(d, 'approve')}
          onReject={(d) => openActionModal(d, 'reject')}
          onTapDocket={handleTapDocket}
          onRefresh={fetchDockets}
        />
      ) : (
        <div className="space-y-6 p-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Docket Approvals</h1>
              <p className="text-sm text-muted-foreground">
                Review and approve subcontractor dockets for project {projectId}
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
                <Button type="button" variant="outline" onClick={() => void fetchDockets()}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {/* Dockets Table */}
          {!loadError && (
            <div className="rounded-lg border">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">Docket #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Subcontractor</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Notes</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Labour Hrs</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Plant Hrs</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          <span className="ml-2">Loading dockets...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredDockets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                        No dockets found
                      </td>
                    </tr>
                  ) : (
                    filteredDockets.map((docket) => (
                      <tr
                        key={docket.id}
                        className="hover:bg-muted/30 cursor-pointer"
                        onClick={() => handleTapDocket(docket)}
                      >
                        <td className="px-4 py-3 text-sm font-medium">{docket.docketNumber}</td>
                        <td className="px-4 py-3 text-sm">{docket.subcontractor}</td>
                        <td className="px-4 py-3 text-sm">{docket.date}</td>
                        <td
                          className="px-4 py-3 text-sm max-w-xs truncate"
                          title={docket.notes || ''}
                        >
                          {docket.notes || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {docket.status === 'approved' &&
                          docket.totalLabourApproved !== docket.totalLabourSubmitted ? (
                            <span>
                              <span className="font-medium">{docket.totalLabourApproved}h</span>
                              <span className="text-muted-foreground line-through ml-1 text-xs">
                                {docket.labourHours}h
                              </span>
                            </span>
                          ) : (
                            <>{docket.labourHours}h</>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {docket.status === 'approved' &&
                          docket.totalPlantApproved !== docket.totalPlantSubmitted ? (
                            <span>
                              <span className="font-medium">{docket.totalPlantApproved}h</span>
                              <span className="text-muted-foreground line-through ml-1 text-xs">
                                {docket.plantHours}h
                              </span>
                            </span>
                          ) : (
                            <>{docket.plantHours}h</>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${statusColors[docket.status] || 'bg-muted'}`}
                          >
                            {statusLabels[docket.status] || docket.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-2">
                            {/* Print button - always visible */}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => void handlePrintDocket(docket)}
                              disabled={printingDocketId === docket.id}
                              title="Print docket"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            {/* Submit button for draft dockets (subcontractor only) */}
                            {docket.status === 'draft' && isSubcontractor && (
                              <Button size="sm" onClick={() => handleSubmitDocket(docket)}>
                                Submit
                              </Button>
                            )}
                            {/* Approve/Reject buttons for pending dockets (approvers only) */}
                            {docket.status === 'pending_approval' && canApprove && (
                              <>
                                <Button
                                  variant="success"
                                  size="sm"
                                  onClick={() => openActionModal(docket, 'approve')}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-red-600 border-red-600 hover:bg-red-50"
                                  onClick={() => openActionModal(docket, 'reject')}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="bg-background rounded-lg shadow-xl w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-docket-title"
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="create-docket-title" className="text-xl font-semibold">
                Create Docket
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCreateModalOpen(false)}
                aria-label="Close create docket"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="new-docket-date" className="block text-sm font-medium mb-1">
                  Date *
                </label>
                <input
                  id="new-docket-date"
                  type="date"
                  value={newDocketDate}
                  onChange={(e) => setNewDocketDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="new-docket-labour-hours" className="block text-sm font-medium mb-1">
                  Labour Hours
                </label>
                <input
                  id="new-docket-labour-hours"
                  type="number"
                  value={newDocketLabourHours}
                  onChange={(e) => setNewDocketLabourHours(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    labourHoursValidation.warning ? 'border-amber-500' : ''
                  }`}
                  placeholder="0"
                  min="0"
                  step="0.5"
                />
                {labourHoursValidation.warning && (
                  <p className="mt-1 text-sm text-amber-600 flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    {labourHoursValidation.warning}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="new-docket-plant-hours" className="block text-sm font-medium mb-1">
                  Plant Hours
                </label>
                <input
                  id="new-docket-plant-hours"
                  type="number"
                  value={newDocketPlantHours}
                  onChange={(e) => setNewDocketPlantHours(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                    plantHoursValidation.warning ? 'border-amber-500' : ''
                  }`}
                  placeholder="0"
                  min="0"
                  step="0.5"
                />
                {plantHoursValidation.warning && (
                  <p className="mt-1 text-sm text-amber-600 flex items-center gap-1">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    {plantHoursValidation.warning}
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="new-docket-notes" className="block text-sm font-medium">
                    Notes
                  </label>
                  {/* Feature #289: Voice-to-text for docket notes */}
                  <VoiceInputButton
                    onTranscript={(text) =>
                      setNewDocketNotes((prev) => (prev ? prev + ' ' + text : text))
                    }
                    appendMode={true}
                  />
                </div>
                <textarea
                  id="new-docket-notes"
                  value={newDocketNotes}
                  onChange={(e) => setNewDocketNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Enter any notes about this docket..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDocket} disabled={creating || !newDocketDate}>
                {creating ? 'Creating...' : 'Create Docket'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Approve/Reject/View Modal */}
      {actionModalOpen && selectedDocket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="docket-action-title"
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="docket-action-title" className="text-xl font-semibold">
                {actionType === 'approve'
                  ? 'Approve Docket'
                  : actionType === 'reject'
                    ? 'Reject Docket'
                    : 'Docket Details'}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActionModalOpen(false)}
                aria-label="Close docket modal"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                <p className="text-sm">
                  <strong>Docket:</strong> {selectedDocket.docketNumber}
                </p>
                <p className="text-sm">
                  <strong>Subcontractor:</strong> {selectedDocket.subcontractor}
                </p>
                <p className="text-sm">
                  <strong>Date:</strong> {selectedDocket.date}
                </p>
                <p className="text-sm">
                  <strong>Status:</strong>{' '}
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      statusColors[selectedDocket.status] || 'bg-muted text-foreground',
                    )}
                  >
                    {statusLabels[selectedDocket.status] || selectedDocket.status}
                  </span>
                </p>
                <p className="text-sm">
                  <strong>Labour Hours:</strong> {selectedDocket.labourHours}h
                  {selectedDocket.totalLabourApproved > 0 &&
                    selectedDocket.totalLabourApproved !== selectedDocket.labourHours && (
                      <span className="text-muted-foreground">
                        {' '}
                        (approved: {selectedDocket.totalLabourApproved}h)
                      </span>
                    )}
                </p>
                <p className="text-sm">
                  <strong>Plant Hours:</strong> {selectedDocket.plantHours}h
                  {selectedDocket.totalPlantApproved > 0 &&
                    selectedDocket.totalPlantApproved !== selectedDocket.plantHours && (
                      <span className="text-muted-foreground">
                        {' '}
                        (approved: {selectedDocket.totalPlantApproved}h)
                      </span>
                    )}
                </p>
                {selectedDocket.notes && (
                  <p className="text-sm">
                    <strong>Notes:</strong> {selectedDocket.notes}
                  </p>
                )}
                {selectedDocket.foremanNotes && (
                  <p className="text-sm">
                    <strong>Foreman Notes:</strong> {selectedDocket.foremanNotes}
                  </p>
                )}
                {selectedDocket.submittedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Submitted: {new Date(selectedDocket.submittedAt).toLocaleString('en-AU')}
                  </p>
                )}
                {selectedDocket.approvedAt && (
                  <p className="text-xs text-muted-foreground">
                    Approved: {new Date(selectedDocket.approvedAt).toLocaleString('en-AU')}
                  </p>
                )}
              </div>

              {/* Labour & Plant entry details */}
              {detailLoading ? (
                <p className="text-sm text-muted-foreground text-center py-3">Loading entries...</p>
              ) : (
                <>
                  {labourEntries.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Labour Entries</h3>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Name</th>
                              <th className="text-left px-3 py-2 font-medium">Role</th>
                              <th className="text-right px-3 py-2 font-medium">Hours</th>
                              <th className="text-right px-3 py-2 font-medium">Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {labourEntries.map((entry) => (
                              <tr key={entry.id}>
                                <td className="px-3 py-2">{entry.employee.name}</td>
                                <td className="px-3 py-2 text-muted-foreground">
                                  {entry.employee.role}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {entry.approvedHours > 0 &&
                                  entry.approvedHours !== entry.submittedHours ? (
                                    <span>
                                      <span className="font-medium">{entry.approvedHours}h</span>
                                      <span className="text-muted-foreground line-through ml-1 text-xs">
                                        {entry.submittedHours}h
                                      </span>
                                    </span>
                                  ) : (
                                    <>{entry.submittedHours}h</>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {entry.approvedCost > 0 &&
                                  entry.approvedCost !== entry.submittedCost ? (
                                    <span>
                                      <span className="font-medium">
                                        ${entry.approvedCost.toFixed(2)}
                                      </span>
                                      <span className="text-muted-foreground line-through ml-1 text-xs">
                                        ${entry.submittedCost.toFixed(2)}
                                      </span>
                                    </span>
                                  ) : (
                                    <>${entry.submittedCost.toFixed(2)}</>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {plantEntries.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold mb-2">Plant Entries</h3>
                      <div className="rounded-lg border overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="text-left px-3 py-2 font-medium">Plant</th>
                              <th className="text-left px-3 py-2 font-medium">Type</th>
                              <th className="text-right px-3 py-2 font-medium">Hours</th>
                              <th className="text-right px-3 py-2 font-medium">Cost</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {plantEntries.map((entry) => (
                              <tr key={entry.id}>
                                <td className="px-3 py-2">
                                  {entry.plant.description}
                                  {entry.plant.idRego ? ` (${entry.plant.idRego})` : ''}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground capitalize">
                                  {entry.wetOrDry}
                                </td>
                                <td className="px-3 py-2 text-right">{entry.hoursOperated}h</td>
                                <td className="px-3 py-2 text-right">
                                  {entry.approvedCost > 0 &&
                                  entry.approvedCost !== entry.submittedCost ? (
                                    <span>
                                      <span className="font-medium">
                                        ${entry.approvedCost.toFixed(2)}
                                      </span>
                                      <span className="text-muted-foreground line-through ml-1 text-xs">
                                        ${entry.submittedCost.toFixed(2)}
                                      </span>
                                    </span>
                                  ) : (
                                    <>${entry.submittedCost.toFixed(2)}</>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {labourEntries.length === 0 && plantEntries.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      No entries found
                    </p>
                  )}
                </>
              )}

              {/* View mode: show approve/reject buttons if docket is pending */}
              {actionType === 'view' &&
                selectedDocket.status === 'pending_approval' &&
                canApprove && (
                  <div className="flex gap-2">
                    <Button
                      variant="success"
                      className="flex-1"
                      onClick={() => setActionType('approve')}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => setActionType('reject')}
                    >
                      Reject
                    </Button>
                  </div>
                )}

              {actionType === 'approve' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="adjusted-labour-hours"
                        className="block text-sm font-medium mb-1"
                      >
                        Adjusted Labour Hours
                      </label>
                      <input
                        id="adjusted-labour-hours"
                        type="number"
                        value={adjustedLabourHours}
                        onChange={(e) => setAdjustedLabourHours(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                          adjustedLabourValidation.warning ? 'border-amber-500' : ''
                        }`}
                        min="0"
                        step="0.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted: {selectedDocket?.labourHours || 0}h
                      </p>
                      {adjustedLabourValidation.warning && (
                        <p className="mt-1 text-sm text-amber-600 flex items-center gap-1">
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
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          {adjustedLabourValidation.warning}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="adjusted-plant-hours"
                        className="block text-sm font-medium mb-1"
                      >
                        Adjusted Plant Hours
                      </label>
                      <input
                        id="adjusted-plant-hours"
                        type="number"
                        value={adjustedPlantHours}
                        onChange={(e) => setAdjustedPlantHours(e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                          adjustedPlantValidation.warning ? 'border-amber-500' : ''
                        }`}
                        min="0"
                        step="0.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted: {selectedDocket?.plantHours || 0}h
                      </p>
                      {adjustedPlantValidation.warning && (
                        <p className="mt-1 text-sm text-amber-600 flex items-center gap-1">
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
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          {adjustedPlantValidation.warning}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="adjustment-reason" className="block text-sm font-medium mb-1">
                      Adjustment Reason{' '}
                      {(hasHoursChanged(adjustedLabourHours, selectedDocket?.labourHours || 0) ||
                        hasHoursChanged(adjustedPlantHours, selectedDocket?.plantHours || 0)) &&
                        '*'}
                    </label>
                    <input
                      id="adjustment-reason"
                      type="text"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Reason for adjustment (if hours changed)"
                    />
                  </div>
                </>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="docket-action-notes" className="block text-sm font-medium">
                    {actionType === 'approve' ? 'Approval Notes' : 'Rejection Reason'}
                    {actionType === 'reject' && ' *'}
                  </label>
                  {/* Feature #289: Voice-to-text for approval/rejection notes */}
                  <VoiceInputButton
                    onTranscript={(text) =>
                      setActionNotes((prev) => (prev ? prev + ' ' + text : text))
                    }
                    appendMode={true}
                  />
                </div>
                <textarea
                  id="docket-action-notes"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder={
                    actionType === 'approve'
                      ? 'Add any notes (optional)...'
                      : 'Please provide a reason for rejection...'
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setActionModalOpen(false)}>
                {actionType === 'view' ? 'Close' : 'Cancel'}
              </Button>
              {actionType !== 'view' && (
                <Button
                  variant={actionType === 'approve' ? 'success' : 'destructive'}
                  onClick={handleAction}
                  disabled={actionInProgress || (actionType === 'reject' && !actionNotes.trim())}
                >
                  {actionInProgress
                    ? actionType === 'approve'
                      ? 'Approving...'
                      : 'Rejecting...'
                    : actionType === 'approve'
                      ? 'Approve'
                      : 'Reject'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
