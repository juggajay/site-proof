import { useParams } from 'react-router-dom';
import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { apiFetch } from '@/lib/api';
import { Plus, Users, Building2, CheckCircle, Clock, X, DollarSign } from 'lucide-react';
import type { Subcontractor, Employee, Plant, PortalAccess } from './types';
import { formatCurrency } from './types';
import { SubcontractorList } from './components/SubcontractorList';
import { InviteSubcontractorModal } from './components/InviteSubcontractorModal';
import { AddEmployeeModal } from './components/AddEmployeeModal';
import { AddPlantModal } from './components/AddPlantModal';
import { PortalAccessPanel } from './components/PortalAccessPanel';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage } from '@/lib/errorHandling';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { logError } from '@/lib/logger';

type PendingConfirmation =
  | { type: 'suspend-subcontractor'; id: string }
  | { type: 'remove-subcontractor'; id: string }
  | { type: 'delete-subcontractor'; subcontractor: Subcontractor }
  | { type: 'deactivate-employee'; subcontractorId: string; employeeId: string }
  | { type: 'deactivate-plant'; subcontractorId: string; plantId: string };

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending_approval':
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
          <Clock className="h-3 w-3" /> Pending
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3" /> Approved
        </span>
      );
    case 'suspended':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <Clock className="h-3 w-3" /> Suspended
        </span>
      );
    case 'removed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <X className="h-3 w-3" /> Removed
        </span>
      );
    case 'inactive':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          <X className="h-3 w-3" /> Inactive
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          {status}
        </span>
      );
  }
};

