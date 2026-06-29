import { Plus, Users, Truck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { CompanyData, Employee, Plant } from './myCompanyData';
import { StatusBadge } from './myCompanyDisplay';
import { formatCompanyRate } from './myCompanyDisplayHelpers';
import {
  applyPortalCompanyOptionToParams,
  findPortalCompanyOptionByValue,
  getPortalCompanyOptionLabel,
  getPortalCompanyOptionValue,
} from '@/pages/subcontractor-portal/portalCompanyScope';

export function MyCompanyProjectSwitcher({
  companyData,
  searchParams,
  onSearchParamsChange,
}: {
  companyData: CompanyData;
  searchParams: URLSearchParams;
  onSearchParamsChange: (nextParams: URLSearchParams) => void;
}) {
  const availableProjects = companyData.availableProjects || [];
  if (availableProjects.length <= 1) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <label htmlFor="my-company-project" className="block text-sm font-medium mb-2">
        Project / company
      </label>
      <select
        id="my-company-project"
        value={companyData.id || companyData.projectId}
        onChange={(event) => {
          const option = findPortalCompanyOptionByValue(availableProjects, event.target.value);
          if (option) {
            onSearchParamsChange(applyPortalCompanyOptionToParams(searchParams, option));
          }
        }}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {availableProjects.map((project) => (
          <option
            key={`${project.projectId}:${getPortalCompanyOptionValue(project)}`}
            value={getPortalCompanyOptionValue(project)}
          >
            {getPortalCompanyOptionLabel(project, availableProjects)}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs text-muted-foreground">
        Roster and plant rates are approved per head-contractor project.
      </p>
    </div>
  );
}

export function MyCompanyInfoCard({ companyData }: { companyData: CompanyData }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">{companyData.companyName}</h2>
          {companyData.projectName && (
            <p className="text-sm text-muted-foreground mt-1">Project: {companyData.projectName}</p>
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
  );
}

export function PendingApprovalsAlert({
  pendingEmployees,
  pendingPlant,
}: {
  pendingEmployees: number;
  pendingPlant: number;
}) {
  if (pendingEmployees === 0 && pendingPlant === 0) return null;

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
      <h3 className="font-semibold text-warning">Pending Approvals</h3>
      <p className="text-sm text-warning mt-1">
        {pendingEmployees > 0 && `${pendingEmployees} employee rate(s) pending approval`}
        {pendingEmployees > 0 && pendingPlant > 0 && ' • '}
        {pendingPlant > 0 && `${pendingPlant} plant rate(s) pending approval`}
      </p>
      <p className="text-xs text-warning/80 mt-2">
        Pending items need to be approved by the head contractor before they can be used in dockets.
      </p>
    </div>
  );
}

function ConfirmDeleteButton({
  confirming,
  disabled,
  label,
  onArm,
  onCancel,
  onConfirm,
}: {
  confirming: boolean;
  disabled: boolean;
  label: string;
  onArm: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const actionLabel = confirming ? `Confirm delete ${label}` : `Delete ${label}`;

  return (
    <button
      type="button"
      onClick={() => {
        if (confirming) {
          onConfirm();
          return;
        }
        onArm();
      }}
      onBlur={onCancel}
      disabled={disabled}
      className="p-1 text-destructive hover:text-destructive/80 hover:bg-destructive/10 rounded"
      title={actionLabel}
      aria-label={actionLabel}
    >
      {confirming ? (
        <span className="text-xs font-semibold">Confirm</span>
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}

export function EmployeeRosterSection({
  employees,
  canManageRoster,
  saving,
  onAddEmployee,
  onDeleteEmployee,
}: {
  employees: Employee[];
  canManageRoster: boolean;
  saving: boolean;
  onAddEmployee: () => void;
  onDeleteEmployee: (employeeId: string) => void;
}) {
  const [confirmingEmployeeId, setConfirmingEmployeeId] = useState<string | null>(null);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Employee Roster</h3>
          <span className="text-sm text-muted-foreground">({employees.length})</span>
        </div>
        {canManageRoster && (
          <button
            type="button"
            onClick={onAddEmployee}
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
            {employees.length === 0 ? (
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
              employees.map((employee) => (
                <tr key={employee.id} className="border-t">
                  <td className="p-3 font-medium">{employee.name}</td>
                  <td className="p-3">{employee.phone || '-'}</td>
                  <td className="p-3">{employee.role}</td>
                  <td className="p-3 text-right font-semibold">
                    {formatCompanyRate(employee.hourlyRate)}/hr
                  </td>
                  <td className="p-3 text-center">
                    <StatusBadge status={employee.status} />
                  </td>
                  {canManageRoster && (
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ConfirmDeleteButton
                          confirming={confirmingEmployeeId === employee.id}
                          disabled={saving}
                          label={employee.name}
                          onArm={() => setConfirmingEmployeeId(employee.id)}
                          onCancel={() => setConfirmingEmployeeId(null)}
                          onConfirm={() => {
                            onDeleteEmployee(employee.id);
                            setConfirmingEmployeeId(null);
                          }}
                        />
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
  );
}

export function PlantRegisterSection({
  plant,
  canManageRoster,
  saving,
  onAddPlant,
  onDeletePlant,
}: {
  plant: Plant[];
  canManageRoster: boolean;
  saving: boolean;
  onAddPlant: () => void;
  onDeletePlant: (plantId: string) => void;
}) {
  const [confirmingPlantId, setConfirmingPlantId] = useState<string | null>(null);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Plant Register</h3>
          <span className="text-sm text-muted-foreground">({plant.length})</span>
        </div>
        {canManageRoster && (
          <button
            type="button"
            onClick={onAddPlant}
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
            {plant.length === 0 ? (
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
              plant.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3 font-medium">{item.type}</td>
                  <td className="p-3">{item.description}</td>
                  <td className="p-3">{item.idRego || '-'}</td>
                  <td className="p-3 text-right font-semibold">
                    {formatCompanyRate(item.dryRate)}/hr
                  </td>
                  <td className="p-3 text-right font-semibold">
                    {item.wetRate > 0 ? `${formatCompanyRate(item.wetRate)}/hr` : '-'}
                  </td>
                  <td className="p-3 text-center">
                    <StatusBadge status={item.status} />
                  </td>
                  {canManageRoster && (
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ConfirmDeleteButton
                          confirming={confirmingPlantId === item.id}
                          disabled={saving}
                          label={item.description || item.type}
                          onArm={() => setConfirmingPlantId(item.id)}
                          onCancel={() => setConfirmingPlantId(null)}
                          onConfirm={() => {
                            onDeletePlant(item.id);
                            setConfirmingPlantId(null);
                          }}
                        />
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
  );
}
