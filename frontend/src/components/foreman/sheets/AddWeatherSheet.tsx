import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet } from './BottomSheet';
import { SheetDraftRestoredHint } from './SheetDraftRestoredHint';
import { SheetErrorBanner } from './SheetErrorBanner';
import { readSheetDraft, useSheetDraft } from './useSheetDraft';
import { useSheetSave } from './useSheetSave';
import { getDiaryWeatherNumberError } from '@/pages/diary/diaryNumericInput';

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

interface WeatherData {
  conditions: string;
  temperatureMin: string;
  temperatureMax: string;
  rainfallMm: string;
}

interface AddWeatherSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: WeatherData) => Promise<void>;
  initialData: WeatherData | null;
  /** Enables auto-draft of foreman-modified state (auto-populated values never draft). */
  draftKey?: string;
}

export function AddWeatherSheet({
  isOpen,
  onClose,
  onSave,
  initialData,
  draftKey,
}: AddWeatherSheetProps) {
  // A foreman-modified entry restored from the auto-draft.
  const [restoredDraft] = useState(() => readSheetDraft(draftKey));
  const [conditions, setConditions] = useState(
    restoredDraft?.conditions ?? (initialData?.conditions || ''),
  );
  const [temperatureMin, setTemperatureMin] = useState(
    restoredDraft?.temperatureMin ?? (initialData?.temperatureMin || ''),
  );
  const [temperatureMax, setTemperatureMax] = useState(
    restoredDraft?.temperatureMax ?? (initialData?.temperatureMax || ''),
  );
  const [rainfallMm, setRainfallMm] = useState(
    restoredDraft?.rainfallMm ?? (initialData?.rainfallMm || ''),
  );
  const { saving, saveError, runSave } = useSheetSave();
  // The baseline is the auto-populated weather (diary values or the fetched
  // forecast), so opening the sheet and dismissing it never creates a phantom
  // draft — only foreman-modified values persist.
  const draft = useSheetDraft({
    draftKey,
    restored: restoredDraft,
    fields: { conditions, temperatureMin, temperatureMax, rainfallMm },
    baseline: {
      conditions: initialData?.conditions || '',
      temperatureMin: initialData?.temperatureMin || '',
      temperatureMax: initialData?.temperatureMax || '',
      rainfallMm: initialData?.rainfallMm || '',
    },
  });
  const weatherNumberError = getDiaryWeatherNumberError({
    temperatureMin,
    temperatureMax,
    rainfallMm,
  });

  // Late-arriving auto-populated weather (e.g. the forecast fetch finishing
  // while the sheet is open) fills the fields — but never over a restored
  // draft or values the foreman has touched: typed work always wins.
  const fieldsTouchedRef = useRef(restoredDraft !== null);
  const markTouched = () => {
    fieldsTouchedRef.current = true;
  };

  useEffect(() => {
    if (fieldsTouchedRef.current) return;
    if (initialData) {
      setConditions(initialData.conditions || '');
      setTemperatureMin(initialData.temperatureMin || '');
      setTemperatureMax(initialData.temperatureMax || '');
      setRainfallMm(initialData.rainfallMm || '');
    }
  }, [initialData]);

  const handleDiscardDraft = () => {
    setConditions(initialData?.conditions || '');
    setTemperatureMin(initialData?.temperatureMin || '');
    setTemperatureMax(initialData?.temperatureMax || '');
    setRainfallMm(initialData?.rainfallMm || '');
    fieldsTouchedRef.current = false;
    draft.discardDraft();
  };

  const handleSave = () => {
    if (weatherNumberError) return;
    void runSave(
      () => onSave({ conditions, temperatureMin, temperatureMax, rainfallMm }),
      () => {
        // Recorded (online or queued offline) — drop the draft.
        draft.clearDraft();
        onClose();
      },
    );
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Weather">
      <div className="space-y-4">
        {draft.draftHintVisible && (
          <SheetDraftRestoredHint
            onDiscard={handleDiscardDraft}
            onDismiss={draft.dismissDraftHint}
          />
        )}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Conditions</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {CONDITIONS.map((c) => (
              <button
                key={c}
                onClick={() => {
                  markTouched();
                  setConditions(c);
                }}
                className={cn(
                  'px-3 py-2 rounded-full text-sm font-medium touch-manipulation min-h-[44px]',
                  conditions === c
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Min Temp (°C)</label>
            <input
              type="number"
              value={temperatureMin}
              onChange={(e) => {
                markTouched();
                setTemperatureMin(e.target.value);
              }}
              placeholder="e.g. 12"
              className={cn(
                'w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation',
                weatherNumberError && 'border-destructive',
              )}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Max Temp (°C)</label>
            <input
              type="number"
              value={temperatureMax}
              onChange={(e) => {
                markTouched();
                setTemperatureMax(e.target.value);
              }}
              placeholder="e.g. 28"
              className={cn(
                'w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation',
                weatherNumberError && 'border-destructive',
              )}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground">Rainfall (mm)</label>
          <input
            type="number"
            value={rainfallMm}
            onChange={(e) => {
              markTouched();
              setRainfallMm(e.target.value);
            }}
            placeholder="0"
            step="0.1"
            className={cn(
              'w-full mt-1 px-3 py-3 border border-border bg-background text-foreground rounded-lg text-base touch-manipulation',
              weatherNumberError && 'border-destructive',
            )}
          />
        </div>

        {weatherNumberError && (
          <p className="text-sm text-destructive" role="alert" aria-live="assertive">
            {weatherNumberError}
          </p>
        )}

        {saveError && <SheetErrorBanner onRetry={handleSave} retrying={saving} />}

        <button
          onClick={handleSave}
          disabled={Boolean(weatherNumberError) || saving}
          className={cn(
            'w-full py-4 rounded-lg font-semibold text-primary-foreground',
            'bg-primary active:bg-primary/90',
            'touch-manipulation min-h-[56px]',
            'flex items-center justify-center gap-2',
            (weatherNumberError || saving) && 'opacity-50',
          )}
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" /> Saving...
            </>
          ) : (
            'Save Weather'
          )}
        </button>
      </div>
    </BottomSheet>
  );
}
