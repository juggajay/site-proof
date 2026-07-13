import { describe, expect, it } from 'vitest';

import { computeCornersWgs84 } from './corners.js';

describe('computeCornersWgs84', () => {
  it('returns null without a registration', () => {
    expect(computeCornersWgs84(null, 100, 50, 'EPSG:7856')).toBeNull();
    expect(computeCornersWgs84({ transform: [1, 0, 0] }, 100, 50, 'EPSG:7856')).toBeNull();
  });

  it('projects the four pixel corners through the affine (WGS84 passthrough)', () => {
    // With coordinateSystem EPSG:4326, localToWgs84 is the identity, so grid
    // easting/northing come straight through as lng/lat. That makes the corner
    // math hand-computable:
    //   easting  = 1*px + 0*py + 150   (= 150 + px)
    //   northing = 0*px - 1*py - 33    (= -33 - py, y-DOWN flip)
    // Image 10 wide × 5 tall.
    const corners = computeCornersWgs84({ transform: [1, 0, 150, 0, -1, -33] }, 10, 5, 'EPSG:4326');

    expect(corners).not.toBeNull();
    expect(corners!.topLeft).toEqual([150, -33]); // (0,0)
    expect(corners!.topRight).toEqual([160, -33]); // (10,0)
    expect(corners!.bottomRight).toEqual([160, -38]); // (10,5)
    expect(corners!.bottomLeft).toEqual([150, -38]); // (0,5)
  });
});
