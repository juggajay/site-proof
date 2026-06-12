/**
 * CompanyScreen — /p/company — the subbie shell's crew/plant roster surface.
 *
 * Implements docs/design-subbie-shell-mock-v1.html #company on the inner
 * ShellScreen. Reuses EXISTING LOGIC verbatim:
 *   - data: the classic `useMyCompanyQuery` hook (queryKeys.myCompany — the SAME
 *     key the classic MyCompanyPage uses, so the cache is shared and new rows
 *     surface via the same invalidation). The shell's selected projectId comes
 *     from the subbie context.
 *   - write gate: `canManageRoster = user.role === 'subcontractor_admin'` —
 *     byte-identical to MyCompanyPage.tsx:44. Plain `subcontractor` is view-only.
 *   - rate validation: `parseRateInput` (imported) — invalid rate is rejected
 *     before the POST, exactly as the classic page does.
 *   - endpoints: POST /api/subcontractors/my-company/{employees,plant};
 *     DELETE …/employees/:id?projectId= and …/plant/:id?projectId=.
 *
 * Add forms open in the app's existing BottomSheet (already role=dialog — not
 * double-wrapped). The mock's COUNTER badge + countered-rate line are supported
 * defensively; see the PR body for the backend deviation (the portal my-company
 * read currently collapses status to approved|pending and does not expose a
 * countered rate).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ShellScreen } from '@/shell/components/ShellScreen';
import { BottomSheet } from '@/components/foreman/sheets/BottomSheet';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { logError } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { parseRateInput } from '@/pages/subcontractors/rateValidation';
import { useMyCompanyQuery, type Employee, type Plant } from '@/pages/subcontractors/myCompanyData';
import { formatCompanyRate } from '@/pages/subcontractors/myCompanyDisplayHelpers';
import { useSubbieShellContext } from '../subbieShellContext';

const EMPLOYEE_ROLES = [
  'Supervisor',
  'Foreman',
  'Operator',
  'Labourer',
  'Leading Hand',
  'Pipe Layer',
  'Traffic Controller',
];

const PLANT_TYPES = [
  'Excavator',
  'Loader',
  'Roller',
  'Grader',
  'Dump Truck',
  'Water Cart',
  'Paver',
  'Bobcat',
  'Compactor',
  'Other',
];

// A roster row can in principle carry a counter status + countered rate; the
// classic CompanyData types narrow status to pending|approved|inactive, so we
// read the extra fields defensively without widening those exported types.
interface CounterFields {
  counterRate?: number;
  counterDryRate?: number;
  counterWetRate?: number;
}

/** Read `status` as a free string so the defensive `counter` branch type-checks. */
function rowStatus(row: { status: string }): string {
  return row.status;
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'approved':
      return { label: 'APPROVED', cls: 'shell-badge-ok' };
    case 'counter':
      return { label: 'COUNTER', cls: 'shell-badge-pend' };
    case 'inactive':
      return { label: 'INACTIVE', cls: 'shell-badge-draft' };
    default:
      return { label: 'PENDING', cls: 'shell-badge-pend' };
  }
}

// ── Field primitives (dark shell form styling) ────────────────────────────────

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[13px] font-semibold text-foreground">
      {children}
    </label>
  );
}

const fieldClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-ring';

// ── Roster rows ───────────────────────────────────────────────────────────────

