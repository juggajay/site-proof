import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Crosshair, MapPin, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useGeoLocation } from '@/hooks/useGeoLocation';
import {
  MAX_ACCURACY_M,
  formatCoordinate,
  formatProvenance,
  tooCoarseMessage,
  type SampleLocationSource,
} from '@/lib/samplePoint';

// Lazy so Leaflet never enters the test-register bundle (LotsPage lazy-loads
// LotMapView for the same reason). Nothing is fetched or parsed until someone
// actually presses "Pick on map".
const SamplePointPicker = lazy(() => import('./SamplePointPicker'));

export interface CapturedSamplePoint {
  lat: number;
  lng: number;
  source: SampleLocationSource;
  /** Metres, GPS only. NULL for a map pick — a tap has no accuracy radius. */
  accuracyM: number | null;
}

interface SampleLocationCaptureProps {
  /** The test's linked lot, drawn on the pick map for orientation only. */
  lotId?: string;
  value: CapturedSamplePoint | null;
  onChange: (value: CapturedSamplePoint | null) => void;
}

/**
 * Wave C3 Phase B2 §5.4 `[C3R-B3]` — where a sample was taken, captured by a
 * human, on the one form where a human can know the answer.
 *
 * **Pick on map is primary.** A test is frequently *requested* from the office for
 * a sample point someone else took; picking says "here is where the sample is",
 * which is what the user actually knows. GPS is secondary and labelled with its
 * own precondition — *"I'm at the sample point now"* is a question the user
 * answers by not pressing it. A button called "Use my location" would be true and
 * useless.
 *
 * Capture is optional and gates nothing (J2). There is no derived value and no
 * default: no capture, no location `[C3S-B1]`.
 */
export function SampleLocationCapture({ lotId, value, onChange }: SampleLocationCaptureProps) {
  const [picking, setPicking] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  // Only a fix this component ASKED for may be written. Without this, any fix the
  // hook happens to hold would land on the form.
  const awaitingFix = useRef(false);

  // `immediate: false` [C3R-B4] — opening the create-test form must not prompt for
  // a GPS permission. `maximumAge: 0` because the hook's 60s default is fine for
  // guessing which lot you stand in and wrong for a sample point, where a minute
  // is a truck-length of walking.
  const geo = useGeoLocation({ immediate: false, maximumAge: 0 });

  useEffect(() => {
    if (!awaitingFix.current || geo.loading) return;
    if (geo.error) {
      awaitingFix.current = false;
      setGpsError(geo.error);
      return;
    }
    if (geo.latitude == null || geo.longitude == null) return;
    awaitingFix.current = false;

    // A coarse fix is REFUSED with its own number shown — never silently
    // discarded, and never silently saved as if it were a sample point.
    if (geo.accuracy != null && geo.accuracy > MAX_ACCURACY_M) {
      setGpsError(tooCoarseMessage(geo.accuracy));
      return;
    }
    setGpsError(null);
    onChange({
      lat: geo.latitude,
      lng: geo.longitude,
      source: 'gps',
      accuracyM: geo.accuracy,
    });
  }, [geo.loading, geo.error, geo.latitude, geo.longitude, geo.accuracy, onChange]);

  const useMyLocation = useCallback(() => {
    setGpsError(null);
    awaitingFix.current = true;
    geo.refresh();
  }, [geo]);

  const handlePick = useCallback(
    (lat: number, lng: number) => {
      setGpsError(null);
      // A tap carries no accuracy radius, so accuracy stays NULL — which is a
      // fact about a map pick, not a missing value.
      onChange({ lat, lng, source: 'map_pick', accuracyM: null });
    },
    [onChange],
  );

  const clear = useCallback(() => {
    setGpsError(null);
    setPicking(false);
    onChange(null);
  }, [onChange]);

  return (
    <div className="space-y-2" data-testid="sample-location-capture">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={picking ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPicking((on) => !on)}
          data-testid="sample-pick-on-map"
        >
          <MapPin className="mr-1.5 h-4 w-4" />
          {picking ? 'Done picking' : 'Pick on map'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={useMyLocation}
          disabled={geo.loading}
          data-testid="sample-use-my-location"
        >
          <Crosshair className="mr-1.5 h-4 w-4" />
          {geo.loading ? 'Getting a fix…' : "I'm at the sample point now"}
        </Button>
      </div>

      {picking && (
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground" role="status">
              Loading map…
            </p>
          }
        >
          <SamplePointPicker lotId={lotId} value={value} onPick={handlePick} />
          <p className="text-xs text-muted-foreground">
            Tap the map where the sample was taken.
            {lotId ? '' : ' Link a lot first to open the map on it.'}
          </p>
        </Suspense>
      )}

      {gpsError && (
        <p className="text-sm text-destructive" role="alert" data-testid="sample-gps-error">
          {gpsError}
        </p>
      )}

      {value ? (
        <div className="flex items-center gap-2 text-sm" data-testid="sample-point-summary">
          <span className="font-mono text-xs">{formatCoordinate(value)}</span>
          <span className="text-muted-foreground">· {formatProvenance(value)}</span>
          <button
            type="button"
            onClick={clear}
            className="ml-auto inline-flex items-center gap-1 rounded p-1 text-muted-foreground hover:bg-muted"
            data-testid="sample-point-clear"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Optional. Nothing is recorded unless you capture it.
        </p>
      )}
    </div>
  );
}

export default SampleLocationCapture;
