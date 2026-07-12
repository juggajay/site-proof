import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/toaster';
import { handleApiError } from '@/lib/errorHandling';
import { buildDocketEditRoute, getDocketDisplayTotalCost } from './docketEditData';
import { buildPortalCompanyScopedPath } from './portalCompanyScope';
import { parseDailyHoursInput, PLANT_HOURS_INPUT_ERROR } from './docketEditHelpers';
import { useDocketEditorController } from './useDocketEditorController';
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

export function DocketEditPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('labour');
  const [queryResponse, setQueryResponse] = useState('');

  // Classic portal route: /subcontractor-portal/docket/:id (see buildDocketEditRoute).
  const buildDocketPath = useCallback(
    (
      docketId: string,
      scope: { projectId?: string | null; subcontractorCompanyId?: string | null },
    ) => buildDocketEditRoute(docketId, scope.projectId, scope.subcontractorCompanyId),
    [],
  );

  const {
    isNewDocket,
    today,
    requestedProjectId,
    requestedSubcontractorCompanyId,
    company,
    assignedLots,
    lotsModuleDisabled,
    loading,
    error,
    docket,
    notes,
    setNotes,
    saving,
    saveDocketNotes,
    handleNotesBlur,
    postLabourEntry,
    postPlantEntry,
    removeLabourEntry,
    removePlantEntry,
    isOnline,
    canEdit,
    canWrite,
    canSubmit,
  } = useDocketEditorController({ buildDocketPath });

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
    labourHoursError,
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

  // Add labour entry
  const addLabourEntry = async () => {
    if (!isOnline) {
      toast({
        title: 'Reconnect to edit docket',
        description: 'Dockets need a connection before adding labour hours.',
        variant: 'warning',
      });
      return;
    }
    if (!selectedEmployee || !selectedLotId) {
      toast({
        title: 'Missing information',
        description: 'Please select an employee and a lot',
        variant: 'error',
      });
      return;
    }
    if (labourHoursError) {
      toast({
        title: 'Invalid time range',
        description: labourHoursError,
        variant: 'warning',
      });
      return;
    }

    try {
      await postLabourEntry({
        employeeId: selectedEmployee.id,
        startTime,
        finishTime,
        lotId: selectedLotId,
      });
      closeSheet();
      resetSheetState();
      toast({ title: 'Labour entry added', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to add labour entry');
    }
  };

  // Add plant entry
  const addPlantEntry = async () => {
    if (!isOnline) {
      toast({
        title: 'Reconnect to edit docket',
        description: 'Dockets need a connection before adding plant hours.',
        variant: 'warning',
      });
      return;
    }
    if (!selectedPlant) {
      toast({
        title: 'Missing information',
        description: 'Please select plant/equipment',
        variant: 'error',
      });
      return;
    }
    if (assignedLots.length > 0 && !selectedLotId) {
      toast({
        title: 'Missing information',
        description: 'Please select a lot',
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

    try {
      await postPlantEntry({
        plantId: selectedPlant.id,
        hoursOperated: parsedHoursOperated,
        wetOrDry,
        lotId: selectedLotId,
      });
      closeSheet();
      resetSheetState();
      toast({ title: 'Plant entry added', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to add plant entry');
    }
  };

  // Delete labour entry
  const deleteLabourEntry = async (entryId: string) => {
    if (!docket) return;
    if (!isOnline) {
      toast({
        title: 'Reconnect to edit docket',
        description: 'Dockets need a connection before deleting entries.',
        variant: 'warning',
      });
      return;
    }
    try {
      await removeLabourEntry(entryId);
      toast({ title: 'Entry deleted', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to delete entry');
    }
  };

  // Delete plant entry
  const deletePlantEntry = async (entryId: string) => {
    if (!docket) return;
    if (!isOnline) {
      toast({
        title: 'Reconnect to edit docket',
        description: 'Dockets need a connection before deleting entries.',
        variant: 'warning',
      });
      return;
    }
    try {
      await removePlantEntry(entryId);
      toast({ title: 'Entry deleted', variant: 'success' });
    } catch (err) {
      handleApiError(err, 'Failed to delete entry');
    }
  };

  const portalPath = company
    ? buildPortalCompanyScopedPath('/subcontractor-portal', {
        projectId: company.projectId,
        subcontractorCompanyId: company.id,
      })
    : buildPortalCompanyScopedPath('/subcontractor-portal', {
        projectId: requestedProjectId,
        subcontractorCompanyId: requestedSubcontractorCompanyId,
      });

  const { submitting, respondingToQuery, submitDocket, respondToQuery } = useDocketSubmitActions({
    docket,
    queryResponse,
    saveDocketNotes,
    navigate,
    redirectTo: portalPath,
  });

  // Get approved employees/plant only
  const approvedEmployees = company?.employees.filter((e) => e.status === 'approved') || [];
  const approvedPlant = company?.plant.filter((p) => p.status === 'approved') || [];
  const myCompanyLink = company
    ? buildPortalCompanyScopedPath('/my-company', {
        projectId: company.projectId,
        subcontractorCompanyId: company.id,
      })
    : buildPortalCompanyScopedPath('/my-company', {
        projectId: requestedProjectId,
        subcontractorCompanyId: requestedSubcontractorCompanyId,
      });

  // Total cost
  const totalCost = docket ? getDocketDisplayTotalCost(docket) : 0;

  if (loading) {
    return <DocketEditLoading />;
  }

  if (error) {
    return <DocketEditError message={error} backTo={portalPath} />;
  }

  return (
    <div className="container max-w-2xl mx-auto p-4 pb-32 md:pb-24">
      <DocketEditHeader
        docket={docket}
        isNewDocket={isNewDocket}
        projectName={company?.projectName}
        today={today}
        backTo={portalPath}
      />

      <DocketEditNotices
        docket={docket}
        queryResponse={queryResponse}
        respondingToQuery={respondingToQuery}
        assignedLotCount={assignedLots.length}
        lotsModuleDisabled={lotsModuleDisabled}
        canEdit={canEdit}
        isOnline={isOnline}
        onQueryResponseChange={setQueryResponse}
        onRespondToQuery={respondToQuery}
      />

      {/* Tabs */}
      <DocketEditTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        docket={docket}
        canEdit={canWrite}
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
          labourHoursError={labourHoursError}
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
