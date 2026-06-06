import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import { parseRateInput } from './rateValidation';
import { useMyCompanyQuery } from './myCompanyData';
import { queryKeys } from '@/lib/queryKeys';
import { useSearchParams } from 'react-router-dom';
import { AddEmployeeModal, AddPlantModal } from './MyCompanyFormModals';
import {
  EmployeeRosterSection,
  MyCompanyInfoCard,
  MyCompanyProjectSwitcher,
  PendingApprovalsAlert,
  PlantRegisterSection,
} from './MyCompanySections';

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

      <MyCompanyProjectSwitcher
        companyData={companyData}
        searchParams={searchParams}
        onSearchParamsChange={setSearchParams}
      />

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      <MyCompanyInfoCard companyData={companyData} />

      <PendingApprovalsAlert pendingEmployees={pendingEmployees} pendingPlant={pendingPlant} />

      <EmployeeRosterSection
        employees={companyData.employees}
        canManageRoster={canManageRoster}
        saving={saving}
        onAddEmployee={() => setShowAddEmployeeModal(true)}
        onDeleteEmployee={(employeeId) => void deleteEmployee(employeeId)}
      />

      <PlantRegisterSection
        plant={companyData.plant}
        canManageRoster={canManageRoster}
        saving={saving}
        onAddPlant={() => setShowAddPlantModal(true)}
        onDeletePlant={(plantId) => void deletePlant(plantId)}
      />

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
