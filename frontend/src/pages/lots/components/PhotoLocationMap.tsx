import { MapPin } from 'lucide-react';
import { getPhotoLocationLinks } from './photoLocationLinks';

interface PhotoLocationMapProps {
  gpsLatitude: number | null | undefined;
  gpsLongitude: number | null | undefined;
  openLabel?: string;
}

export function PhotoLocationMap({
  gpsLatitude,
  gpsLongitude,
  openLabel = 'Open in Google Maps',
}: PhotoLocationMapProps) {
  const location = getPhotoLocationLinks(gpsLatitude, gpsLongitude);

  if (!location) {
    return null;
  }

  return (
    <div className="mt-4" data-testid="photo-gps-map">
      <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
        <MapPin className="h-4 w-4" />
        <span>Photo Location</span>
        <span className="text-white/50">
          ({location.latitudeLabel}, {location.longitudeLabel})
        </span>
      </div>
      <div className="rounded-lg overflow-hidden border border-white/20">
        <iframe
          src={location.openStreetMapEmbedUrl}
          width="300"
          height="200"
          style={{ border: 0 }}
          title="Photo location map"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <a
        href={location.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary/70 hover:text-primary mt-1 inline-block"
        onClick={(event) => event.stopPropagation()}
      >
        {openLabel}
      </a>
    </div>
  );
}
