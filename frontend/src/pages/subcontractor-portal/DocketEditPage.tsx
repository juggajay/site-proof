import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { toast } from '@/components/ui/toaster';
import { extractErrorMessage, handleApiError, isForbidden } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import { formatDateKey } from '@/lib/localDate';
import { useAuth } from '@/lib/auth';
import {
  buildDocketEditRoute,
  findTodayDocket,
  getDocketDisplayTotalCost,
  useAssignedLotsQuery,
  useDocketEditQuery,
  useExistingDocketsQuery,
  useMyCompanyQuery,
  type Docket,
  type LabourEntry,
  type Lot,
  type PlantEntry,
} from './docketEditData';
import {
  calculateHours,
  isEditableDocketStatus,
  parseDailyHoursInput,
  PLANT_HOURS_INPUT_ERROR,
} from './docketEditHelpers';
import { useDocketEntrySheetState } from './useDocketEntrySheetState';
import { DocketEditTabs } from './components/DocketEditTabs';
import { DocketEntrySheet } from './components/DocketEntrySheet';
import { useDocketSubmitActions } from './useDocketSubmitActions';
import {
  DocketEditActionBar,
  DocketEditError,
  DocketEditHeader,
  DocketEditLoading,
  DocketEditNotices,
} from './components/DocketEditPagePanels';

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

  const [docket, setDocket] = useState<Docket | null>(null);
  const [notes, setNotes] = useState('');
  const [activeTab, setActiveTab] = useState('labour');

  // Query response state
  const [queryResponse, setQueryResponse] = useState('');

  const today = formatDateKey();

  // Bootstrap reads are served from TanStack Query: the subbie's company, their
  // assigned lots, and either the docket being edited or (for a new docket) the
  // "does one already exist for today?" check.
  const companyQuery = useMyCompanyQuery(userId, requestedProjectId);
  const company = companyQuery.data ?? null;

  const lotsQuery = useAssignedLotsQuery(userId, company?.projectId);
  const assignedLots = lotsQuery.data ?? EMPTY_LOTS;
  // The lot list 403s when the HC has turned off the subbie's "Assigned Work"
  // (lots) portal module. Labour lines require a lot, so surface a plain-language
  // notice instead of an inexplicably empty lot dropdown.
  const lotsModuleDisabled = isForbidden(lotsQuery.error);
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
    resetSheetState,
    openAddLabour,
    openAddPlant,
    closeSheet,
  } = useDocketEntrySheetState(assignedLots);

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

      closeSheet();
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

      closeSheet();
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

  const { submitting, respondingToQuery, submitDocket, respondToQuery } = useDocketSubmitActions({
    docket,
    queryResponse,
    saveDocketNotes,
    navigate,
  });

  // Get approved employees/plant only
  const approvedEmployees = company?.employees.filter((e) => e.status === 'approved') || [];
  const approvedPlant = company?.plant.filter((p) => p.status === 'approved') || [];
  const myCompanyLink = company?.projectId
    ? `/my-company?projectId=${encodeURIComponent(company.projectId)}`
    : '/my-company';

  // Total cost
  const totalCost = docket ? getDocketDisplayTotalCost(docket) : 0;

  const canEdit = isEditableDocketStatus(docket?.status);
  const canSubmit = Boolean(
    docket &&
    (docket.status === 'draft' || docket.status === 'rejected') &&
    (docket.labourEntries.length > 0 || docket.plantEntries.length > 0),
  );

  if (loading) {
    return <DocketEditLoading />;
  }

  if (error) {
    return <DocketEditError message={error} />;
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-32 md:pb-24">
      <DocketEditHeader
        docket={docket}
        isNewDocket={isNewDocket}
        projectName={company?.projectName}
        today={today}
      />

      <DocketEditNotices
        docket={docket}
        queryResponse={queryResponse}
        respondingToQuery={respondingToQuery}
        assignedLotCount={assignedLots.length}
        lotsModuleDisabled={lotsModuleDisabled}
        onQueryResponseChange={setQueryResponse}
        onRespondToQuery={respondToQuery}
      />

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

      <DocketEditActionBar
        canEdit={canEdit}
        canSubmit={canSubmit}
        docketStatus={docket?.status}
        submitting={submitting}
        totalCost={totalCost}
        onSubmit={submitDocket}
      />

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
          onClose={closeSheet}
          onAddLabourEntry={addLabourEntry}
          onAddPlantEntry={addPlantEntry}
        />
      )}
    </div>
  );
}
