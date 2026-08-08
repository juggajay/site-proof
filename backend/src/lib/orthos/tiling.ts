import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const WEB_MERCATOR_INITIAL_RESOLUTION = 156543.03392804097;
const WEB_MERCATOR_RADIUS = 6378137;
const MAX_ORTHO_SPAN_DEGREES = 20;

export interface GdalInfoJson {
  readonly size?: unknown;
  readonly coordinateSystem?: unknown;
  readonly geoTransform?: unknown;
  readonly wgs84Extent?: unknown;
}

export interface ParsedGdalInfo {
  readonly boundsWgs84: [number, number, number, number];
  readonly minZoom: number;
  readonly maxZoom: number;
  readonly gsdCmPerPx: number;
}

export interface GdalExecutionResult {
  readonly stdout: string;
  readonly stderr: string;
}

export type GdalExecutor = (
  executable: string,
  args: readonly string[],
  options: { cwd: string },
) => Promise<GdalExecutionResult>;

export interface OrthoTileFile {
  readonly absolutePath: string;
  readonly z: number;
  readonly x: number;
  readonly y: number;
}

export interface OrthoTilingResult extends ParsedGdalInfo {
  readonly gdalInfoMs: number;
  readonly tileMs: number;
  readonly tiles: OrthoTileFile[];
}

function collectPositions(value: unknown, output: [number, number][]): void {
  if (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    output.push([value[0], value[1]]);
    return;
  }
  if (Array.isArray(value)) for (const child of value) collectPositions(child, output);
}

function readBoundsWgs84(value: unknown): [number, number, number, number] {
  const coordinates =
    value && typeof value === 'object' && 'coordinates' in value
      ? (value as { coordinates: unknown }).coordinates
      : null;
  const positions: [number, number][] = [];
  collectPositions(coordinates, positions);
  if (positions.length < 4) throw new Error('gdalinfo did not return a usable WGS84 extent');

  const west = Math.min(...positions.map(([x]) => x));
  const south = Math.min(...positions.map(([, y]) => y));
  const east = Math.max(...positions.map(([x]) => x));
  const north = Math.max(...positions.map(([, y]) => y));
  if (
    ![west, south, east, north].every(Number.isFinite) ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90 ||
    east <= west ||
    north <= south ||
    east - west > MAX_ORTHO_SPAN_DEGREES ||
    north - south > MAX_ORTHO_SPAN_DEGREES
  ) {
    throw new Error('gdalinfo returned non-finite, zero-area, or absurd WGS84 bounds');
  }
  return [west, south, east, north];
}

function hasCoordinateSystem(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const coordinateSystem = value as { wkt?: unknown; projjson?: unknown };
  return (
    (typeof coordinateSystem.wkt === 'string' && coordinateSystem.wkt.trim().length > 0) ||
    (coordinateSystem.projjson !== null && typeof coordinateSystem.projjson === 'object')
  );
}

function mercatorY(latitude: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  return WEB_MERCATOR_RADIUS * Math.log(Math.tan(Math.PI / 4 + (clamped * Math.PI) / 360));
}

