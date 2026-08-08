import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { openingBoxAndAzimuth } from './openingFit';

const box = (w: number, h: number, d: number) =>
  new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(w, h, d));

describe('openingBoxAndAzimuth', () => {
  it('keeps the whole box and the default 3/4 view for a compact model', () => {
    const compact = box(80, 20, 60);
    const { fit, azimuth } = openingBoxAndAzimuth(compact);
    expect(fit).toBe(compact);
    expect(azimuth).toBeCloseTo(Math.PI / 4);
  });

  it('frames a capped start segment of an X-long corridor, camera looking down +X', () => {
    // Pacific Ridge scale: 5,638m long, ~20m wide. 15% would still be an
    // 845m sliver; the cap keeps the carriageway readable at fit distance.
    const corridor = box(5638, 12, 20);
    const { fit, azimuth } = openingBoxAndAzimuth(corridor);
    expect(fit.max.x - fit.min.x).toBe(300);
    expect(fit.min.x).toBe(0);
    // Full width/height kept — only the long axis is trimmed.
    expect(fit.max.z - fit.min.z).toBe(20);
    expect(azimuth).toBeCloseTo(-Math.PI / 2 + Math.PI / 5);
  });

  it('frames a Z-long corridor with the Z-facing azimuth', () => {
    const corridor = box(20, 12, 1000);
    const { fit, azimuth } = openingBoxAndAzimuth(corridor);
    expect(fit.max.z - fit.min.z).toBeCloseTo(150);
    expect(fit.max.x - fit.min.x).toBe(20);
    expect(azimuth).toBeCloseTo(Math.PI + Math.PI / 5);
  });

  it('does not mutate the input box when trimming', () => {
    const corridor = box(5638, 12, 20);
    openingBoxAndAzimuth(corridor);
    expect(corridor.max.x).toBe(5638);
  });
});
