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
