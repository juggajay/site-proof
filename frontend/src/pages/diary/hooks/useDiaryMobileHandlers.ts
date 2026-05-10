import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import type { QuickAddType } from '@/components/foreman/DiaryQuickAddBar';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';
import type { ManualEntries } from '@/components/foreman/DiaryDocketSummary';
import {
  getDiaryWeatherNumberError,
  parseOptionalDiaryRainfallInput,
  parseOptionalDiaryTemperatureInput,
} from '../diaryNumericInput';
import type { DailyDiary, WeatherFormState } from '../types';

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

interface UseDiaryMobileHandlersParams {
  projectId: string | undefined;
  selectedDate: string;
  diary: DailyDiary | null;
  timeline: TimelineEntry[];
  ensureDiaryExists: () => Promise<DailyDiary | null>;
  fetchTimeline: (diaryId?: string) => Promise<void>;
  fetchDiaryForDate: (date: string) => Promise<void>;
  fetchDocketSummary: () => Promise<void>;
  setDiary: (diary: DailyDiary | null) => void;
  setWeatherForm: React.Dispatch<React.SetStateAction<WeatherFormState>>;
}

export function useDiaryMobileHandlers({
  projectId,
  selectedDate,
  diary,
  timeline,
  ensureDiaryExists,
  fetchTimeline,
  fetchDiaryForDate,
  fetchDocketSummary,
  setDiary,
  setWeatherForm,
}: UseDiaryMobileHandlersParams) {
  const navigate = useNavigate();
  const [activeLotId, setActiveLotId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<QuickAddType | 'weather' | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);

  // Derive manual entries from timeline
  const manualEntries: ManualEntries = {
    personnel: timeline
      .filter((entry) => entry.type === 'personnel')
      .map((entry) => ({ id: entry.id, name: entry.description, hours: entry.data?.hours })),
    plant: timeline
      .filter((entry) => entry.type === 'plant')
      .map((entry) => ({
        id: entry.id,
        description: entry.description,
        hoursOperated: entry.data?.hoursOperated,
      })),
  };

  const handleDeleteEntry = async (entry: { id: string; type: string }) => {
    if (!diary) return;
    const typeToEndpoint: Record<string, string> = {
      activity: 'activities',
      delay: 'delays',
      delivery: 'deliveries',
      event: 'events',
      personnel: 'personnel',
      plant: 'plant',
    };
    const endpoint = typeToEndpoint[entry.type];
    if (!endpoint) return;
    try {
      await apiFetch(
        `/api/diary/${encodeURIComponent(diary.id)}/${endpoint}/${encodeURIComponent(entry.id)}`,
        { method: 'DELETE' },
      );
      await fetchTimeline(diary.id);
      await fetchDiaryForDate(selectedDate);
    } catch {
      /* ignore */
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchDiaryForDate(selectedDate), fetchDocketSummary()]);
  };

  const addActivityFromSheet = async (data: {
    description: string;
    lotId?: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  }) => {
    let currentDiary = diary;
    if (!currentDiary) {
      currentDiary = await ensureDiaryExists();
      if (!currentDiary) return;
    }
    await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/activities`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await fetchTimeline(currentDiary.id);
    await fetchDiaryForDate(selectedDate);
  };

  const addDelayFromSheet = async (data: {
    delayType: string;
    description: string;
    durationHours?: number;
    impact?: string;
    lotId?: string;
  }) => {
    let currentDiary = diary;
    if (!currentDiary) {
      currentDiary = await ensureDiaryExists();
      if (!currentDiary) return;
    }
    await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/delays`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await fetchTimeline(currentDiary.id);
    await fetchDiaryForDate(selectedDate);
  };

  const addDeliveryFromSheet = async (data: {
    description: string;
    supplier?: string;
    docketNumber?: string;
    quantity?: number;
    unit?: string;
    lotId?: string;
    notes?: string;
  }) => {
    let currentDiary = diary;
    if (!currentDiary) {
      currentDiary = await ensureDiaryExists();
      if (!currentDiary) return;
    }
    await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/deliveries`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await fetchTimeline(currentDiary.id);
    await fetchDiaryForDate(selectedDate);
  };

  const addEventFromSheet = async (data: {
    eventType: string;
    description: string;
    notes?: string;
    lotId?: string;
  }) => {
    let currentDiary = diary;
    if (!currentDiary) {
      currentDiary = await ensureDiaryExists();
      if (!currentDiary) return;
    }
    await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/events`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    await fetchTimeline(currentDiary.id);
    await fetchDiaryForDate(selectedDate);
  };

  const handleEditEntry = (entry: TimelineEntry) => {
    setEditingEntry(entry);
    setActiveSheet(entry.type === 'personnel' || entry.type === 'plant' ? 'manual' : entry.type);
  };

  const handleTapPending = (_docketId: string) => {
    if (!projectId) return;
    navigate(`/projects/${encodeURIComponent(projectId)}/dockets?status=pending_approval`);
  };

  const handleSavePersonnel = async (data: ManualPersonnelData) => {
    if (editingEntry?.type === 'personnel') {
      await handleDeleteEntry(editingEntry);
      setEditingEntry(null);
    }
    let currentDiary = diary;
    if (!currentDiary) {
      currentDiary = await ensureDiaryExists();
      if (!currentDiary) return;
    }
    await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/personnel`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        source: 'manual',
        lotId: data.lotId || activeLotId || undefined,
      }),
    });
    await fetchTimeline(currentDiary.id);
    await fetchDiaryForDate(selectedDate);
  };

  const handleSavePlant = async (data: ManualPlantData) => {
    if (editingEntry?.type === 'plant') {
      await handleDeleteEntry(editingEntry);
      setEditingEntry(null);
    }
    let currentDiary = diary;
    if (!currentDiary) {
      currentDiary = await ensureDiaryExists();
      if (!currentDiary) return;
    }
    await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/plant`, {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        source: 'manual',
        lotId: data.lotId || activeLotId || undefined,
      }),
    });
    await fetchTimeline(currentDiary.id);
    await fetchDiaryForDate(selectedDate);
  };

  const handleSaveWeather = async (data: {
    conditions: string;
    temperatureMin: string;
    temperatureMax: string;
    rainfallMm: string;
  }) => {
    if (getDiaryWeatherNumberError(data)) return;

    const currentDiary = await ensureDiaryExists();
    if (!currentDiary) return;
    try {
      const temperatureMin = parseOptionalDiaryTemperatureInput(data.temperatureMin);
      const temperatureMax = parseOptionalDiaryTemperatureInput(data.temperatureMax);
      const rainfallMm = parseOptionalDiaryRainfallInput(data.rainfallMm);

      const updated = await apiFetch<DailyDiary>('/api/diary', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          date: selectedDate,
          weatherConditions: data.conditions || undefined,
          temperatureMin: temperatureMin ?? undefined,
          temperatureMax: temperatureMax ?? undefined,
          rainfallMm: rainfallMm ?? undefined,
        }),
      });
      setDiary(updated);
      setWeatherForm(() => ({
        weatherConditions: updated.weatherConditions || '',
        temperatureMin: updated.temperatureMin?.toString() || '',
        temperatureMax: updated.temperatureMax?.toString() || '',
        rainfallMm: updated.rainfallMm?.toString() || '',
        weatherNotes: updated.weatherNotes || '',
        generalNotes: updated.generalNotes || '',
      }));
    } catch {
      // ignore weather save errors
    }
  };

  return {
    activeLotId,
    setActiveLotId,
    activeSheet,
    setActiveSheet,
    editingEntry,
    setEditingEntry,
    manualEntries,
    handleRefresh,
    handleDeleteEntry,
    addActivityFromSheet,
    addDelayFromSheet,
    addDeliveryFromSheet,
    addEventFromSheet,
    handleEditEntry,
    handleTapPending,
    handleSavePersonnel,
    handleSavePlant,
    handleSaveWeather,
  };
}