function projectedPixelSize(info: GdalInfoJson, bounds: [number, number, number, number]): number {
  if (Array.isArray(info.geoTransform) && info.geoTransform.length >= 6) {
    const transform = info.geoTransform.map(Number);
    const pixelAxis = Math.hypot(transform[1], transform[4]);
    const lineAxis = Math.hypot(transform[2], transform[5]);
    const wkt = (info.coordinateSystem as { wkt?: unknown } | undefined)?.wkt;
    // A geographic CRS's WKT still contains LENGTHUNIT["metre"] inside its
    // ELLIPSOID definition, so unit-matching alone reads degrees as metres.
    // Trust the geoTransform only for a projected, metre-based CRS.
    const metreBased =
      typeof wkt === 'string' &&
      /^\s*PROJ(?:CRS|CS)\b/i.test(wkt) &&
      /(?:LENGTHUNIT|UNIT)\[\s*"(?:metre|meter)"/i.test(wkt);
    if (metreBased && pixelAxis > 0 && lineAxis > 0) return Math.max(pixelAxis, lineAxis);
  }

  const size = Array.isArray(info.size) ? info.size.map(Number) : [];
  if (
    size.length < 2 ||
    !Number.isSafeInteger(size[0]) ||
    !Number.isSafeInteger(size[1]) ||
    size[0] <= 0 ||
    size[1] <= 0
  ) {
    throw new Error('gdalinfo did not return a valid raster size or pixel size');
  }
  const [west, south, east, north] = bounds;
  const widthM = (WEB_MERCATOR_RADIUS * ((east - west) * Math.PI)) / 180;
  const heightM = Math.abs(mercatorY(north) - mercatorY(south));
  const fallback = Math.max(widthM / size[0], heightM / size[1]);
  if (!Number.isFinite(fallback) || fallback <= 0) {
    throw new Error('gdalinfo pixel size is not finite or positive');
  }
  return fallback;
}

export function zoomBandFromPixelSize(pixelSizeM: number): { minZoom: number; maxZoom: number } {
  if (!Number.isFinite(pixelSizeM) || pixelSizeM <= 0) {
    throw new Error('Pixel size must be finite and positive');
  }
  const maxZoom = Math.min(
    22,
    Math.max(0, Math.floor(Math.log2(WEB_MERCATOR_INITIAL_RESOLUTION / pixelSizeM))),
  );
  return { minZoom: Math.max(0, maxZoom - 6), maxZoom };
}

export function parseGdalInfo(info: GdalInfoJson): ParsedGdalInfo {
  if (!hasCoordinateSystem(info.coordinateSystem)) {
    throw new Error('Orthophoto has no coordinate reference system');
  }
  const boundsWgs84 = readBoundsWgs84(info.wgs84Extent);
  const pixelSizeM = projectedPixelSize(info, boundsWgs84);
  const zoom = zoomBandFromPixelSize(pixelSizeM);
  return {
    boundsWgs84,
    ...zoom,
    gsdCmPerPx: Math.round(pixelSizeM * 1000) / 10,
  };
}

export const executeGdal: GdalExecutor = async (executable, args, options) => {
  const result = await execFileAsync(executable, [...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return { stdout: result.stdout, stderr: result.stderr };
};

export async function listOrthoTileFiles(outputDirectory: string): Promise<OrthoTileFile[]> {
  const tiles: OrthoTileFile[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile()) {
        const relative = path.relative(outputDirectory, absolutePath).replaceAll('\\', '/');
        const match = /^(\d+)\/(\d+)\/(\d+)\.png$/.exec(relative);
        if (match)
          tiles.push({
            absolutePath,
            z: Number(match[1]),
            x: Number(match[2]),
            y: Number(match[3]),
          });
      }
    }
  };
  await visit(outputDirectory);
  return tiles.sort((left, right) => left.z - right.z || left.x - right.x || left.y - right.y);
}

export async function runOrthoTiling(params: {
  sourcePath: string;
  outputDirectory: string;
  cwd: string;
  runGdal?: GdalExecutor;
}): Promise<OrthoTilingResult> {
  const runGdal = params.runGdal ?? executeGdal;
  const infoStartedAt = Date.now();
  const infoResult = await runGdal('gdalinfo', ['-json', params.sourcePath], { cwd: params.cwd });
  let info: GdalInfoJson;
  try {
    info = JSON.parse(infoResult.stdout) as GdalInfoJson;
  } catch {
    throw new Error('gdalinfo returned invalid JSON');
  }
  const parsed = parseGdalInfo(info);
  const gdalInfoMs = Date.now() - infoStartedAt;

  await fs.promises.mkdir(params.outputDirectory, { recursive: true });
  const tileStartedAt = Date.now();
  // ponytail: gdal2tiles.py on distro GDAL 3.6; swap to `gdal raster tile`
  // when the base image reaches GDAL >= 3.11.
  await runGdal(
    'gdal2tiles.py',
    [
      '--xyz',
      '--processes=4',
      // ponytail: --exclude-transparent needs GDAL >= 3.9; Debian bookworm ships
      // 3.6. Blank edge tiles cost pennies of storage — add back on upgrade.
      '--resume',
      `--zoom=${parsed.minZoom}-${parsed.maxZoom}`,
      '--webviewer=none',
      params.sourcePath,
      params.outputDirectory,
    ],
    { cwd: params.cwd },
  );
  const tileMs = Date.now() - tileStartedAt;
  const tiles = await listOrthoTileFiles(params.outputDirectory);
  if (tiles.length === 0) throw new Error('GDAL produced no image tiles');
  return { ...parsed, gdalInfoMs, tileMs, tiles };
}
