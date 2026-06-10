import { AddActivitySheet } from '@/components/foreman/sheets/AddActivitySheet';
import { AddDelaySheet } from '@/components/foreman/sheets/AddDelaySheet';
import { AddDeliverySheet } from '@/components/foreman/sheets/AddDeliverySheet';
import { AddEventSheet } from '@/components/foreman/sheets/AddEventSheet';
import { AddManualLabourPlantSheet } from '@/components/foreman/sheets/AddManualLabourPlantSheet';
import { AddWeatherSheet } from '@/components/foreman/sheets/AddWeatherSheet';
import { sheetDraftKey, type SheetDraftType } from '@/components/foreman/sheets/useSheetDraft';
import type { QuickAddType } from '@/components/foreman/DiaryQuickAddBar';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';
import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';
import type { Lot, DailyDiary, WeatherFormState } from '../types';

interface ManualPersonnelData {
  name: string;
  company?: string;
  role?: string;
  hours?: number;
  lotId?: string;
}

interface ManualPlantData {
  description: string;
  idRego?: string;
  company?: string;
  hoursOperated?: number;
  lotId?: string;
}

interface DiaryMobileSheetsProps {
  activeSheet: QuickAddType | 'weather' | null;
  onCloseSheet: () => void;
  projectId: string | undefined;
  selectedDate: string;
  editingEntry: TimelineEntry | null;
  setEditingEntry: (entry: TimelineEntry | null) => void;
  activeLotId: string | null;
  lots: Lot[];
  diary: DailyDiary | null;
  weatherForm: WeatherFormState;
  onAddActivity: (data: {
    description: string;
    lotId?: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  }) => Promise<void>;
  onAddDelay: (data: {
    delayType: string;
    description: string;
    durationHours?: number;
    impact?: string;
    lotId?: string;
  }) => Promise<void>;
  onAddDelivery: (data: {
    description: string;
    supplier?: string;
    docketNumber?: string;
    quantity?: number;
    unit?: string;
    lotId?: string;
    notes?: string;
  }) => Promise<void>;
  onAddEvent: (data: {
    eventType: string;
    description: string;
    notes?: string;
    lotId?: string;
  }) => Promise<void>;
  onSavePersonnel: (data: ManualPersonnelData) => Promise<void>;
  onSavePlant: (data: ManualPlantData) => Promise<void>;
  onSaveWeather: (data: {
    conditions: string;
    temperatureMin: string;
    temperatureMax: string;
    rainfallMm: string;
  }) => Promise<void>;
}

const toOptionalNumber = (value: number | string | undefined) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    return parseOptionalNonNegativeDecimalInput(value) ?? undefined;
  }
  return undefined;
};

