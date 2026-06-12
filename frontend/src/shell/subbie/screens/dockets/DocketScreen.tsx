/**
 * DocketScreen — /p/docket (today) and /p/docket/:docketId — the subbie's
 * primary money workflow on the mobile shell.
 *
 * Design spec: docs/design-subbie-shell-mock-v1.html #docket / #submitted /
 * #queried. State machine + every payload come from the CLASSIC DocketEditPage:
 * this screen is a re-skin over the same logic, NOT a reimplementation.
 *
 *   - Bootstrap queries: useMyCompanyQuery / useAssignedLotsQuery /
 *     useDocketEditQuery / useExistingDocketsQuery (classic docketEditData hooks,
 *     same query keys → shared cache with the classic portal).
 *   - Today-detection: findTodayDocket + formatDateKey (imported, never reimplemented).
 *   - Money helpers: calculateHours / parseDailyHoursInput / isEditableDocketStatus
 *     (imported). Running totals come from each mutation's runningTotal.cost.
 *   - Submit / respond: useDocketSubmitActions (parameterized with /p redirect +
 *     onSubmitted callback so submit shows the in-shell confirmation state).
 *
 * Lazy creation: NO docket POST until the first entry is added (ensureDocket),
 * then history.replace to /p/docket/:id — exactly as classic.
 *
 * Online-only (classic has no offline docket queue — we keep it that way).
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, AlertTriangle, Loader2, Send, Check, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage, handleApiError, isForbidden } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { formatDateKey } from '@/lib/localDate';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ShellScreen } from '@/shell/components/ShellScreen';
import {
  findTodayDocket,
  useAssignedLotsQuery,
  useDocketEditQuery,
  useExistingDocketsQuery,
  useMyCompanyQuery,
  type Docket,
  type LabourEntry,
  type Lot,
  type PlantEntry,
} from '@/pages/subcontractor-portal/docketEditData';
import {
  calculateHours,
  isEditableDocketStatus,
  parseDailyHoursInput,
  PLANT_HOURS_INPUT_ERROR,
} from '@/pages/subcontractor-portal/docketEditHelpers';
import { useDocketEntrySheetState } from '@/pages/subcontractor-portal/useDocketEntrySheetState';
import { useDocketSubmitActions } from '@/pages/subcontractor-portal/useDocketSubmitActions';
import { formatCurrency } from '@/pages/subcontractor-portal/subcontractorDashboardHelpers';
import { LOTS_MODULE_DISABLED_DOCKET_MESSAGE } from '@/pages/subcontractor-portal/subcontractorDashboardHelpers';
import { LabourSheet, PlantSheet } from './DocketEntrySheets';

// Stable empty reference so an empty lot list keeps the same identity per render.
const EMPTY_LOTS: Lot[] = [];

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'DRAFT', cls: 'shell-badge-draft' },
  pending_approval: { label: 'PENDING', cls: 'shell-badge-pend' },
  approved: { label: 'APPROVED', cls: 'shell-badge-ok' },
  queried: { label: 'QUERIED', cls: 'shell-badge-pend' },
  rejected: { label: 'REJECTED', cls: 'shell-badge-bad' },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_BADGE[status] ?? STATUS_BADGE.draft;
  return <span className={cn('shell-badge', meta.cls)}>{meta.label}</span>;
}

// Time range like "7:00 – 15:00" for a labour entry row.
function formatTimeRange(start: string, finish: string): string {
  const trim = (t: string) => t.replace(/^0/, '');
  return `${trim(start)} – ${trim(finish)}`;
}

export function DocketScreen() {
  const navigate = useNavigate();
  const { docketId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const userId = user?.id;
  const requestedProjectId = searchParams.get('projectId');
  const isNewDocket = !docketId || docketId === 'new';

  const [saving, setSaving] = useState(false);
  const [docket, setDocket] = useState<Docket | null>(null);
  const [notes, setNotes] = useState('');
  const [queryResponse, setQueryResponse] = useState('');
  // After a successful submit we show the mock #submitted confirmation in-shell.
  const [submittedConfirm, setSubmittedConfirm] = useState<{
    total: number;
    entryCount: number;
    date: string;
  } | null>(null);

  const today = formatDateKey();

  // ── Bootstrap reads (classic query hooks, shared cache) ─────────────────────
  const companyQuery = useMyCompanyQuery(userId, requestedProjectId);
  const company = companyQuery.data ?? null;

  const lotsQuery = useAssignedLotsQuery(userId, company?.projectId);
  const assignedLots = lotsQuery.data ?? EMPTY_LOTS;
  const lotsModuleDisabled = isForbidden(lotsQuery.error);

  const docketQuery = useDocketEditQuery(userId, docketId, !isNewDocket);
  const existingDocketsQuery = useExistingDocketsQuery(userId, company?.projectId, isNewDocket);

  const todayDocket =
    isNewDocket && existingDocketsQuery.data
      ? findTodayDocket(existingDocketsQuery.data, today)
      : undefined;

  // ── Entry-sheet state (classic hook — money preview + validation) ───────────
  const {
    sheetOpen,
    sheetType,
    selectedEmployee,
    selectedPlant,
    startTime,
    finishTime,
    hoursOperated,
    wetOrDry,
    selectedLotId,
    plantHoursError,
    previewHours,
    previewCost,
    setStartTime,
    setFinishTime,
    setHoursOperated,
    setWetOrDry,
    setSelectedLotId,
    setSelectedEmployee,
    setSelectedPlant,
    resetSheetState,
    openAddLabour,
    openAddPlant,
    closeSheet,
  } = useDocketEntrySheetState(assignedLots);

  // Seed the local editing buffer from the loaded docket (re-runs on docketId change).
  useEffect(() => {
    if (docketQuery.data) {
      setDocket(docketQuery.data);
      setNotes(docketQuery.data.notes || '');
    }
  }, [docketQuery.data]);

  // A docket already exists for today → redirect to it (history.replace), staying in /p.
  useEffect(() => {
    if (todayDocket) {
      const projectQuery = company?.projectId
        ? `?projectId=${encodeURIComponent(company.projectId)}`
        : '';
      navigate(`/p/docket/${todayDocket.id}${projectQuery}`, { replace: true });
    }
  }, [todayDocket, company?.projectId, navigate]);

  const loading =
    companyQuery.isLoading ||
    (Boolean(company) && lotsQuery.isLoading) ||
    (isNewDocket ? Boolean(company) && existingDocketsQuery.isLoading : docketQuery.isLoading) ||
    Boolean(todayDocket);

  const error = companyQuery.isError
    ? extractErrorMessage(companyQuery.error, 'Failed to load data')
    : !isNewDocket && docketQuery.isError
      ? 'Docket not found'
      : null;

  // ── Lazy create — no POST until the first entry is added (classic ensureDocket) ─
  const ensureDocket = useCallback(async () => {
    if (docket) return docket;
    try {
      const data = await apiFetch<{ docket: Docket }>(`/api/dockets`, {
        method: 'POST',
        body: JSON.stringify({ projectId: company?.projectId, date: today, notes }),
      });
      const newDocket: Docket = {
        ...data.docket,
        labourEntries: [],
        plantEntries: [],
        totalLabourSubmitted: 0,
        totalPlantSubmitted: 0,
      };
      setDocket(newDocket);
      const projectQuery = company?.projectId
        ? `?projectId=${encodeURIComponent(company.projectId)}`
        : '';
      navigate(`/p/docket/${newDocket.id}${projectQuery}`, { replace: true });
      return newDocket;
    } catch (err) {
      logError('Error creating docket:', err);
      throw err;
    }
  }, [docket, company, today, notes, navigate]);

  // ── Notes auto-save on blur (PATCH only when editable AND changed) ───────────
  const saveDocketNotes = useCallback(
    async (targetDocket?: Docket | null) => {
      const currentDocket = targetDocket || docket;
      if (!currentDocket || !isEditableDocketStatus(currentDocket.status)) {
        return currentDocket;
      }
      const currentNotes = currentDocket.notes || '';
      if (currentNotes === notes) {
        return currentDocket;
      }
      const data = await apiFetch<{ docket: Docket }>(`/api/dockets/${currentDocket.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
      const updatedNotes = data.docket.notes || '';
      setDocket((prev) =>
        prev?.id === currentDocket.id ? { ...prev, notes: updatedNotes } : prev,
      );
      return { ...currentDocket, notes: updatedNotes };
    },
    [docket, notes],
  );

  const handleNotesBlur = () => {
    if (!docket || !isEditableDocketStatus(docket.status)) return;
    void saveDocketNotes(docket).catch((err) => {
      handleApiError(err, 'Failed to save docket notes');
    });
  };

  // ── Add labour ──────────────────────────────────────────────────────────────
  const addLabourEntry = async () => {
    if (!selectedEmployee || !selectedLotId) {
      toast({
        title: 'Missing information',
        description: 'Please select an employee and a lot',
        variant: 'error',
      });
      return;
    }
    setSaving(true);
    try {
      const currentDocket = await ensureDocket();
      const hours = calculateHours(startTime, finishTime);
      const data = await apiFetch<{ labourEntry: LabourEntry; runningTotal: { cost: number } }>(
        `/api/dockets/${currentDocket.id}/labour`,
        {
          method: 'POST',
          body: JSON.stringify({
            employeeId: selectedEmployee.id,
            startTime,
            finishTime,
            lotAllocations: [{ lotId: selectedLotId, hours }],
          }),
        },
      );
      setDocket((prev) =>
        prev
          ? {
              ...prev,
              labourEntries: [...prev.labourEntries, data.labourEntry],
              totalLabourSubmitted: data.runningTotal.cost,
            }
          : prev,
      );
      closeSheet();
      resetSheetState();
      toast({ title: 'Labour entry added', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to add labour entry');
    } finally {
      setSaving(false);
    }
  };

  // ── Add plant ─────────────────────────────────────────────────────────────────
  const addPlantEntry = async () => {
    if (!selectedPlant) {
      toast({
        title: 'Missing information',
        description: 'Please select plant/equipment',
        variant: 'error',
      });
      return;
    }
    const parsedHoursOperated = parseDailyHoursInput(hoursOperated);
    if (parsedHoursOperated === null) {
      toast({
        title: 'Invalid hours operated',
        description: PLANT_HOURS_INPUT_ERROR,
        variant: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      const currentDocket = await ensureDocket();
      const data = await apiFetch<{ plantEntry: PlantEntry; runningTotal: { cost: number } }>(
        `/api/dockets/${currentDocket.id}/plant`,
        {
          method: 'POST',
          body: JSON.stringify({
            plantId: selectedPlant.id,
            hoursOperated: parsedHoursOperated,
            wetOrDry,
          }),
        },
      );
      setDocket((prev) =>
        prev
          ? {
              ...prev,
              plantEntries: [...prev.plantEntries, data.plantEntry],
              totalPlantSubmitted: data.runningTotal.cost,
            }
          : prev,
      );
      closeSheet();
      resetSheetState();
      toast({ title: 'Plant entry added', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to add plant entry');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete entries (confirm first) ──────────────────────────────────────────
  const deleteLabourEntry = async (entryId: string) => {
    if (!docket) return;
    if (!window.confirm('Remove this crew entry?')) return;
    try {
      await apiFetch(`/api/dockets/${docket.id}/labour/${entryId}`, { method: 'DELETE' });
      setDocket((prev) => {
        if (!prev) return prev;
        const removed = prev.labourEntries.find((e) => e.id === entryId);
        return {
          ...prev,
          labourEntries: prev.labourEntries.filter((e) => e.id !== entryId),
          totalLabourSubmitted: prev.totalLabourSubmitted - (removed?.submittedCost || 0),
        };
      });
      toast({ title: 'Entry deleted', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to delete entry');
    }
  };

  const deletePlantEntry = async (entryId: string) => {
    if (!docket) return;
    if (!window.confirm('Remove this plant entry?')) return;
    try {
      await apiFetch(`/api/dockets/${docket.id}/plant/${entryId}`, { method: 'DELETE' });
      setDocket((prev) => {
        if (!prev) return prev;
        const removed = prev.plantEntries.find((e) => e.id === entryId);
        return {
          ...prev,
          plantEntries: prev.plantEntries.filter((e) => e.id !== entryId),
          totalPlantSubmitted: prev.totalPlantSubmitted - (removed?.submittedCost || 0),
        };
      });
      toast({ title: 'Entry deleted', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to delete entry');
    }
  };

  // ── Submit / respond (classic hook, /p redirect + in-shell confirmation) ─────
  const { submitting, respondingToQuery, submitDocket, respondToQuery } = useDocketSubmitActions({
    docket,
    queryResponse,
    saveDocketNotes,
    navigate,
    redirectTo: '/p',
    onSubmitted: () => {
      if (!docket) return;
      setSubmittedConfirm({
        total: (docket.totalLabourSubmitted || 0) + (docket.totalPlantSubmitted || 0),
        entryCount: docket.labourEntries.length + docket.plantEntries.length,
        date: docket.date,
      });
    },
    // respond resubmits then returns to /p (mock #queried "Send answer & resubmit" → home).
  });

  // ── Derived state ───────────────────────────────────────────────────────────
  const approvedEmployees = company?.employees ?? [];
  const approvedPlant = company?.plant ?? [];
  const totalLabour = docket?.totalLabourSubmitted || 0;
  const totalPlant = docket?.totalPlantSubmitted || 0;
  const totalCost = totalLabour + totalPlant;
  const labourEntries = docket?.labourEntries ?? [];
  const plantEntries = docket?.plantEntries ?? [];

  const canEdit = isEditableDocketStatus(docket?.status);
  const canSubmit = Boolean(
    docket &&
    (docket.status === 'draft' || docket.status === 'rejected') &&
    (labourEntries.length > 0 || plantEntries.length > 0),
  );
  const isQueried = docket?.status === 'queried';
  const isRejected = docket?.status === 'rejected';

  const backPath = '/p';

  // ── Loading / error guards ──────────────────────────────────────────────────
  if (loading) {
    return (
      <ShellScreen
        variant="inner"
        title="Today's Docket"
        parent={backPath}
        sub={<span>Loading…</span>}
      >
        <div className="h-[72px] animate-pulse rounded-2xl bg-muted" />
        <div className="h-[72px] animate-pulse rounded-2xl bg-muted" />
      </ShellScreen>
    );
  }

  if (error) {
    return (
      <ShellScreen variant="inner" title="Docket" parent={backPath} sub={<span>Error</span>}>
        <div className="shell-notice shell-notice-bad">
          <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0" />
          <span>{error}</span>
        </div>
      </ShellScreen>
    );
  }

  // ── Submitted confirmation (mock #submitted) ────────────────────────────────
  if (submittedConfirm) {
    const dateLabel = new Intl.DateTimeFormat('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
      .format(new Date(submittedConfirm.date))
      .toUpperCase();
    return (
      <ShellScreen
        variant="inner"
        title="Docket sent"
        parent={backPath}
        bottom={
          <div className="shell-primary">
            <button
              type="button"
              className="shell-primary-btn"
              onClick={() => navigate('/p')}
              aria-label="Done"
            >
              Done
            </button>
          </div>
        }
      >
        <div className="flex flex-col items-center gap-4 px-5 py-10 text-center">
          <div className="shell-bigtick">
            <Check size={52} strokeWidth={2.4} aria-hidden="true" />
          </div>
          <div className="shell-display-title">Sent for approval</div>
          <div className="shell-mono text-[12.5px] text-muted-foreground">
            {dateLabel} — {formatCurrency(submittedConfirm.total)} — {submittedConfirm.entryCount}{' '}
            {submittedConfirm.entryCount === 1 ? 'ENTRY' : 'ENTRIES'}
          </div>
          <p className="max-w-[280px] text-[14px] text-muted-foreground">
            The foreman gets it straight away. You'll be notified when it's approved.
          </p>
        </div>
      </ShellScreen>
    );
  }

  // ── Header sub-line ─────────────────────────────────────────────────────────
  const headerDateLabel = new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date(docket?.date || today))
    .toUpperCase();

  const sub = (
    <span className="flex items-center gap-2">
      <span className="shell-mono">{headerDateLabel}</span>
      {canEdit ? (
        <span>Saved automatically — submit at knock-off</span>
      ) : (
        <span>
          {labourEntries.length + plantEntries.length} entries · {formatCurrency(totalCost)}
        </span>
      )}
    </span>
  );

  // ── Bottom action bar ───────────────────────────────────────────────────────
  let bottom: React.ReactNode = undefined;
  if (isQueried) {
    bottom = (
      <div className="shell-primary">
        <button
          type="button"
          className={cn(
            'shell-primary-btn',
            (!queryResponse.trim() || respondingToQuery) && 'opacity-50',
          )}
          disabled={!queryResponse.trim() || respondingToQuery}
          onClick={respondToQuery}
          aria-label="Send answer and resubmit"
        >
          {respondingToQuery ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Sending…
            </>
          ) : (
            <>
              <Send size={18} aria-hidden="true" />
              Send answer &amp; resubmit
            </>
          )}
        </button>
      </div>
    );
  } else if (canEdit && (docket?.status === 'draft' || docket?.status === 'rejected' || !docket)) {
    bottom = (
      <div className="shell-primary">
        <button
          type="button"
          className={cn('shell-primary-btn', (!canSubmit || submitting) && 'opacity-50')}
          disabled={!canSubmit || submitting}
          onClick={submitDocket}
          aria-label={isRejected ? 'Resubmit for approval' : 'Submit for approval'}
        >
          {submitting ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Submitting…
            </>
          ) : (
            <>
              {isRejected ? 'Resubmit for approval' : 'Submit for approval'}
              {totalCost > 0 && (
                <span className="shell-hero-money text-[18px]">{formatCurrency(totalCost)}</span>
              )}
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <ShellScreen
      variant="inner"
      title={
        isNewDocket || !docket?.docketNumber
          ? "Today's Docket"
          : docket.date === today
            ? "Today's Docket"
            : `Docket ${docket.docketNumber}`
      }
      parent={backPath}
      sub={sub}
      headerExtra={
        docket ? (
          <div className="mt-2">
            <StatusBadge status={docket.status} />
          </div>
        ) : undefined
      }
      bottom={bottom}
    >
      {/* Queried — foreman query quoted + answer textarea (mock #queried) */}
      {isQueried && (
        <>
          <div className="shell-notice shell-notice-warn">
            <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0 text-warning" />
            <div className="min-w-0">
              <b className="block">Foreman asked:</b>
              <div className="shell-quote">
                “{docket?.foremanNotes || 'Please review this docket'}”
              </div>
            </div>
          </div>
        </>
      )}

      {/* Rejected — reason in a red notice, editable below (mock) */}
      {isRejected && (
        <div className="shell-notice shell-notice-bad">
          <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0" />
          <div className="min-w-0">
            <b className="block">Sent back:</b>
            <span className="block">{docket?.foremanNotes || 'No reason provided'}</span>
            <span className="mt-1 block text-[12.5px]">Fix the entries below and resubmit.</span>
          </div>
        </div>
      )}

      {/* Lots-module-off / no-lots notices (classic copy) */}
      {canEdit &&
        (lotsModuleDisabled ? (
          <div className="shell-notice shell-notice-warn">
            <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0 text-warning" />
            <span>{LOTS_MODULE_DISABLED_DOCKET_MESSAGE}</span>
          </div>
        ) : (
          assignedLots.length === 0 && (
            <div className="shell-notice shell-notice-warn">
              <AlertTriangle size={19} aria-hidden="true" className="mt-px shrink-0 text-warning" />
              <span>
                No lots have been assigned to you yet. Contact your project manager to get lot
                assignments.
              </span>
            </div>
          )
        ))}

      {/* CREW */}
      <div className="shell-sect">
        <span className="t">CREW</span>
        <span className="n">{labourEntries.length} on site</span>
      </div>
      {labourEntries.map((entry) => (
        <div key={entry.id} className="shell-entry">
          <div className="grow">
            <div className="t">{entry.employee.name}</div>
            <div className="d">
              <span className="shell-mono">
                {formatTimeRange(entry.startTime, entry.finishTime)}
              </span>
              {entry.lotAllocations[0]?.lotNumber && (
                <span className="shell-lotchip">{entry.lotAllocations[0].lotNumber}</span>
              )}
            </div>
          </div>
          <div>
            <span className="cost">{formatCurrency(entry.submittedCost)}</span>
            <span className="hrs">{entry.submittedHours} h</span>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => deleteLabourEntry(entry.id)}
              aria-label={`Remove ${entry.employee.name}`}
              className="-mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-secondary"
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <button
          type="button"
          className="shell-addline"
          onClick={() => openAddLabour()}
          aria-label="Add crew hours"
        >
          <Plus size={19} aria-hidden="true" />
          Add crew hours
        </button>
      )}

      {/* PLANT */}
      <div className="shell-sect" style={{ marginTop: 6 }}>
        <span className="t">PLANT</span>
        <span className="n">
          {plantEntries.length} {plantEntries.length === 1 ? 'machine' : 'machines'}
        </span>
      </div>
      {plantEntries.map((entry) => (
        <div key={entry.id} className="shell-entry">
          <div className="grow">
            <div className="t">
              {entry.plant.type}
              {entry.plant.description ? ` — ${entry.plant.description}` : ''}
            </div>
            <div className="d">
              <span className="shell-mono">{entry.hoursOperated} h</span>
              <span className="shell-lotchip">{entry.wetOrDry === 'wet' ? 'WET' : 'DRY'}</span>
            </div>
          </div>
          <div>
            <span className="cost">{formatCurrency(entry.submittedCost)}</span>
            <span className="hrs">@ ${entry.hourlyRate}/h</span>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => deletePlantEntry(entry.id)}
              aria-label={`Remove ${entry.plant.type}`}
              className="-mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground active:bg-secondary"
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <button
          type="button"
          className="shell-addline"
          onClick={() => openAddPlant()}
          aria-label="Add plant hours"
        >
          <Plus size={19} aria-hidden="true" />
          Add plant hours
        </button>
      )}

      {/* NOTES — editable statuses auto-save on blur; queried shows the answer box */}
      {isQueried ? (
        <>
          <div className="shell-sect" style={{ marginTop: 6 }}>
            <span className="t">YOUR ANSWER</span>
          </div>
          <textarea
            className="shell-notes"
            value={queryResponse}
            onChange={(e) => setQueryResponse(e.target.value)}
            placeholder="Reply to the foreman…"
            aria-label="Your answer to the foreman"
          />
        </>
      ) : (
        <>
          <div className="shell-sect" style={{ marginTop: 6 }}>
            <span className="t">NOTES</span>
          </div>
          {canEdit ? (
            <textarea
              className="shell-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Anything the foreman should know — delays, extra work, conditions…"
              aria-label="Docket notes"
            />
          ) : (
            <div className="shell-card text-[14px] text-muted-foreground">
              {notes.trim() ? notes : 'No notes.'}
            </div>
          )}
        </>
      )}

      {/* Totals card */}
      {(labourEntries.length > 0 || plantEntries.length > 0) && (
        <div className="shell-totals" style={{ marginTop: 6 }}>
          <div className="ln">
            <span>
              Labour ({labourEntries.length} {labourEntries.length === 1 ? 'entry' : 'entries'})
            </span>
            <span className="shell-mono">{formatCurrency(totalLabour)}</span>
          </div>
          <div className="ln">
            <span>
              Plant ({plantEntries.length} {plantEntries.length === 1 ? 'entry' : 'entries'})
            </span>
            <span className="shell-mono">{formatCurrency(totalPlant)}</span>
          </div>
          <div className="grand">
            <span>Today's total</span>
            <span className="shell-mono">{formatCurrency(totalCost)}</span>
          </div>
        </div>
      )}

      {/* Read-only status line for pending/approved (no edit affordances above) */}
      {!canEdit && (docket?.status === 'pending_approval' || docket?.status === 'approved') && (
        <div className="shell-notice shell-notice-warn" role="status">
          <Check size={19} aria-hidden="true" className="mt-px shrink-0" />
          <span>
            {docket.status === 'approved'
              ? 'This docket is approved.'
              : 'Sent — waiting on the foreman to approve.'}
          </span>
        </div>
      )}

      {/* Entry sheets — only mount the relevant one when open */}
      {sheetOpen && sheetType === 'labour' && (
        <LabourSheet
          open={sheetOpen}
          employees={approvedEmployees}
          selectedEmployee={selectedEmployee}
          startTime={startTime}
          finishTime={finishTime}
          selectedLotId={selectedLotId}
          assignedLots={assignedLots}
          previewHours={previewHours}
          previewCost={previewCost}
          saving={saving}
          onSelectEmployee={setSelectedEmployee}
          onStartTimeChange={setStartTime}
          onFinishTimeChange={setFinishTime}
          onSelectedLotIdChange={setSelectedLotId}
          onClose={closeSheet}
          onAdd={addLabourEntry}
        />
      )}
      {sheetOpen && sheetType === 'plant' && (
        <PlantSheet
          open={sheetOpen}
          plant={approvedPlant}
          selectedPlant={selectedPlant}
          hoursOperated={hoursOperated}
          wetOrDry={wetOrDry}
          plantHoursError={plantHoursError}
          previewHours={previewHours}
          previewCost={previewCost}
          saving={saving}
          onSelectPlant={setSelectedPlant}
          onHoursOperatedChange={setHoursOperated}
          onWetOrDryChange={setWetOrDry}
          onClose={closeSheet}
          onAdd={addPlantEntry}
        />
      )}
    </ShellScreen>
  );
}
