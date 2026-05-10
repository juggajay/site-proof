interface PhotoLocationLinks {
  latitudeLabel: string;
  longitudeLabel: string;
  openStreetMapEmbedUrl: string;
  googleMapsUrl: string;
}

const MAP_LATITUDE_PADDING = 0.003;
const MAP_LONGITUDE_PADDING = 0.005;

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

export function getPhotoLocationLinks(
  gpsLatitude: number | null | undefined,
  gpsLongitude: number | null | undefined,
): PhotoLocationLinks | null {
  if (gpsLatitude == null || gpsLongitude == null) {
    return null;
  }

  const latitude = Number(gpsLatitude);
  const longitude = Number(gpsLongitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const latitudeLabel = formatCoordinate(latitude);
  const longitudeLabel = formatCoordinate(longitude);
  const bbox = [
    formatCoordinate(longitude - MAP_LONGITUDE_PADDING),
    formatCoordinate(latitude - MAP_LATITUDE_PADDING),
    formatCoordinate(longitude + MAP_LONGITUDE_PADDING),
    formatCoordinate(latitude + MAP_LATITUDE_PADDING),
  ].join(',');
  const marker = `${latitudeLabel},${longitudeLabel}`;

  const openStreetMapParams = new URLSearchParams({
    bbox,
    layer: 'mapnik',
    marker,
  });
  const googleMapsParams = new URLSearchParams({
    api: '1',
    query: marker,
  });

  return {
    latitudeLabel,
    longitudeLabel,
    openStreetMapEmbedUrl: `https://www.openstreetmap.org/export/embed.html?${openStreetMapParams.toString()}`,
    googleMapsUrl: `https://www.google.com/maps/search/?${googleMapsParams.toString()}`,
  };
}
