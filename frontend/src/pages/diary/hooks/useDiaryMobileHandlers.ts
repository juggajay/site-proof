import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, isRetriableNetworkFailure } from '@/lib/api';
import { useLotAtMyLocation } from '@/hooks/useLotAtMyLocation';
import { toast } from '@/components/ui/toaster';
import {
  queueDiaryActivityOffline,
  queueDiaryDelayOffline,
  queueDiaryDeliveryOffline,
  queueDiaryEventOffline,
  queueDiaryPlantOffline,
  queueDiaryWeatherOffline,
} from '@/lib/offlineDb';
import type { QuickAddType } from '@/components/foreman/DiaryQuickAddBar';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';
import type { ManualEntries } from '@/components/foreman/DiaryDocketSummary';
import {
  getDiaryWeatherNumberError,
  parseOptionalDiaryRainfallInput,
  parseOptionalDiaryTemperatureInput,
} from '../diaryNumericInput';
import type { DailyDiary, WeatherFormState } from '../types';
import { useCopyFromYesterday } from './useCopyFromYesterday';

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
  setError: (error: string | null) => void;
  setWeatherForm: React.Dispatch<React.SetStateAction<WeatherFormState>>;
  /** Called after a copy-from-yesterday creates new entries. */
  onDiaryUpdate?: (diary: DailyDiary) => void;
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
  setError,
  setWeatherForm,
  onDiaryUpdate,
}: UseDiaryMobileHandlersParams) {
  const navigate = useNavigate();
  const [activeLotId, setActiveLotId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<QuickAddType | 'weather' | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);

  // GPS auto-select: seed the active lot with the one the foreman is standing in
  // until they pick a lot themselves. userTouchedLot latches on first manual
  // change so the suggestion never re-overrides. lotAutoDetected drives the hint.
  const { suggestion: lotSuggestion } = useLotAtMyLocation(projectId);
  const userTouchedLot = useRef(false);
  const [lotAutoDetected, setLotAutoDetected] = useState(false);

  const handleLotChange = useCallback((lotId: string | null) => {
    userTouchedLot.current = true;
    setLotAutoDetected(false);
    setActiveLotId(lotId);
  }, []);

  useEffect(() => {
    if (userTouchedLot.current || activeLotId || !lotSuggestion) return;
    setActiveLotId(lotSuggestion.lotId);
    setLotAutoDetected(true);
  }, [activeLotId, lotSuggestion]);

  // Copy-from-yesterday for personnel and plant. Uses setDiary as the update
  // callback so the mobile timeline reflects new entries without a full refetch.
  const copyFromYesterday = useCopyFromYesterday({
    projectId,
    selectedDate,
    diary,
    onDiaryUpdate: (updated) => {
      setDiary(updated);
      onDiaryUpdate?.(updated);
    },
  });

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

  /**
   * Resolves the diary for the selected date, creating it when needed.
   * Throws (instead of silently returning) when creation fails so the calling
   * sheet keeps the foreman's typed entry open and shows its failure banner —
   * a silent return here used to let the sheet report success and close.
   */
  const requireDiary = async (): Promise<DailyDiary> => {
    const currentDiary = diary ?? (await ensureDiaryExists());
    if (!currentDiary) {
      throw new Error('Diary could not be created');
    }
    return currentDiary;
  };

  // Honest wording for the offline-queued path: the entry is safe on this
  // device, but the timeline is server-fetched so it will only show up after
  // the sync worker replays it and the page refetches — never promise
  // immediate visibility.
  const notifySavedOffline = () => {
    toast({
      title: 'Saved Offline',
      description:
        'Your entry is saved on this device and will appear in the diary after it syncs.',
    });
  };

  /**
   * Quick-add create with an offline fallback (mirrors the ITP field-write
   * path): attempt the network save first; on a retriable network failure —
   * browser offline, request timeout, fetch-level failure, or a 5xx — queue
   * the typed entry through the offline store + sync queue and report SUCCESS
   * to the sheet (closing it) with the honest "Saved Offline" toast.
   * Definitive rejections (4xx) still throw, keeping the #776 contract: the
   * sheet stays open with its failure banner and the typed values intact.
   *
   * When `requireDiary` itself fails, ensureDiaryExists has already swallowed
   * the network error (reporting it via the page-level error state), so the
   * classifier can only recognise the genuinely-offline case
   * (navigator.onLine === false); an online diary-create failure keeps
   * today's error-banner behavior. The queued path clears the page error —
   * a "Failed to create diary" banner would contradict the queued save.
   */
  const createWithOfflineFallback = async (
    attempt: (currentDiary: DailyDiary) => Promise<void>,
    queueOffline: (projectId: string, currentDiary: DailyDiary | null) => Promise<unknown>,
  ): Promise<void> => {
    let currentDiary: DailyDiary;
    try {
      currentDiary = await requireDiary();
    } catch (err) {
      if (!projectId || !isRetriableNetworkFailure(err)) throw err;
      await queueOffline(projectId, null);
      setError(null);
      notifySavedOffline();
      return;
    }

    try {
      await attempt(currentDiary);
    } catch (err) {
      if (!projectId || !isRetriableNetworkFailure(err)) throw err;
      await queueOffline(projectId, currentDiary);
      notifySavedOffline();
      return;
    }

    // Refetch only on the online path — on the queued path these would fail
    // against the same dead network, clearing the timeline and re-raising the
    // page error the foreman just recovered from.
    await fetchTimeline(currentDiary.id);
    await fetchDiaryForDate(selectedDate);
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

  // Edits of existing server entries stay online-only: the offline store has
  // no representation for "update entry <server id>", so a failed edit keeps
  // the sheet open with its failure banner instead of queueing.
  const updateTimelineEntryFromSheet = async (
    entry: TimelineEntry,
    endpoint: string,
    data: Record<string, unknown>,
  ) => {
    if (!diary) {
      throw new Error('Diary is required to update timeline entries');
    }

    await apiFetch(
      `/api/diary/${encodeURIComponent(diary.id)}/${endpoint}/${encodeURIComponent(entry.id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );
    setEditingEntry(null);
    await fetchTimeline(diary.id);
    await fetchDiaryForDate(selectedDate);
  };

  const addActivityFromSheet = async (data: {
    description: string;
    lotId?: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  }) => {
    const payload = { ...data, lotId: data.lotId || activeLotId || undefined };
    if (editingEntry?.type === 'activity') {
      await updateTimelineEntryFromSheet(editingEntry, 'activities', payload);
      return;
    }

    await createWithOfflineFallback(
      async (currentDiary) => {
        await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/activities`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      (currentProjectId) => queueDiaryActivityOffline(currentProjectId, selectedDate, payload),
    );
  };

  const addDelayFromSheet = async (data: {
    delayType: string;
    description: string;
    durationHours?: number;
    impact?: string;
    lotId?: string;
  }) => {
    const payload = { ...data, lotId: data.lotId || activeLotId || undefined };
    if (editingEntry?.type === 'delay') {
      await updateTimelineEntryFromSheet(editingEntry, 'delays', payload);
      return;
    }

    await createWithOfflineFallback(
      async (currentDiary) => {
        await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/delays`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      (currentProjectId) => queueDiaryDelayOffline(currentProjectId, selectedDate, payload),
    );
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
    const payload = { ...data, lotId: data.lotId || activeLotId || undefined };
    if (editingEntry?.type === 'delivery') {
      await updateTimelineEntryFromSheet(editingEntry, 'deliveries', payload);
      return;
    }

    await createWithOfflineFallback(
      async (currentDiary) => {
        await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/deliveries`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      (currentProjectId, currentDiary) =>
        queueDiaryDeliveryOffline(
          currentDiary
            ? { diaryId: currentDiary.id }
            : { projectId: currentProjectId, date: selectedDate },
          payload,
        ),
    );
  };

  const addEventFromSheet = async (data: {
    eventType: string;
    description: string;
    notes?: string;
    lotId?: string;
  }) => {
    const payload = { ...data, lotId: data.lotId || activeLotId || undefined };
    if (editingEntry?.type === 'event') {
      await updateTimelineEntryFromSheet(editingEntry, 'events', payload);
      return;
    }

    await createWithOfflineFallback(
      async (currentDiary) => {
        await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/events`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      (currentProjectId, currentDiary) =>
        queueDiaryEventOffline(
          currentDiary
            ? { diaryId: currentDiary.id }
            : { projectId: currentProjectId, date: selectedDate },
          payload,
        ),
    );
  };

  const handleEditEntry = (entry: TimelineEntry) => {
    setEditingEntry(entry);
    setActiveSheet(entry.type === 'personnel' || entry.type === 'plant' ? 'manual' : entry.type);
  };

  const handleTapPending = (_docketId: string) => {
    if (!projectId) return;
    navigate(`/projects/${encodeURIComponent(projectId)}/dockets?status=pending_approval`);
  };

  // Personnel stays online-only: the offline diary snapshot has no personnel
  // representation (only workforce counts) and the sync worker never replays
  // personnel rows, so a failed save keeps the sheet open with its failure
  // banner rather than queueing an entry that could never sync.
  const handleSavePersonnel = async (data: ManualPersonnelData) => {
    const payload = {
      ...data,
      source: 'manual',
      lotId: data.lotId || activeLotId || undefined,
    };
    if (editingEntry?.type === 'personnel') {
      await updateTimelineEntryFromSheet(editingEntry, 'personnel', payload);
      return;
    }
    const currentDiary = await requireDiary();
    await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/personnel`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    await fetchTimeline(currentDiary.id);
    await fetchDiaryForDate(selectedDate);
  };

  const handleSavePlant = async (data: ManualPlantData) => {
    const payload = {
      ...data,
      source: 'manual',
      lotId: data.lotId || activeLotId || undefined,
    };
    if (editingEntry?.type === 'plant') {
      await updateTimelineEntryFromSheet(editingEntry, 'plant', payload);
      return;
    }

    await createWithOfflineFallback(
      async (currentDiary) => {
        await apiFetch(`/api/diary/${encodeURIComponent(currentDiary.id)}/plant`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      },
      (currentProjectId) => queueDiaryPlantOffline(currentProjectId, selectedDate, payload),
    );
  };

  const handleSaveWeather = async (data: {
    conditions: string;
    temperatureMin: string;
    temperatureMax: string;
    rainfallMm: string;
  }) => {
    if (getDiaryWeatherNumberError(data)) return;

    const temperatureMin = parseOptionalDiaryTemperatureInput(data.temperatureMin);
    const temperatureMax = parseOptionalDiaryTemperatureInput(data.temperatureMax);
    const rainfallMm = parseOptionalDiaryRainfallInput(data.rainfallMm);

    const queueWeatherOffline = async (
      currentProjectId: string,
      currentDiary: DailyDiary | null,
    ) => {
      await queueDiaryWeatherOffline(currentProjectId, selectedDate, {
        conditions: data.conditions || undefined,
        temperatureMin: temperatureMin ?? undefined,
        temperatureMax: temperatureMax ?? undefined,
        rainfallMm: rainfallMm ?? undefined,
      });
      // Local visibility for queued weather is cheap and honest: the weather
      // bar reads the diary when one exists, the form state otherwise.
      if (currentDiary) {
        setDiary({
          ...currentDiary,
          weatherConditions: data.conditions || currentDiary.weatherConditions,
          temperatureMin: temperatureMin ?? currentDiary.temperatureMin,
          temperatureMax: temperatureMax ?? currentDiary.temperatureMax,
          rainfallMm: rainfallMm ?? currentDiary.rainfallMm,
        });
      }
      setWeatherForm((prev) => ({
        ...prev,
        weatherConditions: data.conditions || prev.weatherConditions,
        temperatureMin: data.temperatureMin || prev.temperatureMin,
        temperatureMax: data.temperatureMax || prev.temperatureMax,
        rainfallMm: data.rainfallMm || prev.rainfallMm,
      }));
      notifySavedOffline();
    };

    // Non-retriable failures must reach the weather sheet so it stays open
    // and shows its failure banner instead of reporting a successful save;
    // retriable network failures queue the typed weather offline instead.
    let currentDiary: DailyDiary;
    try {
      currentDiary = await requireDiary();
    } catch (err) {
      if (!projectId || !isRetriableNetworkFailure(err)) throw err;
      await queueWeatherOffline(projectId, null);
      setError(null);
      return;
    }

    let updated: DailyDiary;
    try {
      updated = await apiFetch<DailyDiary>('/api/diary', {
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
    } catch (err) {
      if (!projectId || !isRetriableNetworkFailure(err)) throw err;
      await queueWeatherOffline(projectId, currentDiary);
      return;
    }

    setDiary(updated);
    setWeatherForm(() => ({
      weatherConditions: updated.weatherConditions || '',
      temperatureMin: updated.temperatureMin?.toString() || '',
      temperatureMax: updated.temperatureMax?.toString() || '',
      rainfallMm: updated.rainfallMm?.toString() || '',
      weatherNotes: updated.weatherNotes || '',
      generalNotes: updated.generalNotes || '',
    }));
  };

  return {
    activeLotId,
    setActiveLotId: handleLotChange,
    lotAutoDetected,
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
    // Copy-from-yesterday
    copyPersonnelFromYesterday: copyFromYesterday.copyPersonnelFromYesterday,
    copyingPersonnel: copyFromYesterday.copyingPersonnel,
    copyPlantFromYesterday: copyFromYesterday.copyPlantFromYesterday,
    copyingPlant: copyFromYesterday.copyingPlant,
    canCopyFromYesterday: copyFromYesterday.canCopy,
  };
}
