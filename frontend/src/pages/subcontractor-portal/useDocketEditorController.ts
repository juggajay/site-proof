/**
 * useDocketEditorController — the shared correctness core of the subbie docket
 * editor, imported (never forked) by BOTH the classic portal editor
 * (DocketEditPage, /subcontractor-portal/docket/:id) and the mobile shell editor
 * (DocketScreen, /p/docket/:id).
 *
 * The two screens keep their own JSX (routing, layout, copy, entry sheets, and the
 * per-side guards below differ per surface), but the docket STATE MACHINE here was
 * duplicated line-for-line in both — and had already drifted. This controller
 * carries the correctness-critical rules that a fix to one screen used to silently
 * miss in the other:
 *
 *   - SEED-RACE GUARD: after the lazy create, the URL rewrite enables the docket
 *     GET while the first entry POST is still in flight; on slow networks the
 *     entry-less GET response can land last. `seededDocketIdRef` seeds local state
 *     ONCE per docket id and treats the locally created/seeded docket as
 *     authoritative, so a stale GET can never erase the first entry or grey out
 *     Submit. (Fixed for the shell in 61d63b12; the classic editor still had the
 *     bug until this extraction.)
 *   - LAZY CREATE: no docket POST until the first entry is added (`ensureDocket`),
 *     then a per-side URL rewrite to the docket id (`navigateToDocket`).
 *   - RUNNING-TOTAL MATH: each add/remove reducer trusts the mutation's
 *     `runningTotal.cost` and falls back to `max(0, prevTotal - entryCost)` when the
 *     server omits it — identical in both, and the money that drives Submit.
 *   - NOTES AUTOSAVE: `saveDocketNotes` PATCHes only when online, editable, AND the
 *     text actually changed.
 *
 * Per-side UX that must NOT be unified stays in each screen: the offline toasts
 * (classic) vs button-gating, "Save & add another" keepOpen (shell), the two-tap
 * delete confirm (shell), the approved-only employee/plant filter (classic), and
 * all layout/copy. Those wrap the data ops this controller returns.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { handleApiError, extractErrorMessage, isForbidden } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { formatDateKey } from '@/lib/localDate';
import { useAuth } from '@/lib/auth';
import { useOfflineStatus } from '@/lib/useOfflineStatus';
import {
  buildDocketDetailPath,
  buildDocketLabourPath,
  buildDocketPlantPath,
  buildDocketLabourEntryPath,
  buildDocketPlantEntryPath,
  findTodayDocket,
  useAssignedLotsQuery,
  useDocketEditQuery,
  useExistingDocketsQuery,
  useMyCompanyQuery,
  type Docket,
  type LabourEntry,
  type Lot,
  type PlantEntry,
} from './docketEditData';
import { calculateHours, isEditableDocketStatus } from './docketEditHelpers';

// Stable empty reference so an empty lot list keeps the same identity per render.
const EMPTY_LOTS: Lot[] = [];

export interface DocketEditorControllerOptions {
  /**
   * Pure builder for the caller's own docket route, given the docket id and the
   * resolved company scope (classic /subcontractor-portal/docket/:id vs shell
   * /p/docket/:id). The controller performs the history.replace itself for both
   * the "today's docket already exists" redirect and the lazy-create URL rewrite.
   */
  buildDocketPath: (
    docketId: string,
    scope: { projectId?: string | null; subcontractorCompanyId?: string | null },
  ) => string;
}

/** Payload for a single labour line — hours are derived from start/finish here. */
export interface PostLabourInput {
  employeeId: string;
  startTime: string;
  finishTime: string;
  lotId: string;
}

/** Payload for a single plant line — hours are already parsed by the caller. */
export interface PostPlantInput {
  plantId: string;
  hoursOperated: number;
  wetOrDry: string;
  /** Omitted when no lots are assigned (plant needs no allocation then). */
  lotId?: string | null;
}