export function SubcontractorsPage() {
  const { projectId } = useParams();
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState<string | null>(null);
  const [showAddPlantModal, setShowAddPlantModal] = useState<string | null>(null);
  const [selectedSubForPanel, setSelectedSubForPanel] = useState<Subcontractor | null>(null);
  const [showRemoved, setShowRemoved] = useState(false);
  const [removedCount, setRemovedCount] = useState(0);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const statusUpdatesRef = useRef(new Set<string>());
  const deleteSubcontractorsRef = useRef(new Set<string>());
  const employeeUpdatesRef = useRef(new Set<string>());
  const plantUpdatesRef = useRef(new Set<string>());

  // --- Data Fetching ---
  const fetchSubcontractors = useCallback(async () => {
    if (!projectId) {
      setSubcontractors([]);
      setRemovedCount(0);
      setLoading(false);
      setLoadError('Project not found');
      return;
    }
    setLoading(true);
    setLoadError(null);
    const queryParams = new URLSearchParams();
    if (showRemoved) queryParams.set('includeRemoved', 'true');
    const queryString = queryParams.toString();
    try {
      const data = await apiFetch<{ subcontractors: Subcontractor[] }>(
        `/api/subcontractors/project/${encodeURIComponent(projectId)}${queryString ? `?${queryString}` : ''}`,
      );
      const allSubs = data.subcontractors || [];
      setSubcontractors(allSubs);
      if (showRemoved) setRemovedCount(allSubs.filter((s) => s.status === 'removed').length);
    } catch (error) {
      logError('Error fetching subcontractors:', error);
      setSubcontractors([]);
      setRemovedCount(0);
      setLoadError(extractErrorMessage(error, 'Could not load subcontractors. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, showRemoved]);

  useEffect(() => {
    fetchSubcontractors();
  }, [fetchSubcontractors]);

  // --- Subcontractor Status Handlers ---
  const updateSubcontractorStatus = useCallback(
    async (subId: string, status: string) => {
      const updateKey = `${subId}:${status}`;
      if (statusUpdatesRef.current.has(updateKey)) return;

      statusUpdatesRef.current.add(updateKey);
      try {
        await apiFetch(`/api/subcontractors/${encodeURIComponent(subId)}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        if (status === 'removed' && !showRemoved) {
          setSubcontractors((subs) => subs.filter((sub) => sub.id !== subId));
          setExpandedId(null);
        } else {
          setSubcontractors((subs) =>
            subs.map((sub) =>
              sub.id === subId ? { ...sub, status: status as Subcontractor['status'] } : sub,
            ),
          );
        }
        toast({
          title: 'Subcontractor updated',
          description: `Status changed to ${status.replace(/_/g, ' ')}.`,
          variant: 'success',
        });
      } catch (error) {
        logError('Error updating subcontractor status:', error);
        toast({
          title: 'Failed to update subcontractor',
          description: extractErrorMessage(error, 'Please try again.'),
          variant: 'error',
        });
      } finally {
        statusUpdatesRef.current.delete(updateKey);
      }
    },
    [showRemoved],
  );

  const handleApproveSubcontractor = useCallback(
    (id: string) => updateSubcontractorStatus(id, 'approved'),
    [updateSubcontractorStatus],
  );
  const handleSuspendSubcontractor = useCallback((id: string) => {
    setPendingConfirmation({ type: 'suspend-subcontractor', id });
  }, []);
  const handleRemoveSubcontractor = useCallback((id: string) => {
    setPendingConfirmation({ type: 'remove-subcontractor', id });
  }, []);
  const handleReinstateSubcontractor = useCallback(
    (id: string) => updateSubcontractorStatus(id, 'approved'),
    [updateSubcontractorStatus],
  );

  const handleDeleteSubcontractor = useCallback(async (sub: Subcontractor) => {
    if (deleteSubcontractorsRef.current.has(sub.id)) return;

    deleteSubcontractorsRef.current.add(sub.id);
    try {
      await apiFetch(`/api/subcontractors/${encodeURIComponent(sub.id)}`, { method: 'DELETE' });
      setSubcontractors((subs) => subs.filter((s) => s.id !== sub.id));
      setExpandedId(null);
      toast({
        title: 'Subcontractor deleted',
        description: `${sub.companyName} was permanently deleted.`,
        variant: 'success',
      });
    } catch (error) {
      logError('Error deleting subcontractor:', error);
      toast({
        title: 'Failed to delete subcontractor',
        description: extractErrorMessage(error, 'Please try again.'),
        variant: 'error',
      });
    } finally {
      deleteSubcontractorsRef.current.delete(sub.id);
    }
  }, []);

  // --- Employee / Plant Status Handlers ---
  const updateEmployeeStatus = useCallback(
    async (subId: string, empId: string, status: Employee['status']) => {
      const updateKey = `${subId}:${empId}:${status}`;
      if (employeeUpdatesRef.current.has(updateKey)) return;

      employeeUpdatesRef.current.add(updateKey);
      try {
        await apiFetch(
          `/api/subcontractors/${encodeURIComponent(subId)}/employees/${encodeURIComponent(empId)}/status`,
          { method: 'PATCH', body: JSON.stringify({ status }) },
        );
        setSubcontractors((subs) =>
          subs.map((sub) =>
            sub.id === subId
              ? {
                  ...sub,
                  employees: sub.employees.map((emp) =>
                    emp.id === empId ? { ...emp, status } : emp,
                  ),
                }
              : sub,
          ),
        );
      } catch (error) {
        logError('Error updating employee status:', error);
        toast({
          title: 'Failed to update employee',
          description: extractErrorMessage(error, 'Please try again.'),
          variant: 'error',
        });
      } finally {
        employeeUpdatesRef.current.delete(updateKey);
      }
    },
    [],
  );
  const handleApproveEmployee = useCallback(
    (subId: string, empId: string) => updateEmployeeStatus(subId, empId, 'approved'),
    [updateEmployeeStatus],
  );
  const handleDeactivateEmployee = useCallback((subId: string, empId: string) => {
    setPendingConfirmation({
      type: 'deactivate-employee',
      subcontractorId: subId,
      employeeId: empId,
    });
  }, []);

  const updatePlantStatus = useCallback(
    async (subId: string, plantId: string, status: Plant['status']) => {
      const updateKey = `${subId}:${plantId}:${status}`;
      if (plantUpdatesRef.current.has(updateKey)) return;

      plantUpdatesRef.current.add(updateKey);
      try {
        await apiFetch(
          `/api/subcontractors/${encodeURIComponent(subId)}/plant/${encodeURIComponent(plantId)}/status`,
          { method: 'PATCH', body: JSON.stringify({ status }) },
        );
        setSubcontractors((subs) =>
          subs.map((sub) =>
            sub.id === subId
              ? { ...sub, plant: sub.plant.map((p) => (p.id === plantId ? { ...p, status } : p)) }
              : sub,
          ),
        );
      } catch (error) {
        logError('Error updating plant status:', error);
        toast({
          title: 'Failed to update plant',
          description: extractErrorMessage(error, 'Please try again.'),
          variant: 'error',
        });
      } finally {
        plantUpdatesRef.current.delete(updateKey);
      }
    },
    [],
  );
  const handleApprovePlant = useCallback(
    (subId: string, plantId: string) => updatePlantStatus(subId, plantId, 'approved'),
    [updatePlantStatus],
  );
  const handleDeactivatePlant = useCallback((subId: string, plantId: string) => {
    setPendingConfirmation({ type: 'deactivate-plant', subcontractorId: subId, plantId });
  }, []);

  const getConfirmationTitle = () => {
    switch (pendingConfirmation?.type) {
      case 'suspend-subcontractor':
        return 'Suspend Subcontractor';
      case 'remove-subcontractor':
        return 'Remove Subcontractor';
      case 'delete-subcontractor':
        return 'Permanently Delete Subcontractor';
      case 'deactivate-employee':
        return 'Deactivate Employee';
      case 'deactivate-plant':
        return 'Deactivate Plant';
      default:
        return 'Confirm Action';
    }
  };

  const getConfirmationDescription = () => {
    if (pendingConfirmation?.type === 'delete-subcontractor') {
      const sub = pendingConfirmation.subcontractor;
      return (
        <>
          <p>This will permanently delete {sub.companyName} and all associated records.</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>{sub.totalApprovedDockets} approved docket(s)</li>
            <li>{sub.employees.length} employee(s)</li>
            <li>{sub.plant.length} plant item(s)</li>
          </ul>
          <p>This action cannot be undone.</p>
        </>
      );
    }

    switch (pendingConfirmation?.type) {
      case 'suspend-subcontractor':
        return 'This subcontractor will lose access to the project, but historical data will be preserved.';
      case 'remove-subcontractor':
        return 'This revokes project access while preserving historical dockets and work records.';
      case 'deactivate-employee':
        return 'This employee will no longer be available for dockets.';
      case 'deactivate-plant':
        return 'This plant item will no longer be available for dockets.';
      default:
        return '';
    }
  };

  const confirmPendingAction = () => {
    const action = pendingConfirmation;
    setPendingConfirmation(null);

    switch (action?.type) {
      case 'suspend-subcontractor':
        void updateSubcontractorStatus(action.id, 'suspended');
        break;
      case 'remove-subcontractor':
        void updateSubcontractorStatus(action.id, 'removed');
        break;
      case 'delete-subcontractor':
        void handleDeleteSubcontractor(action.subcontractor);
        break;
      case 'deactivate-employee':
        void updateEmployeeStatus(action.subcontractorId, action.employeeId, 'inactive');
        break;
      case 'deactivate-plant':
        void updatePlantStatus(action.subcontractorId, action.plantId, 'inactive');
        break;
    }
  };

  // --- Modal Callbacks ---
  const handleToggleExpand = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    [],
  );
  const handleInvited = useCallback((sub: Subcontractor) => {
    setSubcontractors((prev) => [...prev, sub]);
    toast({
      title: 'Invitation sent',
      description: `${sub.companyName} was added to this project.`,
      variant: 'success',
    });
  }, []);
  const handleEmployeeAdded = useCallback((subId: string, employee: Employee) => {
    setSubcontractors((subs) =>
      subs.map((sub) =>
        sub.id === subId ? { ...sub, employees: [...sub.employees, employee] } : sub,
      ),
    );
  }, []);
  const handlePlantAdded = useCallback((subId: string, plant: Plant) => {
    setSubcontractors((subs) =>
      subs.map((sub) => (sub.id === subId ? { ...sub, plant: [...sub.plant, plant] } : sub)),
    );
  }, []);
  const handlePortalAccessUpdated = useCallback((subId: string, access: PortalAccess) => {
    setSubcontractors((subs) =>
      subs.map((sub) => (sub.id === subId ? { ...sub, portalAccess: access } : sub)),
    );
    setSelectedSubForPanel((prev) =>
      prev?.id === subId ? { ...prev, portalAccess: access } : prev,
    );
  }, []);

  // --- Computed Values ---
  const pendingApprovalCount = useMemo(
    () => subcontractors.filter((s) => s.status === 'pending_approval').length,
    [subcontractors],
  );
  const pendingEmployees = useMemo(
    () =>
      subcontractors.reduce(
        (sum, s) => sum + s.employees.filter((e) => e.status === 'pending').length,
        0,
      ),
    [subcontractors],
  );
  const pendingPlant = useMemo(
    () =>
      subcontractors.reduce(
        (sum, s) => sum + s.plant.filter((p) => p.status === 'pending').length,
        0,
      ),
    [subcontractors],
  );
  const totalEmployees = useMemo(
    () => subcontractors.reduce((sum, s) => sum + s.employees.length, 0),
    [subcontractors],
  );
  const totalCost = useMemo(
    () => subcontractors.reduce((sum, s) => sum + s.totalCost, 0),
    [subcontractors],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subcontractors</h1>
          <p className="text-muted-foreground mt-1">
            Manage subcontractor companies, employees, and rates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <button
              type="button"
              role="switch"
              aria-checked={showRemoved}
              aria-label="Show removed subcontractors"
              onClick={() => setShowRemoved(!showRemoved)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${showRemoved ? 'bg-red-500' : 'bg-muted-foreground/30'}`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${showRemoved ? 'translate-x-[18px]' : 'translate-x-[3px]'}`}
              />
            </button>
            <span className="text-muted-foreground">
              Show removed{removedCount > 0 && showRemoved ? ` (${removedCount})` : ''}
            </span>
          </label>
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Invite Subcontractor
          </button>
        </div>
      </div>

      {loadError && (
        <div
          className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          role="alert"
        >
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => void fetchSubcontractors()}
            className="rounded-md border border-red-200 bg-white px-3 py-1 font-medium text-red-700 hover:bg-red-100"
          >
            Try again
          </button>
        </div>
      )}

      {!loadError && (
        <>
          {/* Pending Approvals Alert */}
          {(pendingApprovalCount > 0 || pendingEmployees > 0 || pendingPlant > 0) && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-800">Pending Approvals</h3>
              <p className="text-sm text-amber-700 mt-1">
                {pendingApprovalCount > 0 && `${pendingApprovalCount} subcontractor(s) \u2022 `}
                {pendingEmployees > 0 && `${pendingEmployees} employee rate(s) \u2022 `}
                {pendingPlant > 0 && `${pendingPlant} plant rate(s)`}
              </p>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="text-sm">Total Subcontractors</span>
              </div>
              <p className="text-2xl font-bold mt-2">{subcontractors.length}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm">Total Employees</span>
              </div>
              <p className="text-2xl font-bold mt-2">{totalEmployees}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm">Total Cost to Date</span>
              </div>
              <p className="text-2xl font-bold mt-2">{formatCurrency(totalCost)}</p>
            </div>
          </div>

          {/* Subcontractor List */}
          <SubcontractorList
            subcontractors={subcontractors}
            expandedId={expandedId}
            onToggleExpand={handleToggleExpand}
            onApproveSubcontractor={handleApproveSubcontractor}
            onSuspendSubcontractor={handleSuspendSubcontractor}
            onRemoveSubcontractor={handleRemoveSubcontractor}
            onReinstateSubcontractor={handleReinstateSubcontractor}
            onDeleteSubcontractor={(subcontractor) =>
              setPendingConfirmation({ type: 'delete-subcontractor', subcontractor })
            }
            onApproveEmployee={handleApproveEmployee}
            onDeactivateEmployee={handleDeactivateEmployee}
            onApprovePlant={handleApprovePlant}
            onDeactivatePlant={handleDeactivatePlant}
            onShowAddEmployee={setShowAddEmployeeModal}
            onShowAddPlant={setShowAddPlantModal}
            onOpenPortalAccess={setSelectedSubForPanel}
            formatCurrency={formatCurrency}
            getStatusBadge={getStatusBadge}
          />
        </>
      )}

      {/* Modals */}
      {showInviteModal && projectId && (
        <InviteSubcontractorModal
          projectId={projectId}
          onClose={() => setShowInviteModal(false)}
          onInvited={handleInvited}
        />
      )}
      {showAddEmployeeModal && (
        <AddEmployeeModal
          subcontractorId={showAddEmployeeModal}
          onClose={() => setShowAddEmployeeModal(null)}
          onAdded={handleEmployeeAdded}
        />
      )}
      {showAddPlantModal && (
        <AddPlantModal
          subcontractorId={showAddPlantModal}
          onClose={() => setShowAddPlantModal(null)}
          onAdded={handlePlantAdded}
        />
      )}
      {selectedSubForPanel && (
        <PortalAccessPanel
          subcontractor={selectedSubForPanel}
          onClose={() => setSelectedSubForPanel(null)}
          onAccessUpdated={handlePortalAccessUpdated}
        />
      )}
      <ConfirmDialog
        open={Boolean(pendingConfirmation)}
        title={getConfirmationTitle()}
        description={getConfirmationDescription()}
        confirmLabel={
          pendingConfirmation?.type === 'delete-subcontractor' ? 'Delete Permanently' : 'Confirm'
        }
        variant="destructive"
        onCancel={() => setPendingConfirmation(null)}
        onConfirm={confirmPendingAction}
      />
    </div>
  );
}