function EmployeeRow({
  employee,
  canManage,
  saving,
  armed,
  onDelete,
}: {
  employee: Employee;
  canManage: boolean;
  saving: boolean;
  armed: boolean;
  onDelete: () => void;
}) {
  const counter = employee as Employee & CounterFields;
  const status = rowStatus(employee);
  const badge = statusBadge(status);
  const dim = status === 'inactive';

  return (
    <div className={cn('flex items-center gap-3 py-2.5', dim && 'opacity-60')}>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-foreground">{employee.name}</div>
        <div className="text-[13px] text-muted-foreground">{employee.role}</div>
      </div>
      <div className="text-right">
        <span className="shell-mono text-[13px] font-semibold text-foreground">
          {formatCompanyRate(employee.hourlyRate)}/h
        </span>
        {status === 'counter' && counter.counterRate !== undefined && (
          <span className="ml-1.5 shell-mono text-[12px] text-warning">
            → {formatCompanyRate(counter.counterRate)}
          </span>
        )}
      </div>
      <span className={cn('shell-badge', badge.cls)}>{badge.label}</span>
      {canManage && (
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          className={cn(
            '-mr-1 rounded-lg p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50',
            armed && 'text-[12px] font-semibold',
          )}
          aria-label={`Remove ${employee.name}`}
        >
          {armed ? 'Remove?' : <Trash2 size={16} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

function PlantRow({
  plant,
  canManage,
  saving,
  armed,
  onDelete,
}: {
  plant: Plant;
  canManage: boolean;
  saving: boolean;
  armed: boolean;
  onDelete: () => void;
}) {
  const counter = plant as Plant & CounterFields;
  const status = rowStatus(plant);
  const badge = statusBadge(status);
  const dim = status === 'inactive';

  const rates =
    plant.wetRate > 0
      ? `dry ${formatCompanyRate(plant.dryRate)} / wet ${formatCompanyRate(plant.wetRate)}`
      : `dry ${formatCompanyRate(plant.dryRate)}`;
  const meta = [plant.idRego, rates].filter(Boolean).join(' · ');

  return (
    <div className={cn('flex items-center gap-3 py-2.5', dim && 'opacity-60')}>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-foreground">
          {plant.description || plant.type}
        </div>
        <div className="text-[13px] text-muted-foreground">
          {meta}
          {status === 'counter' && counter.counterDryRate !== undefined && (
            <>
              {' '}
              — HC countered{' '}
              <b className="shell-mono font-semibold text-warning">
                {formatCompanyRate(counter.counterDryRate)}
              </b>
            </>
          )}
        </div>
      </div>
      <span className={cn('shell-badge', badge.cls)}>{badge.label}</span>
      {canManage && (
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          className={cn(
            '-mr-1 rounded-lg p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50',
            armed && 'text-[12px] font-semibold',
          )}
          aria-label={`Remove ${plant.description || plant.type}`}
        >
          {armed ? 'Remove?' : <Trash2 size={16} aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

function AddLineButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-[14px] font-semibold text-muted-foreground hover:bg-secondary/40"
    >
      <Plus size={18} aria-hidden="true" />
      {label}
    </button>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count: string }) {
  return (
    <div className="mt-1 flex items-baseline justify-between">
      <span className="font-mono text-[11.5px] font-semibold tracking-[0.12em] text-muted-foreground">
        {children}
      </span>
      <span className="font-mono text-[11.5px] font-medium text-muted-foreground/70">{count}</span>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function CompanyScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { projectId } = useSubbieShellContext();

  // Same query key as classic MyCompanyPage — cache is shared, full roster shape.
  const companyQuery = useMyCompanyQuery(user?.id, projectId);
  const company = companyQuery.data ?? null;

  // Write gate — byte-identical to MyCompanyPage.tsx:44.
  const canManageRoster = user?.role === 'subcontractor_admin';

  const [sheet, setSheet] = useState<'employee' | 'plant' | null>(null);
  const [saving, setSaving] = useState(false);
  // Two-tap delete confirm (readiness guardrail forbids window.confirm): first
  // tap arms the row's delete button ("Remove?"), a second tap within 4s
  // deletes; the timeout disarms.
  const [armedDelete, setArmedDelete] = useState<string | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    [],
  );
  const confirmArmed = (key: string): boolean => {
    if (armedDelete === key) {
      if (armTimer.current) clearTimeout(armTimer.current);
      setArmedDelete(null);
      return true;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    setArmedDelete(key);
    armTimer.current = setTimeout(() => setArmedDelete(null), 4000);
    return false;
  };
  const [formError, setFormError] = useState<string | null>(null);
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

  const refetchCompany = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.myCompany(user?.id, projectId),
    });
  }, [queryClient, user?.id, projectId]);

  const closeSheet = () => {
    setSheet(null);
    setFormError(null);
  };

  const addEmployee = async () => {
    const name = employeeForm.name.trim();
    const phone = employeeForm.phone.trim();
    const role = employeeForm.role.trim();
    const hourlyRate = parseRateInput(employeeForm.hourlyRate);

    if (!name || !role || hourlyRate === null) {
      setFormError(
        'Enter an employee name, role, and hourly rate greater than 0 with up to 2 decimal places.',
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/api/subcontractors/my-company/employees', {
        method: 'POST',
        body: JSON.stringify({ projectId: company?.projectId, name, phone, role, hourlyRate }),
      });
      await refetchCompany();
      setEmployeeForm({ name: '', phone: '', role: '', hourlyRate: '' });
      setSheet(null);
    } catch (error) {
      logError('Error adding employee:', error);
      setFormError('Employee could not be added. Please try again.');
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
      setFormError(
        'Enter plant type, description, a dry rate greater than 0, and an optional wet rate with up to 2 decimal places.',
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/api/subcontractors/my-company/plant', {
        method: 'POST',
        body: JSON.stringify({
          projectId: company?.projectId,
          type,
          description,
          idRego,
          dryRate,
          wetRate,
        }),
      });
      await refetchCompany();
      setPlantForm({ type: '', description: '', idRego: '', dryRate: '', wetRate: '' });
      setSheet(null);
    } catch (error) {
      logError('Error adding plant:', error);
      setFormError('Plant could not be added. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const deleteEmployee = async (empId: string) => {
    setSaving(true);
    try {
      const query = company?.projectId ? `?projectId=${encodeURIComponent(company.projectId)}` : '';
      await apiFetch(
        `/api/subcontractors/my-company/employees/${encodeURIComponent(empId)}${query}`,
        { method: 'DELETE' },
      );
      await refetchCompany();
    } catch (error) {
      logError('Error deleting employee:', error);
    } finally {
      setSaving(false);
    }
  };

  const deletePlant = async (plantId: string) => {
    setSaving(true);
    try {
      const query = company?.projectId ? `?projectId=${encodeURIComponent(company.projectId)}` : '';
      await apiFetch(
        `/api/subcontractors/my-company/plant/${encodeURIComponent(plantId)}${query}`,
        { method: 'DELETE' },
      );
      await refetchCompany();
    } catch (error) {
      logError('Error deleting plant:', error);
    } finally {
      setSaving(false);
    }
  };

  const sub = company ? (
    <span className="text-muted-foreground">
      {company.companyName}
      {company.abn ? ` · ABN ${company.abn}` : ''}
    </span>
  ) : (
    <span className="text-muted-foreground">Crew, plant &amp; rates</span>
  );

  if (companyQuery.isLoading) {
    return (
      <ShellScreen variant="inner" title="My Company" parent="/p" sub={sub}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[56px] animate-pulse rounded-2xl bg-muted" />
        ))}
      </ShellScreen>
    );
  }

  if (!company) {
    return (
      <ShellScreen variant="inner" title="My Company" parent="/p" sub={sub}>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[14px] text-muted-foreground">
            You are not associated with a subcontractor company. Please contact your administrator.
          </p>
        </div>
      </ShellScreen>
    );
  }

  const employees = company.employees;
  const plant = company.plant;
  const isPendingStatus = (status: string) => status === 'pending' || status === 'counter';
  const pendingEmployees = employees.filter((e) => isPendingStatus(e.status)).length;
  const pendingPlant = plant.filter((p) => isPendingStatus(p.status)).length;
  const showPendingNotice = pendingEmployees > 0 || pendingPlant > 0;
  const pendingCount = pendingEmployees + pendingPlant;

  return (
    <ShellScreen variant="inner" title="My Company" parent="/p" sub={sub}>
      {showPendingNotice && (
        <div className="shell-notice shell-notice-warn">
          <div>
            <b className="block text-[13.5px]">
              {pendingCount} rate{pendingCount === 1 ? '' : 's'} waiting on approval
            </b>
            <span className="block text-[13.5px]">
              Pending crew or plant can’t go on dockets until the head contractor approves their
              rate.
            </span>
          </div>
        </div>
      )}

      {/* CREW */}
      <SectionLabel count={`${employees.length} ${employees.length === 1 ? 'person' : 'people'}`}>
        CREW
      </SectionLabel>
      <div className="rounded-2xl border border-border bg-card px-4">
        {employees.length === 0 ? (
          <p className="py-4 text-[13.5px] text-muted-foreground">No crew added yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {employees.map((e) => (
              <EmployeeRow
                key={e.id}
                employee={e}
                canManage={canManageRoster}
                saving={saving}
                armed={armedDelete === `emp-${e.id}`}
                onDelete={() => {
                  if (confirmArmed(`emp-${e.id}`)) void deleteEmployee(e.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
      {canManageRoster && (
        <AddLineButton label="Add crew member" onClick={() => setSheet('employee')} />
      )}

      {/* PLANT */}
      <SectionLabel count={`${plant.length} ${plant.length === 1 ? 'machine' : 'machines'}`}>
        PLANT
      </SectionLabel>
      <div className="rounded-2xl border border-border bg-card px-4">
        {plant.length === 0 ? (
          <p className="py-4 text-[13.5px] text-muted-foreground">No plant registered yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {plant.map((p) => (
              <PlantRow
                key={p.id}
                plant={p}
                canManage={canManageRoster}
                saving={saving}
                armed={armedDelete === `plant-${p.id}`}
                onDelete={() => {
                  if (confirmArmed(`plant-${p.id}`)) void deletePlant(p.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
      {canManageRoster && <AddLineButton label="Add plant" onClick={() => setSheet('plant')} />}

      {!canManageRoster && (
        <p className="px-5 py-1 text-center text-[12px] text-muted-foreground/70">
          Adding and removing crew or plant needs a company admin login.
        </p>
      )}

      {/* Add-employee sheet */}
      <BottomSheet isOpen={sheet === 'employee'} onClose={closeSheet} title="Add crew member">
        <div className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive"
            >
              {formError}
            </div>
          )}
          <div>
            <FieldLabel htmlFor="subbie-emp-name">Name *</FieldLabel>
            <input
              id="subbie-emp-name"
              type="text"
              value={employeeForm.name}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, name: e.target.value }))}
              className={fieldClass}
              placeholder="John Smith"
            />
          </div>
          <div>
            <FieldLabel htmlFor="subbie-emp-phone">Phone</FieldLabel>
            <input
              id="subbie-emp-phone"
              type="tel"
              value={employeeForm.phone}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, phone: e.target.value }))}
              className={fieldClass}
              placeholder="0412 345 678"
            />
          </div>
          <div>
            <FieldLabel htmlFor="subbie-emp-role">Role *</FieldLabel>
            <select
              id="subbie-emp-role"
              value={employeeForm.role}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, role: e.target.value }))}
              className={fieldClass}
            >
              <option value="">Select role…</option>
              {EMPLOYEE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="subbie-emp-rate">Proposed Hourly Rate *</FieldLabel>
            <input
              id="subbie-emp-rate"
              type="number"
              inputMode="decimal"
              value={employeeForm.hourlyRate}
              onChange={(e) => setEmployeeForm((f) => ({ ...f, hourlyRate: e.target.value }))}
              className={fieldClass}
              placeholder="85"
              min="0"
              step="0.01"
            />
            <p className="mt-1 text-[12px] text-muted-foreground">
              Rate requires approval from head contractor before use
            </p>
          </div>
          <button
            type="button"
            onClick={() => void addEmployee()}
            disabled={saving}
            className="shell-cambar-btn !static !min-h-[54px] !text-[16px] disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add crew member'}
          </button>
        </div>
      </BottomSheet>

      {/* Add-plant sheet */}
      <BottomSheet isOpen={sheet === 'plant'} onClose={closeSheet} title="Add plant">
        <div className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive"
            >
              {formError}
            </div>
          )}
          <div>
            <FieldLabel htmlFor="subbie-plant-type">Type *</FieldLabel>
            <select
              id="subbie-plant-type"
              value={plantForm.type}
              onChange={(e) => setPlantForm((f) => ({ ...f, type: e.target.value }))}
              className={fieldClass}
            >
              <option value="">Select type…</option>
              {PLANT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="subbie-plant-desc">Description *</FieldLabel>
            <input
              id="subbie-plant-desc"
              type="text"
              value={plantForm.description}
              onChange={(e) => setPlantForm((f) => ({ ...f, description: e.target.value }))}
              className={fieldClass}
              placeholder="20T Excavator"
            />
          </div>
          <div>
            <FieldLabel htmlFor="subbie-plant-rego">ID/Rego</FieldLabel>
            <input
              id="subbie-plant-rego"
              type="text"
              value={plantForm.idRego}
              onChange={(e) => setPlantForm((f) => ({ ...f, idRego: e.target.value }))}
              className={fieldClass}
              placeholder="EXC-001"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="subbie-plant-dry">Dry Rate *</FieldLabel>
              <input
                id="subbie-plant-dry"
                type="number"
                inputMode="decimal"
                value={plantForm.dryRate}
                onChange={(e) => setPlantForm((f) => ({ ...f, dryRate: e.target.value }))}
                className={fieldClass}
                placeholder="150"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <FieldLabel htmlFor="subbie-plant-wet">Wet Rate</FieldLabel>
              <input
                id="subbie-plant-wet"
                type="number"
                inputMode="decimal"
                value={plantForm.wetRate}
                onChange={(e) => setPlantForm((f) => ({ ...f, wetRate: e.target.value }))}
                className={fieldClass}
                placeholder="200"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Rate requires approval from head contractor before use
          </p>
          <button
            type="button"
            onClick={() => void addPlant()}
            disabled={saving}
            className="shell-cambar-btn !static !min-h-[54px] !text-[16px] disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add plant'}
          </button>
        </div>
      </BottomSheet>
    </ShellScreen>
  );
}
