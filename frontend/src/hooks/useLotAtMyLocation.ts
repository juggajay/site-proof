// Suggests the lot the user is physically standing in, for pre-selecting the
// "Link to Lot" field when filing a field record. One GPS fix (no polling — the
// consumers mount briefly), tested against the project's lot footprints.
import { useMemo } from 'react';

import { useGeoLocation } from './useGeoLocation';
import { useProjectLotGeometries } from '@/pages/lots/map/lotMapData';
import { lotAtPoint } from '@/pages/lots/map/lotMapHelpers';

// A coarse fix confidently picking a narrow lot is worse than no suggestion, so
// discard fixes worse than this. Typical phone GPS outdoors is 5–20 m.
const MAX_ACCURACY_M = 30;

export function useLotAtMyLocation(projectId: string | undefined) {
  const { latitude, longitude, accuracy, loading: geoLoading } = useGeoLocation();
  const { data, isLoading: geomLoading } = useProjectLotGeometries(projectId);

  const suggestion = useMemo(() => {
    if (latitude == null || longitude == null) return null;
    if (accuracy != null && accuracy > MAX_ACCURACY_M) return null;
    const geometries = data?.geometries ?? [];
    if (geometries.length === 0) return null;
    return lotAtPoint(geometries, longitude, latitude);
  }, [latitude, longitude, accuracy, data]);

  return { suggestion, accuracy, loading: geoLoading || geomLoading };
}