export function DiaryMobileSheets({
  activeSheet,
  onCloseSheet,
  projectId,
  selectedDate,
  editingEntry,
  setEditingEntry,
  activeLotId,
  lots,
  diary,
  weatherForm,
  onAddActivity,
  onAddDelay,
  onAddDelivery,
  onAddEvent,
  onSavePersonnel,
  onSavePlant,
  onSaveWeather,
}: DiaryMobileSheetsProps) {
  // Auto-draft scope: project + diary date + sheet type. Editing an existing
  // timeline entry never drafts — only fresh entries can be interrupted and
  // restored.
  const draftKeyFor = (sheetType: SheetDraftType) =>
    projectId && !editingEntry ? sheetDraftKey(projectId, selectedDate, sheetType) : undefined;

  return (
    <>
      {activeSheet === 'activity' && (
        <AddActivitySheet
          isOpen
          onClose={onCloseSheet}
          onSave={async (data) => {
            await onAddActivity({ ...data, lotId: data.lotId || activeLotId || undefined });
            if (editingEntry) setEditingEntry(null);
          }}
          defaultLotId={activeLotId}
          lots={lots}
          draftKey={draftKeyFor('activity')}
          initialData={
            editingEntry?.type === 'activity'
              ? {
                  description: editingEntry.description,
                  quantity: toOptionalNumber(editingEntry.data?.quantity),
                  unit: editingEntry.data?.unit,
                  notes: editingEntry.data?.notes,
                  lotId: editingEntry.data?.lotId,
                }
              : undefined
          }
        />
      )}
      {activeSheet === 'delay' && (
        <AddDelaySheet
          isOpen
          onClose={onCloseSheet}
          onSave={async (data) => {
            await onAddDelay({ ...data, lotId: data.lotId || activeLotId || undefined });
            if (editingEntry) setEditingEntry(null);
          }}
          defaultLotId={activeLotId}
          lots={lots}
          draftKey={draftKeyFor('delay')}
          initialData={
            editingEntry?.type === 'delay'
              ? {
                  delayType: editingEntry.data?.delayType,
                  description: editingEntry.description,
                  durationHours: toOptionalNumber(editingEntry.data?.durationHours),
                  impact: editingEntry.data?.impact,
                  lotId: editingEntry.data?.lotId,
                }
              : undefined
          }
        />
      )}
      {activeSheet === 'delivery' && (
        <AddDeliverySheet
          isOpen
          onClose={onCloseSheet}
          onSave={async (data) => {
            await onAddDelivery({ ...data, lotId: data.lotId || activeLotId || undefined });
            if (editingEntry) setEditingEntry(null);
          }}
          defaultLotId={activeLotId}
          lots={lots}
          draftKey={draftKeyFor('delivery')}
          initialData={
            editingEntry?.type === 'delivery'
              ? {
                  description: editingEntry.description,
                  supplier: editingEntry.data?.supplier,
                  docketNumber: editingEntry.data?.docketNumber,
                  quantity: toOptionalNumber(editingEntry.data?.quantity),
                  unit: editingEntry.data?.unit,
                  lotId: editingEntry.data?.lotId,
                  notes: editingEntry.data?.notes,
                }
              : undefined
          }
        />
      )}
      {activeSheet === 'event' && (
        <AddEventSheet
          isOpen
          onClose={onCloseSheet}
          onSave={async (data) => {
            await onAddEvent({ ...data, lotId: data.lotId || activeLotId || undefined });
            if (editingEntry) setEditingEntry(null);
          }}
          defaultLotId={activeLotId}
          lots={lots}
          draftKey={draftKeyFor('event')}
          initialData={
            editingEntry?.type === 'event'
              ? {
                  eventType: editingEntry.data?.eventType,
                  description: editingEntry.description,
                  notes: editingEntry.data?.notes,
                  lotId: editingEntry.data?.lotId,
                }
              : undefined
          }
        />
      )}
      {activeSheet === 'manual' && (
        <AddManualLabourPlantSheet
          isOpen
          onClose={onCloseSheet}
          onSavePersonnel={onSavePersonnel}
          onSavePlant={onSavePlant}
          defaultLotId={activeLotId}
          lots={lots}
          draftKey={draftKeyFor('manual')}
          initialPersonnelData={
            editingEntry?.type === 'personnel'
              ? {
                  name: editingEntry.description,
                  company: editingEntry.data?.company,
                  role: editingEntry.data?.role,
                  hours: toOptionalNumber(editingEntry.data?.hours),
                  lotId: editingEntry.data?.lotId,
                }
              : undefined
          }
          initialPlantData={
            editingEntry?.type === 'plant'
              ? {
                  description: editingEntry.description,
                  idRego: editingEntry.data?.idRego,
                  company: editingEntry.data?.company,
                  hoursOperated: toOptionalNumber(editingEntry.data?.hoursOperated),
                  lotId: editingEntry.data?.lotId,
                }
              : undefined
          }
        />
      )}
      {activeSheet === 'weather' && (
        <AddWeatherSheet
          isOpen
          onClose={onCloseSheet}
          onSave={onSaveWeather}
          draftKey={draftKeyFor('weather')}
          initialData={
            diary
              ? {
                  conditions: diary.weatherConditions || '',
                  temperatureMin: diary.temperatureMin?.toString() || '',
                  temperatureMax: diary.temperatureMax?.toString() || '',
                  rainfallMm: diary.rainfallMm?.toString() || '',
                }
              : weatherForm.weatherConditions
                ? {
                    conditions: weatherForm.weatherConditions,
                    temperatureMin: weatherForm.temperatureMin,
                    temperatureMax: weatherForm.temperatureMax,
                    rainfallMm: weatherForm.rainfallMm,
                  }
                : null
          }
        />
      )}
    </>
  );
}
