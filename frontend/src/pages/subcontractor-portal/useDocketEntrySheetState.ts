import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Employee, Lot, Plant } from './docketEditData';
import { calculateHours, getPlantHoursError, parseDailyHoursInput } from './docketEditHelpers';

const DEFAULT_START_TIME = '07:00';
const DEFAULT_FINISH_TIME = '15:30';
const DEFAULT_HOURS_OPERATED = '8';
const DEFAULT_WET_OR_DRY = 'dry';

export type DocketEntrySheetType = 'labour' | 'plant';
export type WetOrDry = 'dry' | 'wet';

export function useDocketEntrySheetState(assignedLots: Lot[]) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<DocketEntrySheetType>('labour');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedPlant, setSelectedPlant] = useState<Plant | null>(null);
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [finishTime, setFinishTime] = useState(DEFAULT_FINISH_TIME);
  const [hoursOperated, setHoursOperated] = useState(DEFAULT_HOURS_OPERATED);
  const [wetOrDry, setWetOrDry] = useState<WetOrDry>(DEFAULT_WET_OR_DRY);
  const [selectedLotId, setSelectedLotId] = useState<string>('');

  const defaultSelectedLotId = assignedLots.length === 1 ? assignedLots[0].id : '';

  useEffect(() => {
    if (defaultSelectedLotId) {
      setSelectedLotId(defaultSelectedLotId);
    }
  }, [defaultSelectedLotId]);

  const resetSheetState = useCallback(() => {
    setSelectedEmployee(null);
    setSelectedPlant(null);
    setStartTime(DEFAULT_START_TIME);
    setFinishTime(DEFAULT_FINISH_TIME);
    setHoursOperated(DEFAULT_HOURS_OPERATED);
    setWetOrDry(DEFAULT_WET_OR_DRY);
    setSelectedLotId(defaultSelectedLotId);
  }, [defaultSelectedLotId]);

  const openAddLabour = useCallback(
    (employee?: Employee) => {
      resetSheetState();
      if (employee) setSelectedEmployee(employee);
      setSheetType('labour');
      setSheetOpen(true);
    },
    [resetSheetState],
  );

  const openAddPlant = useCallback(
    (plant?: Plant) => {
      resetSheetState();
      if (plant) setSelectedPlant(plant);
      setSheetType('plant');
      setSheetOpen(true);
    },
    [resetSheetState],
  );

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const plantHoursError = sheetType === 'plant' ? getPlantHoursError(hoursOperated) : null;

  const previewHours = useMemo(
    () =>
      sheetType === 'labour'
        ? calculateHours(startTime, finishTime)
        : parseDailyHoursInput(hoursOperated) || 0,
    [finishTime, hoursOperated, sheetType, startTime],
  );

  const previewCost = useMemo(
    () =>
      sheetType === 'labour'
        ? previewHours * (selectedEmployee?.hourlyRate || 0)
        : previewHours *
          (wetOrDry === 'wet'
            ? selectedPlant?.wetRate || selectedPlant?.dryRate || 0
            : selectedPlant?.dryRate || 0),
    [
      previewHours,
      selectedEmployee?.hourlyRate,
      selectedPlant?.dryRate,
      selectedPlant?.wetRate,
      sheetType,
      wetOrDry,
    ],
  );

  return {
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
  };
}
