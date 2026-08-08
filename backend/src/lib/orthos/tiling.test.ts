import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { orthoTileObjectRef, orthoTileStorageRoot } from '../models/modelObjectStore.js';
import { parseGdalInfo, zoomBandFromPixelSize, type GdalInfoJson } from './tiling.js';

const fixtureUrl = new URL('./fixtures/camino-gdalinfo.json', import.meta.url);

describe('orthophoto tiling metadata', () => {
  it('derives the capped seven-level zoom band from the real Camino pixel size', async () => {
    const fixture = JSON.parse(await fs.promises.readFile(fixtureUrl, 'utf8')) as GdalInfoJson;
    expect(parseGdalInfo(fixture)).toEqual({
      boundsWgs84: [-90.2984, 19.392, -90.2847, 19.3934],
      minZoom: 16,
      maxZoom: 22,
      gsdCmPerPx: 2.2,
    });
    expect(zoomBandFromPixelSize(0.5)).toEqual({ minZoom: 12, maxZoom: 18 });
  });

  it('ignores the degree-unit geoTransform of a geographic CRS (Buljarica field bug)', async () => {
    // A GEOGCRS WKT still contains ELLIPSOID[..., LENGTHUNIT["metre",1]], so a
    // unit-only match reads degrees-per-pixel as metres and collapses the GSD
    // to ~0. The parser must fall back to bounds/raster-size for the real GSD.
    const fixture = JSON.parse(await fs.promises.readFile(fixtureUrl, 'utf8')) as GdalInfoJson;
    const geographic: GdalInfoJson = {
      ...fixture,
      size: [4800, 3200],
      geoTransform: [18.995, 0.0000003, 0, 42.2026, 0, -0.0000003],
      coordinateSystem: {
        wkt: 'GEOGCRS["WGS 84",DATUM["World Geodetic System 1984",ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]]],CS[ellipsoidal,2],AXIS["latitude",north],AXIS["longitude",east],ANGLEUNIT["degree",0.0174532925199433]]',
      },
      wgs84Extent: {
        type: 'Polygon',
        coordinates: [
          [
            [18.9951, 42.1791],
            [18.9969, 42.1791],
            [18.9969, 42.2026],
            [18.9951, 42.2026],
            [18.9951, 42.1791],
          ],
        ],
      },
    };
    const parsed = parseGdalInfo(geographic);
    expect(parsed.gsdCmPerPx).toBeGreaterThan(0);
    expect(parsed.maxZoom).toBeLessThanOrEqual(22);
  });

  it('rejects missing CRS and absurd world-sized bounds', async () => {
    const fixture = JSON.parse(await fs.promises.readFile(fixtureUrl, 'utf8')) as GdalInfoJson;
    expect(() => parseGdalInfo({ ...fixture, coordinateSystem: undefined })).toThrow(
      /no coordinate/i,
    );
    expect(() =>
      parseGdalInfo({
        ...fixture,
        wgs84Extent: {
          type: 'Polygon',
          coordinates: [
            [
              [-179, -80],
              [179, -80],
              [179, 80],
              [-179, 80],
              [-179, -80],
            ],
          ],
        },
      }),
    ).toThrow(/absurd/i);
  });

  it('builds only integer XYZ paths beneath the owned tile root', () => {
    const root = orthoTileStorageRoot('project-id', 'ortho-id');
    expect(orthoTileObjectRef(root, 18, 201234, 130456)).toBe(
      'ortho/project-id/ortho-id/tiles/18/201234/130456.png',
    );
    expect(() => orthoTileObjectRef(root, 18, 1.5, 2)).toThrow(/integer/);
  });
});
