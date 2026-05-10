import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { Plus, Users, Truck, CheckCircle, Clock, X, Trash2 } from 'lucide-react';
import { logError } from '@/lib/logger';
import { parseRateInput } from './rateValidation';

interface Employee {
  id: string;
  name: string;
  phone: string;
  role: string;
  hourlyRate: number;
  status: 'pending' | 'approved' | 'inactive';
}

interface Plant {
  id: string;
  type: string;
  description: string;
  idRego: string;
  dryRate: number;
  wetRate: number;
  status: 'pending' | 'approved' | 'inactive';
}

interface CompanyData {
  id: string;
  companyName: string;
  abn: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  status: string;
  employees: Employee[];
  plant: Plant[];
}

export function MyCompanyPage() {
  const { user } = useAuth();
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Only subcontractor_admin can manage roster - regular subcontractor users can only view
  // Note: user.role is used (from auth context) not roleInCompany
  const canManageRoster = user?.role === 'subcontractor_admin';

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const data = await apiFetch<{ company: CompanyData }>(`/api/subcontractors/my-company`);
      setCompanyData(data.company);
    } catch (error) {
      logError('Error fetching company data:', error);
      setCompanyData(null);
      setLoadError('Unable to load your subcontractor company. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
      await apiFetch(`/api/subcontractors/my-company/employees`, {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          role,
          hourlyRate,
        }),
      });

      await fetchCompanyData();
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
      await apiFetch(`/api/subcontractors/my-company/plant`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          description,
          idRego,
          dryRate,
          wetRate,
        }),
      });

      await fetchCompanyData();
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
      await apiFetch(`/api/subcontractors/my-company/employees/${encodeURIComponent(empId)}`, {
        method: 'DELETE',
      });
      await fetchCompanyData();
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
      await apiFetch(`/api/subcontractors/my-company/plant/${encodeURIComponent(plantId)}`, {
        method: 'DELETE',
      });
      await fetchCompanyData();
    } catch (error) {
      logError('Error deleting plant:', error);
      setActionError('Plant could not be deleted. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock className="h-3 w-3" /> Pending Approval
          </span>
        );
      case 'approved':
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3" /> Approved
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
            onClick={fetchCompanyData}
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
            <p className="text-sm text-muted-foreground mt-1">ABN: {companyData.abn}</p>
          </div>
          {getStatusBadge(companyData.status)}
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
                      {formatCurrency(emp.hourlyRate)}/hr
                    </td>
                    <td className="p-3 text-center">{getStatusBadge(emp.status)}</td>
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
                    <td className="p-3 text-right font-semibold">{formatCurrency(p.dryRate)}/hr</td>
                    <td className="p-3 text-right font-semibold">
                      {p.wetRate > 0 ? `${formatCurrency(p.wetRate)}/hr` : '-'}
                    </td>
                    <td className="p-3 text-center">{getStatusBadge(p.status)}</td>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="bg-background rounded-lg shadow-xl w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-company-add-employee-title"
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="my-company-add-employee-title" className="text-xl font-semibold">
                Add Employee
              </h2>
              <button
                type="button"
                onClick={() => setShowAddEmployeeModal(false)}
                className="p-2 hover:bg-muted rounded-lg"
                aria-label="Close add employee"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="my-company-employee-name"
                  className="block text-sm font-medium mb-1"
                >
                  Name *
                </label>
                <input
                  id="my-company-employee-name"
                  type="text"
                  value={employeeForm.name}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label
                  htmlFor="my-company-employee-phone"
                  className="block text-sm font-medium mb-1"
                >
                  Phone
                </label>
                <input
                  id="my-company-employee-phone"
                  type="tel"
                  value={employeeForm.phone}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="0412 345 678"
                />
              </div>
              <div>
                <label
                  htmlFor="my-company-employee-role"
                  className="block text-sm font-medium mb-1"
                >
                  Role *
                </label>
                <select
                  id="my-company-employee-role"
                  value={employeeForm.role}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select role...</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Foreman">Foreman</option>
                  <option value="Operator">Operator</option>
                  <option value="Labourer">Labourer</option>
                  <option value="Leading Hand">Leading Hand</option>
                  <option value="Pipe Layer">Pipe Layer</option>
                  <option value="Traffic Controller">Traffic Controller</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="my-company-employee-hourly-rate"
                  className="block text-sm font-medium mb-1"
                >
                  Proposed Hourly Rate *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                  <input
                    id="my-company-employee-hourly-rate"
                    type="number"
                    value={employeeForm.hourlyRate}
                    onChange={(e) =>
                      setEmployeeForm((prev) => ({ ...prev, hourlyRate: e.target.value }))
                    }
                    className="w-full pl-7 pr-12 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="85"
                    min="0"
                    step="0.01"
                  />
                  <span className="absolute right-3 top-2 text-muted-foreground">/hr</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Rate requires approval from head contractor before use
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                type="button"
                onClick={() => setShowAddEmployeeModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addEmployee}
                disabled={
                  saving ||
                  !employeeForm.name.trim() ||
                  !employeeForm.role.trim() ||
                  !employeeForm.hourlyRate
                }
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plant Modal */}
      {showAddPlantModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="bg-background rounded-lg shadow-xl w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-company-add-plant-title"
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 id="my-company-add-plant-title" className="text-xl font-semibold">
                Add Plant
              </h2>
              <button
                type="button"
                onClick={() => setShowAddPlantModal(false)}
                className="p-2 hover:bg-muted rounded-lg"
                aria-label="Close add plant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="my-company-plant-type" className="block text-sm font-medium mb-1">
                  Type *
                </label>
                <select
                  id="my-company-plant-type"
                  value={plantForm.type}
                  onChange={(e) => setPlantForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select type...</option>
                  <option value="Excavator">Excavator</option>
                  <option value="Loader">Loader</option>
                  <option value="Roller">Roller</option>
                  <option value="Grader">Grader</option>
                  <option value="Dump Truck">Dump Truck</option>
                  <option value="Water Cart">Water Cart</option>
                  <option value="Paver">Paver</option>
                  <option value="Bobcat">Bobcat</option>
                  <option value="Compactor">Compactor</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="my-company-plant-description"
                  className="block text-sm font-medium mb-1"
                >
                  Description *
                </label>
                <input
                  id="my-company-plant-description"
                  type="text"
                  value={plantForm.description}
                  onChange={(e) =>
                    setPlantForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="20T Excavator"
                />
              </div>
              <div>
                <label
                  htmlFor="my-company-plant-id-rego"
                  className="block text-sm font-medium mb-1"
                >
                  ID/Rego
                </label>
                <input
                  id="my-company-plant-id-rego"
                  type="text"
                  value={plantForm.idRego}
                  onChange={(e) => setPlantForm((prev) => ({ ...prev, idRego: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="EXC-001"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="my-company-plant-dry-rate"
                    className="block text-sm font-medium mb-1"
                  >
                    Dry Rate *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                    <input
                      id="my-company-plant-dry-rate"
                      type="number"
                      value={plantForm.dryRate}
                      onChange={(e) =>
                        setPlantForm((prev) => ({ ...prev, dryRate: e.target.value }))
                      }
                      className="w-full pl-7 pr-12 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="150"
                      min="0"
                      step="0.01"
                    />
                    <span className="absolute right-3 top-2 text-muted-foreground">/hr</span>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="my-company-plant-wet-rate"
                    className="block text-sm font-medium mb-1"
                  >
                    Wet Rate
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground">$</span>
                    <input
                      id="my-company-plant-wet-rate"
                      type="number"
                      value={plantForm.wetRate}
                      onChange={(e) =>
                        setPlantForm((prev) => ({ ...prev, wetRate: e.target.value }))
                      }
                      className="w-full pl-7 pr-12 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="200"
                      min="0"
                      step="0.01"
                    />
                    <span className="absolute right-3 top-2 text-muted-foreground">/hr</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Rates require approval from head contractor before use
              </p>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t">
              <button
                type="button"
                onClick={() => setShowAddPlantModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addPlant}
                disabled={
                  saving ||
                  !plantForm.type.trim() ||
                  !plantForm.description.trim() ||
                  !plantForm.dryRate
                }
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add Plant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
