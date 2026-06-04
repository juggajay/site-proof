import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Send, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage, handleApiError } from '@/lib/errorHandling';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { logError } from '@/lib/logger';
import { formatDateKey } from '@/lib/localDate';
import { useAuth } from '@/lib/auth';
import {
  buildDocketEditRoute,
  findTodayDocket,
  useAssignedLotsQuery,
  useDocketEditQuery,
  useExistingDocketsQuery,
  useMyCompanyQuery,
  type Docket,
  type Employee,
  type LabourEntry,
  type Lot,
  type Plant,
  type PlantEntry,
} from './docketEditData';
import { formatCurrency, formatDate } from './docketEditDisplay';
import { DocketEditTabs } from './components/DocketEditTabs';
import { DocketEntrySheet } from './components/DocketEntrySheet';

function calculateHours(startTime: string, finishTime: string): number {
  if (!startTime || !finishTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [finishH, finishM] = finishTime.split(':').map(Number);
  let hours = finishH + finishM / 60 - (startH + startM / 60);
  if (hours < 0) hours += 24; // Handle overnight
  return Math.round(hours * 10) / 10; // Round to 1 decimal
}

const DAILY_HOURS_PATTERN = /^\d+(?:\.\d+)?$/;
const PLANT_HOURS_INPUT_ERROR = 'Hours operated must be greater than 0 and 24 or less.';

function parseDailyHoursInput(value: string): number | null {
  const normalized = value.trim();
  if (!normalized || !DAILY_HOURS_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 24 ? parsed : null;
}

function getPlantHoursError(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return 'Hours operated is required.';
  }
  if (normalized.startsWith('-')) {
    return 'Hours operated cannot be negative.';
  }
  return parseDailyHoursInput(value) === null ? PLANT_HOURS_INPUT_ERROR : null;
}

function isEditableDocketStatus(status?: string) {
  return !status || status === 'draft' || status === 'queried' || status === 'rejected';
}

// Stable empty reference so an empty lot list keeps the same identity per render.
const EMPTY_LOTS: Lot[] = [];

export function DocketEditPage() {
  const navigate = useNavigate();
  const { docketId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const userId = user?.id;
  const requestedProjectId = searchParams.get('projectId');
  const isNewDocket = !docketId || docketId === 'new';

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [docket, setDocket] = useState<Docket | null>(null);
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState('labour');

  // Query response state
  const [queryResponse, setQueryResponse] = useState('');
  const [respondingToQuery, setRespondingToQuery] = useState(false);

  // Entry sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<'labour' | 'plant'>('labour');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [startTime, setStartTime] = useState('07:00');
  const [finishTime, setFinishTime] = useState('15:30');
  const [hoursOperated, setHoursOperated] = useState('8');
  const [wetOrDry, setWetOrDry] = useState<'dry' | 'wet'>('dry');
  const [selectedLotId, setSelectedLotId] = useState<string>('');

  const today = formatDateKey();

  // Bootstrap reads are served from TanStack Query: the subbie's company, their
  // assigned lots, and either the docket being edited or (for a new docket) the
  // "does one already exist for today?" check.
  const companyQuery = useMyCompanyQuery(userId, requestedProjectId);
  const company = companyQuery.data ?? null;

  const lotsQuery = useAssignedLotsQuery(userId, company?.projectId);
  const assignedLots = lotsQuery.data ?? EMPTY_LOTS;

  const docketQuery = useDocketEditQuery(userId, docketId, !isNewDocket);
  const existingDocketsQuery = useExistingDocketsQuery(userId, company?.projectId, isNewDocket);

  const todayDocket =
    isNewDocket && existingDocketsQuery.data
      ? findTodayDocket(existingDocketsQuery.data, today)
      : undefined;

  // Seed the local editing buffer from the loaded docket. This re-runs when
  // docketId changes (e.g. after a new docket is created and the URL gains its
  // id), mirroring the original effect's dependency on docketId.
  useEffect(() => {
    if (docketQuery.data) {
      setDocket(docketQuery.data);
      setNotes(docketQuery.data.notes || '');
    }
  }, [docketQuery.data]);

  // Auto-select the lot when the subbie is assigned exactly one.
  useEffect(() => {
    if (lotsQuery.data && lotsQuery.data.length === 1) {
      setSelectedLotId(lotsQuery.data[0].id);
    }
  }, [lotsQuery.data]);

  // A docket already exists for today: send the subbie to it instead of a new one.
  useEffect(() => {
    if (todayDocket) {
      navigate(buildDocketEditRoute(todayDocket.id, company?.projectId), { replace: true });
    }
  }, [todayDocket, company?.projectId, navigate]);

  // Keep the spinner up until the company, lots, and the docket/existing-docket
  // read have all settled — and while a redirect to today's docket is pending.
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

  // Create docket if new
  const ensureDocket = useCallback(async () => {
    if (docket) return docket;

    try {
      const data = await apiFetch<{ docket: Docket }>(`/api/dockets`, {
        method: 'POST',
        body: JSON.stringify({
          projectId: company?.projectId,
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
      setDocket(newDocket);
      // Update URL to show docket ID
      const projectQuery = company?.projectId
        ? `?projectId=${encodeURIComponent(company.projectId)}`
        : '';
      navigate(`/subcontractor-portal/docket/${newDocket.id}${projectQuery}`, { replace: true });
      return newDocket;
    } catch (err) {
      logError('Error creating docket:', err);
      throw err;
    }
  }, [docket, company, today, notes, navigate]);

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

      const updatedDocket = {
        ...currentDocket,
        notes: data.docket.notes || '',
      };

      setDocket((prev) =>
        prev?.id === currentDocket.id ? { ...prev, notes: updatedDocket.notes } : prev,
      );
      return updatedDocket;
    },
    [docket, notes],
  );

  const handleNotesBlur = () => {
    if (!docket || !isEditableDocketStatus(docket.status)) return;
    void saveDocketNotes(docket).catch((err) => {
      handleApiError(err, 'Failed to save docket notes');
    });
  };

  // Add labour entry
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

      // Update local state
      setDocket((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          labourEntries: [...prev.labourEntries, data.labourEntry],
          totalLabourSubmitted: data.runningTotal.cost,
        };
      });

      setSheetOpen(false);
      resetSheetState();
      toast({ title: 'Labour entry added', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to add labour entry');
    } finally {
      setSaving(false);
    }
  };

  // Add plant entry
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

      // Update local state
      setDocket((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          plantEntries: [...prev.plantEntries, data.plantEntry],
          totalPlantSubmitted: data.runningTotal.cost,
        };
      });

      setSheetOpen(false);
      resetSheetState();
      toast({ title: 'Plant entry added', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to add plant entry');
    } finally {
      setSaving(false);
    }
  };

  // Delete labour entry
  const deleteLabourEntry = async (entryId: string) => {
    if (!docket) return;

    try {
      await apiFetch(`/api/dockets/${docket.id}/labour/${entryId}`, {
        method: 'DELETE',
      });

      // Update local state
      setDocket((prev) => {
        if (!prev) return prev;
        const removed = prev.labourEntries.find((e) => e.id === entryId);
        const newTotal = prev.totalLabourSubmitted - (removed?.submittedCost || 0);
        return {
          ...prev,
          labourEntries: prev.labourEntries.filter((e) => e.id !== entryId),
          totalLabourSubmitted: newTotal,
        };
      });

      toast({ title: 'Entry deleted', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to delete entry');
    }
  };

  // Delete plant entry
  const deletePlantEntry = async (entryId: string) => {
    if (!docket) return;

    try {
      await apiFetch(`/api/dockets/${docket.id}/plant/${entryId}`, {
        method: 'DELETE',
      });

      // Update local state
      setDocket((prev) => {
        if (!prev) return prev;
        const removed = prev.plantEntries.find((e) => e.id === entryId);
        const newTotal = prev.totalPlantSubmitted - (removed?.submittedCost || 0);
        return {
          ...prev,
          plantEntries: prev.plantEntries.filter((e) => e.id !== entryId),
          totalPlantSubmitted: newTotal,
        };
      });

      toast({ title: 'Entry deleted', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to delete entry');
    }
  };

  // Submit docket
  const submitDocket = async () => {
    if (!docket) return;

    // Validation
    if (docket.labourEntries.length === 0 && docket.plantEntries.length === 0) {
      toast({
        title: 'Cannot submit',
        description: 'Add at least one labour or plant entry',
        variant: 'error',
      });
      return;
    }

    setSubmitting(true);
    try {
      await saveDocketNotes(docket);
      await apiFetch(`/api/dockets/${docket.id}/submit`, {
        method: 'POST',
      });

      toast({
        title: 'Docket submitted',
        description: 'Your docket has been sent for approval',
        variant: 'success',
      });

      navigate('/subcontractor-portal');
    } catch (err) {
      handleApiError(err, 'Failed to submit docket');
    } finally {
      setSubmitting(false);
    }
  };

  // Respond to a query
  const respondToQuery = async () => {
    if (!docket || !queryResponse.trim()) return;

    setRespondingToQuery(true);
    try {
      await saveDocketNotes(docket);
      await apiFetch(`/api/dockets/${docket.id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ response: queryResponse.trim() }),
      });

      toast({
        title: 'Response sent',
        description: 'Your docket has been resubmitted for approval',
        variant: 'success',
      });

      navigate('/subcontractor-portal');
    } catch (err) {
      handleApiError(err, 'Failed to respond to query');
    } finally {
      setRespondingToQuery(false);
    }
  };

  const resetSheetState = () => {
    setSelectedEmployee(null);
    setSelectedPlant(null);
    setStartTime('07:00');
    setFinishTime('15:30');
    setHoursOperated('8');
    setWetOrDry('dry');
    setSelectedLotId(assignedLots.length === 1 ? assignedLots[0].id : '');
  };

  const openAddLabour = (emp?: Employee) => {
    resetSheetState();
    if (emp) setSelectedEmployee(emp);
    setSheetType('labour');
    setSheetOpen(true);
  };

  const openAddPlant = (plant?: Plant) => {
    resetSheetState();
    if (plant) setSelectedPlant(plant);
    setSheetType('plant');
    setSheetOpen(true);
  };

  // Get approved employees/plant only
  const approvedEmployees = company?.employees.filter((e) => e.status === 'approved') || [];
  const approvedPlant = company?.plant.filter((p) => p.status === 'approved') || [];
  const myCompanyLink = company?.projectId
    ? `/my-company?projectId=${encodeURIComponent(company.projectId)}`
    : '/my-company';
  const plantHoursError = sheetType === 'plant' ? getPlantHoursError(hoursOperated) : null;

  // Calculate sheet preview
  const previewHours =
    sheetType === 'labour'
      ? calculateHours(startTime, finishTime)
      : parseDailyHoursInput(hoursOperated) || 0;

  const previewCost =
    sheetType === 'labour'
      ? previewHours * (selectedEmployee?.hourlyRate || 0)
      : previewHours *
        (wetOrDry === 'wet'
          ? selectedPlant?.wetRate || selectedPlant?.dryRate || 0
          : selectedPlant?.dryRate || 0);

  // Total cost
  const totalCost = (docket?.totalLabourSubmitted || 0) + (docket?.totalPlantSubmitted || 0);

  const canEdit = isEditableDocketStatus(docket?.status);
  const canSubmit =
    docket &&
    (docket.status === 'draft' || docket.status === 'rejected') &&
    (docket.labourEntries.length > 0 || docket.plantEntries.length > 0);

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto p-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-2xl mx-auto p-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
        <Link
          to="/subcontractor-portal"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-32 md:pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/subcontractor-portal"
          className="p-2 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            {isNewDocket ? "Today's Docket" : `Docket ${docket?.docketNumber || ''}`}
          </h1>
          <p className="text-sm text-muted-foreground">{formatDate(docket?.date || today)}</p>
          {company?.projectName && (
            <p className="text-xs text-muted-foreground">Project: {company.projectName}</p>
          )}
        </div>
        {docket && (
          <span
            className={cn(
              'ml-auto px-2.5 py-1 text-xs font-medium rounded-full',
              docket.status === 'approved' &&
                'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
              docket.status === 'pending_approval' &&
                'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
              docket.status === 'queried' &&
                'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
              docket.status === 'rejected' &&
                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
              docket.status === 'draft' && 'bg-muted text-foreground',
            )}
          >
            {docket.status === 'draft'
              ? 'Draft'
              : docket.status === 'pending_approval'
                ? 'Pending'
                : docket.status === 'queried'
                  ? 'Queried'
                  : docket.status === 'rejected'
                    ? 'Rejected'
                    : docket.status === 'approved'
                      ? 'Approved'
                      : docket.status}
          </span>
        )}
      </div>

      {/* Query notice with response input */}
      {docket?.status === 'queried' && (
        <div className="mb-4 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-amber-800 dark:text-amber-200">
              <strong>Query from foreman:</strong>{' '}
              {docket.foremanNotes || 'Please review this docket'}
            </div>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <Textarea
              value={queryResponse}
              onChange={(e) => setQueryResponse(e.target.value)}
              placeholder="Type your response to the query..."
              rows={3}
              className="border-amber-300 dark:border-amber-700 focus-visible:ring-amber-500"
            />
            <Button
              onClick={respondToQuery}
              disabled={!queryResponse.trim() || respondingToQuery}
              className={cn(
                'w-full',
                queryResponse.trim() && !respondingToQuery
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : '',
              )}
            >
              {respondingToQuery ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Respond &amp; Resubmit
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Rejection notice with resubmit option */}
      {docket?.status === 'rejected' && (
        <div className="flex items-start gap-3 p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-red-800 dark:text-red-200">
            <strong>Rejection reason:</strong> {docket.foremanNotes || 'No reason provided'}
            <p className="text-sm mt-2 text-red-700 dark:text-red-300">
              You can edit the entries below and resubmit using the button at the bottom.
            </p>
          </div>
        </div>
      )}

      {/* No lots warning */}
      {assignedLots.length === 0 && (
        <div className="flex items-start gap-3 p-4 mb-4 bg-primary/5 border border-primary/30 rounded-lg">
          <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <p className="text-primary">
            No lots have been assigned to you yet. Contact your project manager to get lot
            assignments.
          </p>
        </div>
      )}

      {/* Tabs */}
      <DocketEditTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        docket={docket}
        canEdit={canEdit}
        approvedEmployees={approvedEmployees}
        approvedPlant={approvedPlant}
        myCompanyLink={myCompanyLink}
        today={today}
        totalCost={totalCost}
        notes={notes}
        onNotesChange={setNotes}
        onNotesBlur={handleNotesBlur}
        onAddLabour={openAddLabour}
        onAddPlant={openAddPlant}
        onDeleteLabour={deleteLabourEntry}
        onDeletePlant={deletePlantEntry}
      />

      {/* Bottom Action Bar - bottom-16 on mobile to sit above MobileNav (h-16, z-30) */}
      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 z-40 p-4 bg-background border-t border-border md:relative md:border-0 md:bg-transparent md:p-0 md:mt-6 md:z-auto">
        <div className="container max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
          </div>
          {canEdit && (
            <Button
              onClick={submitDocket}
              disabled={!canSubmit || submitting}
              className={cn(
                'px-6 py-3 h-auto',
                canSubmit && !submitting ? 'bg-primary hover:bg-primary/90 text-white' : '',
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {docket?.status === 'rejected' ? 'Resubmit for Approval' : 'Submit for Approval'}
                </>
              )}
            </Button>
          )}
          {!canEdit && docket?.status === 'pending_approval' && (
            <span className="px-4 py-2 text-base bg-muted text-muted-foreground rounded-lg">
              Awaiting Approval
            </span>
          )}
          {!canEdit && docket?.status === 'approved' && (
            <span className="px-4 py-2 text-base bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 rounded-lg">
              Approved
            </span>
          )}
        </div>
      </div>

      {/* Entry Sheet (Bottom Sheet) */}
      {sheetOpen && (
        <DocketEntrySheet
          sheetType={sheetType}
          selectedEmployee={selectedEmployee}
          selectedPlant={selectedPlant}
          startTime={startTime}
          finishTime={finishTime}
          hoursOperated={hoursOperated}
          wetOrDry={wetOrDry}
          selectedLotId={selectedLotId}
          assignedLots={assignedLots}
          plantHoursError={plantHoursError}
          previewHours={previewHours}
          previewCost={previewCost}
          saving={saving}
          onStartTimeChange={setStartTime}
          onFinishTimeChange={setFinishTime}
          onHoursOperatedChange={setHoursOperated}
          onWetOrDryChange={setWetOrDry}
          onSelectedLotIdChange={setSelectedLotId}
          onClose={() => setSheetOpen(false)}
          onAddLabourEntry={addLabourEntry}
          onAddPlantEntry={addPlantEntry}
        />
      )}

      {/* Animation styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