export function useDocketEditorController({ buildDocketPath }: DocketEditorControllerOptions) {
  const navigate = useNavigate();
  const { docketId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { isOnline } = useOfflineStatus();
  const userId = user?.id;
  const requestedProjectId = searchParams.get('projectId');
  const requestedSubcontractorCompanyId = searchParams.get('subcontractorCompanyId');
  const isNewDocket = !docketId || docketId === 'new';

  const [saving, setSaving] = useState(false);
  const [docket, setDocket] = useState<Docket | null>(null);
  const [notes, setNotes] = useState('');

  const today = formatDateKey();

  // ── Bootstrap reads — shared query hooks / shared cache with the other editor ─
  const companyQuery = useMyCompanyQuery(
    userId,
    requestedProjectId,
    requestedSubcontractorCompanyId,
  );
  const company = companyQuery.data ?? null;

  const lotsQuery = useAssignedLotsQuery(userId, company?.projectId, company?.id);
  const assignedLots = lotsQuery.data ?? EMPTY_LOTS;
  // The lot list 403s when the HC has turned off the subbie's "Assigned Work"
  // (lots) portal module. Labour lines require a lot, so callers surface a
  // plain-language notice instead of an inexplicably empty lot dropdown.
  const lotsModuleDisabled = isForbidden(lotsQuery.error);

  const docketQuery = useDocketEditQuery(userId, docketId, !isNewDocket);
  const existingDocketsQuery = useExistingDocketsQuery(
    userId,
    company?.projectId,
    company?.id,
    isNewDocket,
  );

  const todayDocket =
    isNewDocket && existingDocketsQuery.data
      ? findTodayDocket(existingDocketsQuery.data, today)
      : undefined;

  // history.replace to the caller's own docket route, scoped to the resolved
  // company (matches both editors' original redirect args).
  const goToDocket = useCallback(
    (id: string) => {
      navigate(
        buildDocketPath(id, {
          projectId: company?.projectId,
          subcontractorCompanyId: company?.id,
        }),
        { replace: true },
      );
    },
    [navigate, buildDocketPath, company?.projectId, company?.id],
  );

  // Seed the local editing buffer from the loaded docket — ONCE per docket id.
  // After the lazy create, ensureDocket's navigate(replace) enables this query
  // while the first entry POST is still in flight; the GET was dispatched before
  // the entry existed, so if its response lands AFTER the entry was appended
  // locally, a blind overwrite would erase the entry (and grey out Submit). The id
  // guard makes the local optimistic state authoritative for a docket we've
  // already seeded or created.
  const seededDocketIdRef = useRef<string | null>(null);
  useEffect(() => {
    const fresh = docketQuery.data;
    if (!fresh) return;
    if (seededDocketIdRef.current === fresh.id) return;
    seededDocketIdRef.current = fresh.id;
    setDocket(fresh);
    setNotes(fresh.notes || '');
  }, [docketQuery.data]);

  // A docket already exists for today → redirect to it, staying on the caller's route.
  useEffect(() => {
    if (todayDocket) {
      goToDocket(todayDocket.id);
    }
  }, [todayDocket, goToDocket]);

  const loading =
    companyQuery.isLoading ||
    (Boolean(company) && lotsQuery.isLoading) ||
    // The docket GET only blocks when we have no local docket yet — after the lazy
    // create we already hold the authoritative local copy, and the GET fired by
    // the URL rewrite must not flash a spinner over it.
    (isNewDocket
      ? Boolean(company) && existingDocketsQuery.isLoading
      : !docket && docketQuery.isLoading) ||
    Boolean(todayDocket);

  const error = companyQuery.isError
    ? extractErrorMessage(companyQuery.error, 'Failed to load data')
    : !isNewDocket && docketQuery.isError
      ? 'Docket not found'
      : null;

  // ── Lazy create — no POST until the first entry is added ─────────────────────
  const ensureDocket = useCallback(async () => {
    if (docket) return docket;
    try {
      const data = await apiFetch<{ docket: Docket }>(`/api/dockets`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: company?.projectId,
          subcontractorCompanyId: company?.id,
          date: today,
          notes,
        }),
      });
      const newDocket: Docket = {
        ...data.docket,
        labourEntries: [],
        plantEntries: [],
        totalLabourSubmitted: 0,
        totalPlantSubmitted: 0,
      };
      // We created it — local state is authoritative; the GET fired by the
      // navigate below must not re-seed (see seededDocketIdRef above).
      seededDocketIdRef.current = newDocket.id;
      setDocket(newDocket);
      goToDocket(newDocket.id);
      return newDocket;
    } catch (err) {
      logError('Error creating docket:', err);
      throw err;
    }
  }, [docket, company, today, notes, goToDocket]);

  // ── Notes auto-save (PATCH only when online, editable, AND changed) ──────────
  const saveDocketNotes = useCallback(
    async (targetDocket?: Docket | null) => {
      const currentDocket = targetDocket || docket;
      if (!isOnline || !currentDocket || !isEditableDocketStatus(currentDocket.status)) {
        return currentDocket;
      }
      const currentNotes = currentDocket.notes || '';
      if (currentNotes === notes) {
        return currentDocket;
      }
      const data = await apiFetch<{ docket: Docket }>(buildDocketDetailPath(currentDocket.id), {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      });
      const updatedNotes = data.docket.notes || '';
      setDocket((prev) =>
        prev?.id === currentDocket.id ? { ...prev, notes: updatedNotes } : prev,
      );
      return { ...currentDocket, notes: updatedNotes };
    },
    [docket, isOnline, notes],
  );

  const handleNotesBlur = useCallback(() => {
    if (!docket || !isEditableDocketStatus(docket.status)) return;
    void saveDocketNotes(docket).catch((err) => {
      handleApiError(err, 'Failed to save docket notes');
    });
  }, [docket, saveDocketNotes]);

  // ── Line-item write ops (ensure + POST/DELETE + running-total reducer) ───────
  // These own the money math and optimistic list update; callers own the
  // per-side guards (offline/keepOpen/two-tap confirm), validation toasts, and
  // success UX. Ops set `saving` and throw on failure so callers only run
  // success UX after they resolve.
  const postLabourEntry = useCallback(
    async ({ employeeId, startTime, finishTime, lotId }: PostLabourInput) => {
      setSaving(true);
      try {
        const currentDocket = await ensureDocket();
        const hours = calculateHours(startTime, finishTime);
        const data = await apiFetch<{ labourEntry: LabourEntry; runningTotal: { cost: number } }>(
          buildDocketLabourPath(currentDocket.id),
          {
            method: 'POST',
            body: JSON.stringify({
              employeeId,
              startTime,
              finishTime,
              lotAllocations: [{ lotId, hours }],
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
      } finally {
        setSaving(false);
      }
    },
    [ensureDocket],
  );

  const postPlantEntry = useCallback(
    async ({ plantId, hoursOperated, wetOrDry, lotId }: PostPlantInput) => {
      setSaving(true);
      try {
        const currentDocket = await ensureDocket();
        const data = await apiFetch<{ plantEntry: PlantEntry; runningTotal: { cost: number } }>(
          buildDocketPlantPath(currentDocket.id),
          {
            method: 'POST',
            body: JSON.stringify({
              plantId,
              hoursOperated,
              wetOrDry,
              lotAllocations: lotId ? [{ lotId, hours: hoursOperated }] : undefined,
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
      } finally {
        setSaving(false);
      }
    },
    [ensureDocket],
  );

  const removeLabourEntry = useCallback(
    async (entryId: string) => {
      if (!docket) return;
      const data = await apiFetch<{ runningTotal?: { cost: number } }>(
        buildDocketLabourEntryPath(docket.id, entryId),
        { method: 'DELETE' },
      );
      setDocket((prev) => {
        if (!prev) return prev;
        const removed = prev.labourEntries.find((e) => e.id === entryId);
        const fallbackTotal = Math.max(
          0,
          prev.totalLabourSubmitted - (removed?.submittedCost || 0),
        );
        const newTotal =
          typeof data.runningTotal?.cost === 'number' ? data.runningTotal.cost : fallbackTotal;
        return {
          ...prev,
          labourEntries: prev.labourEntries.filter((e) => e.id !== entryId),
          totalLabourSubmitted: newTotal,
        };
      });
    },
    [docket],
  );

  const removePlantEntry = useCallback(
    async (entryId: string) => {
      if (!docket) return;
      const data = await apiFetch<{ runningTotal?: { cost: number } }>(
        buildDocketPlantEntryPath(docket.id, entryId),
        { method: 'DELETE' },
      );
      setDocket((prev) => {
        if (!prev) return prev;
        const removed = prev.plantEntries.find((e) => e.id === entryId);
        const fallbackTotal = Math.max(0, prev.totalPlantSubmitted - (removed?.submittedCost || 0));
        const newTotal =
          typeof data.runningTotal?.cost === 'number' ? data.runningTotal.cost : fallbackTotal;
        return {
          ...prev,
          plantEntries: prev.plantEntries.filter((e) => e.id !== entryId),
          totalPlantSubmitted: newTotal,
        };
      });
    },
    [docket],
  );

  // ── Status gating (identical in both editors) ────────────────────────────────
  const canEdit = isEditableDocketStatus(docket?.status);
  const canWrite = canEdit && isOnline;
  const canSubmit = Boolean(
    docket &&
    isOnline &&
    (docket.status === 'draft' || docket.status === 'rejected') &&
    ((docket.labourEntries?.length ?? 0) > 0 || (docket.plantEntries?.length ?? 0) > 0),
  );

  return {
    // identity / request context
    isNewDocket,
    today,
    requestedProjectId,
    requestedSubcontractorCompanyId,
    // bootstrap data
    company,
    assignedLots,
    lotsModuleDisabled,
    loading,
    error,
    // editing state
    docket,
    setDocket,
    notes,
    setNotes,
    saving,
    // ops
    ensureDocket,
    saveDocketNotes,
    handleNotesBlur,
    postLabourEntry,
    postPlantEntry,
    removeLabourEntry,
    removePlantEntry,
    // status gating
    isOnline,
    canEdit,
    canWrite,
    canSubmit,
  };
}
