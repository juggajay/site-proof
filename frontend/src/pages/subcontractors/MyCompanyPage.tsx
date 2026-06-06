import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Plus, Users, Truck, Trash2 } from 'lucide-react';
import { logError } from '@/lib/logger';
import { parseRateInput } from './rateValidation';
import { useMyCompanyQuery } from './myCompanyData';
import { queryKeys } from '@/lib/queryKeys';
import { useSearchParams } from 'react-router-dom';
import { AddEmployeeModal, AddPlantModal } from './MyCompanyFormModals';
import { StatusBadge } from './myCompanyDisplay';
import { formatCompanyRate } from './myCompanyDisplayHelpers';

export function MyCompanyPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedProjectId = searchParams.get('projectId');
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    name: '',
    phone: '',
    role: '',
    hourlyRate: '',
  });
  const [plantForm, setPlantForm] = useState({
    type: '',
    description: '',
    idRego: '',
    dryRate: '',
    wetRate: '',
  });
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Only subcontractor_admin can manage roster - regular subcontractor users can only view
  // Note: user.role is used (from auth context) not roleInCompany
  const canManageRoster = user?.role === 'subcontractor_admin';

  const companyQuery = useMyCompanyQuery(user?.id, requestedProjectId);
  const companyData = companyQuery.data ?? null;
  const loading = companyQuery.isLoading;
  const loadError =
    companyQuery.error && !companyQuery.data
      ? 'Unable to load your subcontractor company. Please try again.'
      : null;

  // Mutations refresh the company read by invalidating its cache entry, keeping
  // the roster/plant in sync without the page re-entering its full-screen loader.
  const refetchCompanyData = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.myCompany(user?.id, requestedProjectId),
    });
  }, [queryClient, user?.id, requestedProjectId]);

  const addEmployee = async () => {
    const name = employeeForm.name.trim();
    const phone = employeeForm.phone.trim();
    const role = employeeForm.role.trim();
    const hourlyRate = parseRateInput(employeeForm.hourlyRate);

    if (!name || !role || hourlyRate === null) {
      setActionError(
        'Enter an employee name, role, and hourly rate greater than 0 with up to 2 decimal places.',
      );
      return;
    }

    setSaving(true);
    setActionError(null);

    try {
      const projectId = companyData?.projectId;
      await apiFetch(`/api/subcontractors/my-company/employees`, {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          name,
          phone,
          role,
          hourlyRate,
        }),
      });

      await refetchCompanyData();
      setShowAddEmployeeModal(false);
      setEmployeeForm({ name: '', phone: '', role: '', hourlyRate: '' });
    } catch (error) {
      logError('Error adding employee:', error);
      setActionError('Employee could not be added. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const addPlant = async () => {
    const type = plantForm.type.trim();
    const description = plantForm.description.trim();
    const idRego = plantForm.idRego.trim();
    const dryRate = parseRateInput(plantForm.dryRate);
    const wetRate = parseRateInput(plantForm.wetRate, { required: false, allowZero: true });

    if (!type || !description || dryRate === null || wetRate === null) {
      setActionError(
        'Enter plant type, description, a dry rate greater than 0, and an optional wet rate with up to 2 decimal places.',
      );
      return;
    }

    setSaving(true);
    setActionError(null);

    try {
      const projectId = companyData?.projectId;
      await apiFetch(`/api/subcontractors/my-company/plant`, {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          type,
          description,
          idRego,
          dryRate,
          wetRate,
        }),
      });

      await refetchCompanyData();
      setShowAddPlantModal(false);
      setPlantForm({ type: '', description: '', idRego: '', dryRate: '', wetRate: '' });
    } catch (error) {
      logError('Error adding plant:', error);
      setActionError('Plant could not be added. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEmployee = async (empId: string) => {
    setSaving(true);
    setActionError(null);

    try {
      const query = companyData?.projectId
        ? `?projectId=${encodeURIComponent(companyData.projectId)}`
        : '';
      await apiFetch(
        `/api/subcontractors/my-company/employees/${encodeURIComponent(empId)}${query}`,
        {
          method: 'DELETE',
        },
      );
      await refetchCompanyData();
    } catch (error) {
      logError('Error deleting employee:', error);
      setActionError('Employee could not be deleted. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deletePlant = async (plantId: string) => {
    setSaving(true);
    setActionError(null);

    try {
      const query = companyData?.projectId
        ? `?projectId=${encodeURIComponent(companyData.projectId)}`
        : '';
      await apiFetch(
        `/api/subcontractors/my-company/plant/${encodeURIComponent(plantId)}${query}`,
        {
          method: 'DELETE',
        },
      );
      await refetchCompanyData();
    } catch (error) {
      logError('Error deleting plant:', error);
      setActionError('Plant could not be deleted. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!companyData && loadError) {
    return (
      <div className="p-6">
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="font-semibold text-red-800">Unable to Load Company</h3>
          <p className="text-sm text-red-700 mt-1">{loadError}</p>
          <button
            type="button"
            onClick={() => void companyQuery.refetch()}
            className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!companyData) {
    return (
      <div className="p-6">
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4">
          <h3 className="font-semibold text-red-800">No Company Found</h3>
          <p className="text-sm text-red-700 mt-1">
            You are not associated with a subcontractor company. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  const pendingEmployees = companyData.employees.filter((e) => e.status === 'pending').length;
  const pendingPlant = companyData.plant.filter((p) => p.status === 'pending').length;
  const availableProjects = companyData.availableProjects || [];
  const showProjectSwitcher = availableProjects.length > 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Company</h1>
        <p className="text-muted-foreground mt-1">
          {canManageRoster
            ? "Manage your company's employee roster and plant register"
            : "View your company's employee roster and plant register"}
        </p>
      </div>

      {showProjectSwitcher && (
        <div className="rounded-lg border bg-card p-4">
          <label htmlFor="my-company-project" className="block text-sm font-medium mb-2">
            Project
          </label>
          <select
            id="my-company-project"
            value={companyData.projectId}
            onChange={(event) => {
              const nextParams = new URLSearchParams(searchParams);
              nextParams.set('projectId', event.target.value);
              setSearchParams(nextParams);
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {availableProjects.map((project) => (
              <option key={project.projectId} value={project.projectId}>
                {project.projectName || project.companyName}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-muted-foreground">
            Roster and plant rates are approved per head-contractor project.
          </p>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      {/* Company Info Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold">{companyData.companyName}</h2>
            {companyData.projectName && (
              <p className="text-sm text-muted-foreground mt-1">
                Project: {companyData.projectName}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-1">ABN: {companyData.abn}</p>
          </div>
          <StatusBadge status={companyData.status} />
        </div>
        <div className="grid gap-4 md:grid-cols-3 mt-4 pt-4 border-t">
          <div>
            <p className="text-sm text-muted-foreground">Primary Contact</p>
            <p className="font-medium">{companyData.primaryContactName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{companyData.primaryContactEmail}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Phone</p>
            <p className="font-medium">{companyData.primaryContactPhone}</p>
          </div>
        </div>
      </div>

      {/* Pending Approvals Alert */}
      {(pendingEmployees > 0 || pendingPlant > 0) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-800">Pending Approvals</h3>
          <p className="text-sm text-amber-700 mt-1">
            {pendingEmployees > 0 && `${pendingEmployees} employee rate(s) pending approval`}
            {pendingEmployees > 0 && pendingPlant > 0 && ' • '}
            {pendingPlant > 0 && `${pendingPlant} plant rate(s) pending approval`}
          </p>
          <p className="text-xs text-amber-600 mt-2">
            Pending items need to be approved by the head contractor before they can be used in
            dockets.
          </p>
        </div>
      )}

      {/* Employee Roster */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Employee Roster</h3>
            <span className="text-sm text-muted-foreground">({companyData.employees.length})</span>
          </div>
          {canManageRoster && (
            <button
              onClick={() => setShowAddEmployeeModal(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Employee
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Name</th>
                <th className="text-left p-3 text-sm font-medium">Phone</th>
                <th className="text-left p-3 text-sm font-medium">Role</th>
                <th className="text-right p-3 text-sm font-medium">Hourly Rate</th>
                <th className="text-center p-3 text-sm font-medium">Status</th>
                {canManageRoster && <th className="text-right p-3 text-sm font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {companyData.employees.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageRoster ? 6 : 5}
                    className="p-6 text-center text-muted-foreground"
                  >
                    {canManageRoster
                      ? 'No employees added yet. Click "Add Employee" to get started.'
                      : 'No employees registered yet.'}
                  </td>
                </tr>
              ) : (
                companyData.employees.map((emp) => (
                  <tr key={emp.id} className="border-t">
                    <td className="p-3 font-medium">{emp.name}</td>
                    <td className="p-3">{emp.phone || '-'}</td>
                    <td className="p-3">{emp.role}</td>
                    <td className="p-3 text-right font-semibold">
                      {formatCompanyRate(emp.hourlyRate)}/hr
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={emp.status} />
                    </td>
                    {canManageRoster && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => void deleteEmployee(emp.id)}
                            disabled={saving}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Plant Register */}
      <div className="rounded-lg border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Plant Register</h3>
            <span className="text-sm text-muted-foreground">({companyData.plant.length})</span>
          </div>
          {canManageRoster && (
            <button
              onClick={() => setShowAddPlantModal(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Add Plant
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 text-sm font-medium">Type</th>
                <th className="text-left p-3 text-sm font-medium">Description</th>
                <th className="text-left p-3 text-sm font-medium">ID/Rego</th>
                <th className="text-right p-3 text-sm font-medium">Dry Rate</th>
                <th className="text-right p-3 text-sm font-medium">Wet Rate</th>
                <th className="text-center p-3 text-sm font-medium">Status</th>
                {canManageRoster && <th className="text-right p-3 text-sm font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {companyData.plant.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManageRoster ? 7 : 6}
                    className="p-6 text-center text-muted-foreground"
                  >
                    {canManageRoster
                      ? 'No plant registered yet. Click "Add Plant" to get started.'
                      : 'No plant registered yet.'}
                  </td>
                </tr>
              ) : (
                companyData.plant.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-medium">{p.type}</td>
                    <td className="p-3">{p.description}</td>
                    <td className="p-3">{p.idRego || '-'}</td>
                    <td className="p-3 text-right font-semibold">
                      {formatCompanyRate(p.dryRate)}/hr
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {p.wetRate > 0 ? `${formatCompanyRate(p.wetRate)}/hr` : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={p.status} />
                    </td>
                    {canManageRoster && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => void deletePlant(p.id)}
                            disabled={saving}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddEmployeeModal && (
        <AddEmployeeModal
          employeeForm={employeeForm}
          setEmployeeForm={setEmployeeForm}
          saving={saving}
          onClose={() => setShowAddEmployeeModal(false)}
          onAddEmployee={addEmployee}
        />
      )}

      {/* Add Plant Modal */}
      {showAddPlantModal && (
        <AddPlantModal
          plantForm={plantForm}
          setPlantForm={setPlantForm}
          saving={saving}
          onClose={() => setShowAddPlantModal(false)}
          onAddPlant={addPlant}
        />
      )}
    </div>
  );
}
