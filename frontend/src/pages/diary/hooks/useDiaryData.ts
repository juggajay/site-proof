import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import type { TimelineEntry } from '@/components/foreman/DiaryTimelineEntry';
import type { DocketSummaryData } from '@/components/foreman/DiaryDocketSummary';
import {
  getDiaryWeatherNumberError,
  parseOptionalDiaryRainfallInput,
  parseOptionalDiaryTemperatureInput,
} from '../diaryNumericInput';
import type { DailyDiary, Lot, Addendum, WeatherFormState } from '../types';

interface DiaryListResponse {
  data: DailyDiary[];
  pagination?: unknown;
}

interface UseDiaryDataParams {
  projectId: string | undefined;
  isMobile: boolean;
}

interface WeatherResponse {
  weatherConditions?: string | null;
  temperatureMin?: number | null;
  temperatureMax?: number | null;
  rainfallMm?: number | null;
  source?: string | null;
  location?: {
    fromProjectState?: boolean;
  } | null;
}

export function useDiaryData({ projectId, isMobile }: UseDiaryDataParams) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [diary, setDiary] = useState<DailyDiary | null>(null);
  const [diaries, setDiaries] = useState<DailyDiary[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [weatherSource, setWeatherSource] = useState<string | null>(null);
  const [addendums, setAddendums] = useState<Addendum[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [docketSummary, setDocketSummary] = useState<DocketSummaryData | null>(null);
  const [docketSummaryLoading, setDocketSummaryLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const diaryId = diary?.id;
  const diaryStatus = diary?.status;
  const savingDiaryRef = useRef(false);
  const ensureDiaryPromiseRef = useRef<Promise<DailyDiary | null> | null>(null);

  const [weatherForm, setWeatherForm] = useState<WeatherFormState>({
    weatherConditions: '',
    temperatureMin: '',
    temperatureMax: '',
    rainfallMm: '',
    weatherNotes: '',
    generalNotes: '',
  });

  const resetDiaryForm = useCallback(() => {
    setDiary(null);
    setWeatherForm({
      weatherConditions: '',
      temperatureMin: '',
      temperatureMax: '',
      rainfallMm: '',
      weatherNotes: '',
      generalNotes: '',
    });
    setWeatherSource(null);
    setTimeline([]);
    setAddendums([]);
    setShowNewEntry(false);
  }, []);

  // --- Fetch functions ---

  const fetchDiaries = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await apiFetch<DailyDiary[] | DiaryListResponse>(
        `/api/diary/${encodeURIComponent(projectId)}`,
      );
      setDiaries(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      logError('Error fetching diaries:', err);
      setDiaries([]);
    }
  }, [projectId]);

  const fetchLots = useCallback(async () => {
    if (!projectId) return;
    try {
      const queryParams = new URLSearchParams({ projectId });
      const data = await apiFetch<{ lots: Lot[] }>(`/api/lots?${queryParams.toString()}`);
      setLots(data.lots || []);
    } catch (err) {
      logError('Error fetching lots:', err);
      setLots([]);
    }
  }, [projectId]);

  const fetchTimeline = useCallback(
    async (diaryId?: string) => {
      const id = diaryId || diary?.id;
      if (!id) return;
      try {
        const data = await apiFetch<{ timeline: TimelineEntry[] }>(
          `/api/diary/${encodeURIComponent(id)}/timeline`,
        );
        setTimeline(data.timeline || []);
      } catch (err) {
        logError('Error fetching timeline:', err);
        setTimeline([]);
      }
    },
    [diary?.id],
  );

  const fetchDocketSummary = useCallback(async () => {
    if (!projectId || !selectedDate) return;
    setDocketSummaryLoading(true);
    try {
      const data = await apiFetch<DocketSummaryData>(
        `/api/diary/project/${encodeURIComponent(projectId)}/docket-summary/${encodeURIComponent(selectedDate)}`,
      );
      setDocketSummary(data);
    } catch (err) {
      logError('Error fetching docket summary:', err);
      setDocketSummary(null);
    } finally {
      setDocketSummaryLoading(false);
    }
  }, [projectId, selectedDate]);

  const fetchWeatherForDate = useCallback(
    async (date: string) => {
      if (!projectId) return;
      setFetchingWeather(true);
      setWeatherSource(null);
      try {
        const data = await apiFetch<WeatherResponse>(
          `/api/diary/${encodeURIComponent(projectId)}/weather/${encodeURIComponent(date)}`,
        );
        setWeatherForm((prev) => ({
          ...prev,
          weatherConditions: data.weatherConditions || prev.weatherConditions,
          temperatureMin: data.temperatureMin?.toString() || prev.temperatureMin,
          temperatureMax: data.temperatureMax?.toString() || prev.temperatureMax,
          rainfallMm: data.rainfallMm?.toString() || prev.rainfallMm,
        }));
        setWeatherSource(
          data.location?.fromProjectState
            ? `Weather auto-populated from ${data.source || 'weather service'} (state capital)`
            : `Weather auto-populated from ${data.source || 'weather service'}`,
        );
      } catch (err) {
        logError('Error fetching weather:', err);
      } finally {
        setFetchingWeather(false);
      }
    },
    [projectId],
  );

  const fetchDiaryForDate = useCallback(
    async (date: string) => {
      if (!projectId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<DailyDiary>(
          `/api/diary/${encodeURIComponent(projectId)}/${encodeURIComponent(date)}`,
        );
        setDiary(data);
        setWeatherForm({
          weatherConditions: data.weatherConditions || '',
          temperatureMin: data.temperatureMin?.toString() || '',
          temperatureMax: data.temperatureMax?.toString() || '',
          rainfallMm: data.rainfallMm?.toString() || '',
          weatherNotes: data.weatherNotes || '',
          generalNotes: data.generalNotes || '',
        });
        setShowNewEntry(true);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          resetDiaryForm();
          void fetchWeatherForDate(date);
        } else {
          logError('Error fetching diary:', err);
          resetDiaryForm();
          setError(extractErrorMessage(err, 'Failed to fetch diary'));
        }
      } finally {
        setLoading(false);
      }
    },
    [projectId, fetchWeatherForDate, resetDiaryForm],
  );

  const fetchAddendums = useCallback(async (diaryId: string) => {
    try {
      const data = await apiFetch<Addendum[]>(
        `/api/diary/${encodeURIComponent(diaryId)}/addendums`,
      );
      setAddendums(data || []);
    } catch (err) {
      logError('Error fetching addendums:', err);
      setAddendums([]);
    }
  }, []);

  // --- Core Handlers ---

  const createOrUpdateDiary = useCallback(async () => {
    if (saving || savingDiaryRef.current) return;
    savingDiaryRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const weatherNumberError = getDiaryWeatherNumberError(weatherForm);
      if (weatherNumberError) {
        setError(weatherNumberError);
        return;
      }

      const temperatureMin = parseOptionalDiaryTemperatureInput(weatherForm.temperatureMin);
      const temperatureMax = parseOptionalDiaryTemperatureInput(weatherForm.temperatureMax);
      const rainfallMm = parseOptionalDiaryRainfallInput(weatherForm.rainfallMm);

      const data = await apiFetch<DailyDiary>('/api/diary', {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          date: selectedDate,
          weatherConditions: weatherForm.weatherConditions.trim() || undefined,
          temperatureMin: temperatureMin ?? undefined,
          temperatureMax: temperatureMax ?? undefined,
          rainfallMm: rainfallMm ?? undefined,
          weatherNotes: weatherForm.weatherNotes.trim() || undefined,
          generalNotes: weatherForm.generalNotes.trim() || undefined,
        }),
      });
      setDiary(data);
      setShowNewEntry(true);
      fetchDiaries();
    } catch (err) {
      logError('Error saving diary:', err);
      setError(extractErrorMessage(err, 'Failed to save diary'));
    } finally {
      savingDiaryRef.current = false;
      setSaving(false);
    }
  }, [saving, projectId, selectedDate, weatherForm, fetchDiaries]);

  const ensureDiaryExists = useCallback(async (): Promise<DailyDiary | null> => {
    if (diary) return diary;
    if (ensureDiaryPromiseRef.current) return ensureDiaryPromiseRef.current;

    const createDiaryPromise = (async () => {
      try {
        const newDiary = await apiFetch<DailyDiary>('/api/diary', {
          method: 'POST',
          body: JSON.stringify({ projectId, date: selectedDate }),
        });
        setDiary(newDiary);
        return newDiary;
      } catch (err) {
        logError('Error creating diary:', err);
        setError(extractErrorMessage(err, 'Failed to create diary'));
        return null;
      } finally {
        ensureDiaryPromiseRef.current = null;
      }
    })();

    ensureDiaryPromiseRef.current = createDiaryPromise;
    return createDiaryPromise;
  }, [diary, projectId, selectedDate]);

  // --- Effects ---

  useEffect(() => {
    if (projectId) {
      fetchDiaries();
      fetchLots();
    }
  }, [projectId, fetchDiaries, fetchLots]);

  useEffect(() => {
    if (projectId && selectedDate) {
      fetchDiaryForDate(selectedDate);
    }
  }, [projectId, selectedDate, fetchDiaryForDate]);

  useEffect(() => {
    if (diaryId && diaryStatus === 'submitted') {
      fetchAddendums(diaryId);
    } else {
      setAddendums([]);
    }
  }, [diaryId, diaryStatus, fetchAddendums]);

  useEffect(() => {
    if (diary && isMobile) {
      fetchTimeline();
    }
  }, [diary, isMobile, fetchTimeline]);

  useEffect(() => {
    if (isMobile && projectId && selectedDate) {
      fetchDocketSummary();
    }
  }, [isMobile, projectId, selectedDate, fetchDocketSummary]);

  return {
    selectedDate,
    setSelectedDate,
    diary,
    setDiary,
    diaries,
    lots,
    loading,
    saving,
    setSaving,
    error,
    setError,
    showNewEntry,
    setShowNewEntry,
    fetchingWeather,
    weatherSource,
    addendums,
    setAddendums,
    timeline,
    docketSummary,
    docketSummaryLoading,
    weatherForm,
    setWeatherForm,
    fetchDiaries,
    fetchDiaryForDate,
    fetchTimeline,
    fetchDocketSummary,
    fetchWeatherForDate,
    createOrUpdateDiary,
    ensureDiaryExists,
  };
}
