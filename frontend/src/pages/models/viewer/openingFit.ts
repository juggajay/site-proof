import * as THREE from 'three';

/**
 * Fitting a whole road corridor (kilometres long, metres wide) on screen
 * renders it as a 1px line at ANY tilt — and a winding alignment defeats
 * bounding-box elongation tests (Pacific Ridge sweeps 5.2km x 1.8km in plan,
 * aspect 2.95). So the opening shot is anchored on real ELEMENT POSITIONS:
 * stand at one end of the corridor, frame its ~300m neighbourhood, look along
 * the local alignment direction in 3/4 view.
 */
const COMPACT_PLAN_DIAG_M = 400;
const SEGMENT_RADIUS_M = 150;
const BOX_PAD_M = 20;
const THREE_QUARTER_OFFSET = Math.PI / 5;

export const WHOLE_BOX_AZIMUTH = Math.PI / 4;

export function openingShot(
  modelBox: THREE.Box3,
  positions: THREE.Vector3[],
): { fit: THREE.Box3; azimuth: number } {
  const whole = { fit: modelBox, azimuth: WHOLE_BOX_AZIMUTH };
  const size = modelBox.getSize(new THREE.Vector3());
  if (Math.hypot(size.x, size.z) < COMPACT_PLAN_DIAG_M || positions.length < 10) return whole;

  // Anchor: the element furthest along the dominant plan axis's minimum —
  // one end of the corridor, wherever the alignment wanders in between.
  const alongX = size.x >= size.z;
  let anchor = positions[0];
  for (const position of positions) {
    if ((alongX ? position.x : position.z) < (alongX ? anchor.x : anchor.z)) anchor = position;
  }

  const near = positions.filter(
    (position) => Math.hypot(position.x - anchor.x, position.z - anchor.z) <= SEGMENT_RADIUS_M,
  );
  if (near.length < 5) return whole;

  const fit = new THREE.Box3();
  for (const position of near) fit.expandByPoint(position);
  fit.expandByScalar(BOX_PAD_M);

  // Local alignment direction ~ anchor -> neighbourhood centroid. The camera
  // sits behind the anchor looking down the corridor, offset for a 3/4 view.
  const centroid = near
    .reduce((sum, position) => sum.add(position), new THREE.Vector3())
    .divideScalar(near.length);
  const directionX = centroid.x - anchor.x;
  const directionZ = centroid.z - anchor.z;
  const length = Math.hypot(directionX, directionZ);
  if (length < 1) return { fit, azimuth: WHOLE_BOX_AZIMUTH };
  const azimuth = Math.atan2(-directionX / length, -directionZ / length) + THREE_QUARTER_OFFSET;
  return { fit, azimuth };
}
