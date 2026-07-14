// Workbox runtime-caching rules that make the lot map degrade gracefully
// offline: tiles, plan-sheet rasters, and map data the user has already
// viewed are served from a device-local cache when the network drops.
// Imported by vite.config.ts into the existing VitePWA service worker.
//
// Licence constraint (MapTiler Cloud terms §5.7/§6.3, checked 2026-07-14):
// a temporary personal cache per end-user is allowed; batch/bulk tile
// download is prohibited. These rules only ever cache tiles the user has
// actually requested, with hard entry and age caps. Never add prefetching
// of unviewed areas here without a written MapTiler agreement.

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;
const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

// Satellite (MapTiler) and street (OSM) tiles requested by the Leaflet base
// layers in LotMapView. Cross-origin, so the pattern must match from the
// start of the URL (Workbox RegExpRoute rule).
export const MAP_TILE_URL =
  /^https:\/\/(?:api\.maptiler\.com\/maps\/satellite\/|[abc]\.tile\.openstreetmap\.org\/)/;

// Registered plan-sheet rasters (usePlanOverlayImage / usePlanSheetImage).
// Immutable per sheet id — re-registration changes corner metadata, not the
// image — so cache-first is safe and also skips multi-MB re-downloads.
export const PLAN_SHEET_IMAGE_URL =
  /^https?:\/\/[^/]+\/api\/projects\/[^/]+\/plan-sheets\/[^/]+\/image(?:\?.*)?$/;

// Map data reads: project lot geometries, single-lot geometries, control
// lines, plan-sheet list, status timeline. Network-first so fresh data always
// wins; the cache only answers when the network is down or slow. Workbox
// routes match GET only by default, so the POST to /api/lots/:id/geometries
// (draw-lot save) is untouched.
export const MAP_DATA_URL =
  /^https?:\/\/[^/]+\/api\/(?:projects\/[^/]+\/(?:lot-geometries|control-lines|plan-sheets|lots\/status-timeline)|lots\/[^/]+\/geometries)(?:\?.*)?$/;

export const MAP_TILES_CACHE = 'civos-map-tiles';
export const PLAN_SHEET_IMAGES_CACHE = 'civos-plan-sheet-images';
export const MAP_DATA_CACHE = 'civos-map-data';

// These caches hold responses to authenticated API requests, keyed by URL
// only — lib/auth.tsx deletes them on sign-out/user-switch so they cannot
// leak to the next account on a shared device. Tiles are public imagery.
export const AUTHED_MAP_CACHES = [PLAN_SHEET_IMAGES_CACHE, MAP_DATA_CACHE];

export const mapRuntimeCaching = [
  {
    urlPattern: MAP_TILE_URL,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: MAP_TILES_CACHE,
      expiration: {
        maxEntries: 1500,
        maxAgeSeconds: THIRTY_DAYS_SECONDS,
        purgeOnQuotaError: true,
      },
      // Tiles load with crossOrigin="anonymous" so responses are normally
      // status 200; keep 0 (opaque) tolerated in case a layer ever drops it.
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    urlPattern: PLAN_SHEET_IMAGE_URL,
    handler: 'CacheFirst' as const,
    options: {
      cacheName: PLAN_SHEET_IMAGES_CACHE,
      expiration: {
        maxEntries: 40,
        maxAgeSeconds: THIRTY_DAYS_SECONDS,
        purgeOnQuotaError: true,
      },
      cacheableResponse: { statuses: [200] },
    },
  },
  {
    urlPattern: MAP_DATA_URL,
    handler: 'NetworkFirst' as const,
    options: {
      cacheName: MAP_DATA_CACHE,
      networkTimeoutSeconds: 4,
      expiration: {
        maxEntries: 80,
        maxAgeSeconds: SEVEN_DAYS_SECONDS,
        purgeOnQuotaError: true,
      },
      cacheableResponse: { statuses: [200] },
    },
  },
];
