import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { WHOLE_BOX_AZIMUTH, openingShot } from './openingFit';

function boxOf(positions: THREE.Vector3[]): THREE.Box3 {
  const box = new THREE.Box3();
  for (const position of positions) box.expandByPoint(position);
  return box;
}

/** Elements every 20m along a parametric plan curve, y jittered like a road. */
function corridor(lengthM: number, curve: (t: number) => [number, number]): THREE.Vector3[] {
  const positions: THREE.Vector3[] = [];
  for (let distance = 0; distance <= lengthM; distance += 20) {
    const [x, z] = curve(distance / lengthM);
    positions.push(new THREE.Vector3(x, (distance % 100) / 50, z));
  }
  return positions;
}

describe('openingShot', () => {
  it('keeps the whole box and default 3/4 azimuth for a compact model', () => {
    const positions = corridor(200, (t) => [t * 200, t * 100]);
    const modelBox = boxOf(positions);
    const shot = openingShot(modelBox, positions);
    expect(shot.fit).toBe(modelBox);
    expect(shot.azimuth).toBe(WHOLE_BOX_AZIMUTH);
  });

  it('frames a ~300m end segment of a straight X-corridor, looking down +X', () => {
    const positions = corridor(5000, (t) => [t * 5000, 0]);
    const shot = openingShot(boxOf(positions), positions);
    const size = shot.fit.getSize(new THREE.Vector3());
    expect(size.x).toBeLessThanOrEqual(150 + 2 * 20);
    expect(shot.fit.min.x).toBeLessThanOrEqual(0);
    // Look direction +X → azimuth atan2(-1, 0) + π/5.
    expect(shot.azimuth).toBeCloseTo(-Math.PI / 2 + Math.PI / 5, 5);
  });

  it('frames an end segment of the Pacific Ridge S-curve (plan aspect ~3, defeats box tests)', () => {
    // Real demo extent: 5,229m east x 1,770m north over a 5,639m alignment.
    const positions = corridor(5639, (t) => [t * 5229, Math.sin(t * Math.PI * 2) * 885 + 885]);
    const modelBox = boxOf(positions);
    const planAspect = 5229 / 1770;
    expect(planAspect).toBeLessThan(6); // the old bounding-box test would fall back

    const shot = openingShot(modelBox, positions);
    expect(shot.fit).not.toBe(modelBox);
    const size = shot.fit.getSize(new THREE.Vector3());
    expect(Math.hypot(size.x, size.z)).toBeLessThan(500);
    // The framed segment contains real elements (the anchor at minimum-X end).
    expect(shot.fit.containsPoint(positions[0])).toBe(true);
    expect(Number.isFinite(shot.azimuth)).toBe(true);
  });

  it('falls back to the whole box when there are too few elements', () => {
    const sparse = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(5000, 0, 0)];
    const modelBox = boxOf(sparse);
    const shot = openingShot(modelBox, sparse);
    expect(shot.fit).toBe(modelBox);
    expect(shot.azimuth).toBe(WHOLE_BOX_AZIMUTH);
  });
});
