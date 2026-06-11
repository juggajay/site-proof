/**
 * WeatherScreen — /m/diary/weather
 *
 * Full-screen form reusing the weather sheet's fields/validation/mutation.
 * Auto-fills from the diary when it exists.
 * Saving navigates back to the path (/m/diary).
 *
 * Design spec: docs/design-foreman-shell-mock-v4.html #activity (form pattern)
 * Reuses: AddWeatherSheet form fields + useDiaryMobileHandlers.handleSaveWeather
 *         + useSheetDraft auto-draft + diaryNumericInput validation
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ShellScreen } from '../../components/ShellScreen';
import { useDiaryShellData } from './useDiaryShellData';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import {
  readSheetDraft,
  useSheetDraft,
  sheetDraftKey,
} from '@/components/foreman/sheets/useSheetDraft';
import { useSheetSave } from '@/components/foreman/sheets/useSheetSave';
import { getDiaryWeatherNumberError } from '@/pages/diary/diaryNumericInput';
import { SheetDraftRestoredHint } from '@/components/foreman/sheets/SheetDraftRestoredHint';
import { SheetErrorBanner } from '@/components/foreman/sheets/SheetErrorBanner';
import { formatDateKey } from '@/lib/localDate';

const CONDITIONS = [
  'Fine',
  'Partly Cloudy',
  'Cloudy',
  'Overcast',
  'Rain',
  'Heavy Rain',
  'Storm',
  'Windy',
  'Fog',
];

export function WeatherScreen() {
  const navigate = useNavigate();
  const { projectId } = useEffectiveProjectId();
  const { weatherForm, fetchingWeather, weatherSource, handlers } = useDiaryShellData();

  const todayKey = formatDateKey();
  const draftKey = projectId ? sheetDraftKey(projectId, todayKey, 'weather') : undefined;

  // Build initial data from diary / weatherForm (same as AddWeatherSheet)
  const initialData = {
    conditions: weatherForm.weatherConditions,
    temperatureMin: weatherForm.temperatureMin,
    temperatureMax: weatherForm.temperatureMax,
    rainfallMm: weatherForm.rainfallMm,
  };

  const [restoredDraft] = useState(() => readSheetDraft(draftKey));
  const [conditions, setConditions] = useState(
    restoredDraft?.conditions ?? (initialData.conditions || ''),
  );
  const [temperatureMin, setTemperatureMin] = useState(
    restoredDraft?.temperatureMin ?? (initialData.temperatureMin || ''),
  );
  const [temperatureMax, setTemperatureMax] = useState(
    restoredDraft?.temperatureMax ?? (initialData.temperatureMax || ''),
  );
  const [rainfallMm, setRainfallMm] = useState(
    restoredDraft?.rainfallMm ?? (initialData.rainfallMm || ''),
  );

  const { saving, saveError, runSave } = useSheetSave();

  const draft = useSheetDraft({
    draftKey,
    restored: restoredDraft,
    fields: { conditions, temperatureMin, temperatureMax, rainfallMm },
    baseline: {
      conditions: initialData.conditions || '',
      temperatureMin: initialData.temperatureMin || '',
      temperatureMax: initialData.temperatureMax || '',
      rainfallMm: initialData.rainfallMm || '',
    },
  });

  const weatherNumberError = getDiaryWeatherNumberError({
    temperatureMin,
    temperatureMax,
    rainfallMm,
  });

  // Late-arriving auto-populated weather (e.g. the forecast fetch finishing)
  // fills the fields only if the foreman hasn't touched them yet.
  const fieldsTouchedRef = useRef(restoredDraft !== null);
  const markTouched = () => {
    fieldsTouchedRef.current = true;
  };

  useEffect(() => {
    if (fieldsTouchedRef.current) return;
    setConditions(weatherForm.weatherConditions || '');
    setTemperatureMin(weatherForm.temperatureMin || '');
    setTemperatureMax(weatherForm.temperatureMax || '');
    setRainfallMm(weatherForm.rainfallMm || '');
  }, [weatherForm]);

  const handleDiscardDraft = () => {
    setConditions(initialData.conditions || '');
    setTemperatureMin(initialData.temperatureMin || '');
    setTemperatureMax(initialData.temperatureMax || '');
    setRainfallMm(initialData.rainfallMm || '');
    fieldsTouchedRef.current = false;
    draft.discardDraft();
  };

  const backPath = projectId ? `/m/diary?projectId=${projectId}` : '/m/diary';

  const handleSave = () => {
    if (weatherNumberError) return;
    void runSave(
      () => handlers.handleSaveWeather({ conditions, temperatureMin, temperatureMax, rainfallMm }),
      () => {
        draft.clearDraft();
        navigate(backPath);
      },
    );
  };

  const sub = (
    <span className="flex items-center gap-2 text-muted-foreground">
      Auto-saves as you type — interruptions lose nothing
    </span>
  );

  return (
    <ShellScreen
      variant="inner"
      title="Weather"
      parent={backPath}
      sub={sub}
      bottom={
        <div className="shell-cambar">
          <button
            type="button"
            onClick={handleSave}
            disabled={Boolean(weatherNumberError) || saving}
            className={cn('shell-cambar-btn', (weatherNumberError || saving) && 'opacity-50')}
            aria-label="Save weather"
          >
            {saving ? (
              <>
                <Loader2 size={20} className="animate-spin" aria-hidden="true" />
                Saving…
              </>
            ) : (
              'Save Weather'
            )}
          </button>
        </div>
      }
    >
      {draft.draftHintVisible && (
        <SheetDraftRestoredHint onDiscard={handleDiscardDraft} onDismiss={draft.dismissDraftHint} />
      )}

      {/* Conditions chip grid */}
      <div>
        <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
          Conditions
        </label>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                markTouched();
                setConditions(c);
              }}
              className={cn(
                'min-h-[44px] rounded-full px-3 py-2 text-sm font-medium touch-manipulation',
                conditions === c
                  ? 'bg-foreground text-[hsl(40_33%_98%)]'
                  : 'bg-secondary text-muted-foreground',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Temperature row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
            Min Temp (°C)
          </label>
          <input
            type="number"
            value={temperatureMin}
            onChange={(e) => {
              markTouched();
              setTemperatureMin(e.target.value);
            }}
            placeholder="e.g. 12"
            inputMode="decimal"
            className={cn(
              'w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation',
              weatherNumberError && 'border-destructive',
            )}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
            Max Temp (°C)
          </label>
          <input
            type="number"
            value={temperatureMax}
            onChange={(e) => {
              markTouched();
              setTemperatureMax(e.target.value);
            }}
            placeholder="e.g. 28"
            inputMode="decimal"
            className={cn(
              'w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation',
              weatherNumberError && 'border-destructive',
            )}
          />
        </div>
      </div>

      {/* Rainfall */}
      <div>
        <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[.07em] text-muted-foreground">
          Rainfall (mm)
        </label>
        <input
          type="number"
          value={rainfallMm}
          onChange={(e) => {
            markTouched();
            setRainfallMm(e.target.value);
          }}
          placeholder="0"
          step="0.1"
          inputMode="decimal"
          className={cn(
            'w-full min-h-[52px] rounded-xl border border-border bg-card px-3 py-3 text-[15px] text-foreground touch-manipulation',
            weatherNumberError && 'border-destructive',
          )}
        />
      </div>

      {weatherNumberError && (
        <p className="text-sm text-destructive" role="alert" aria-live="assertive">
          {weatherNumberError}
        </p>
      )}

      {/* Auto-fill source note */}
      {(fetchingWeather || weatherSource) && (
        <p className="text-[13px] text-muted-foreground">
          {fetchingWeather ? 'Fetching forecast…' : weatherSource}
        </p>
      )}

      {saveError && <SheetErrorBanner onRetry={handleSave} retrying={saving} />}
    </ShellScreen>
  );
}
