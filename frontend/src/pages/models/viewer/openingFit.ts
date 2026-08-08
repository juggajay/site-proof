import * as THREE from 'three';

/**
 * Fitting a whole road corridor (kilometres long, metres wide) on screen
 * renders it as a 1px line at ANY tilt — the opening shot must frame a
 * segment of an elongated model instead, looking down the alignment.
 *
 * ponytail: axis-aligned elongation only; a corridor running diagonally in
 * plan has a square bounding box and falls back to the whole-box fit.
 */
const CORRIDOR_ASPECT = 6;

export function openingBoxAndAzimuth(box: THREE.Box3): { fit: THREE.Box3; azimuth: number } {
  const size = box.getSize(new THREE.Vector3());
  const planLong = Math.max(size.x, size.z);
  const planShort = Math.max(1, Math.min(size.x, size.z));
  if (planLong / planShort < CORRIDOR_ASPECT) return { fit: box, azimuth: Math.PI / 4 };
  // 150–300m of alignment: at fit distance the carriageway spans a readable
  // ~8% of screen width. 15% of a long corridor would still be a sliver.
  const segment = Math.min(300, Math.max(150, planLong * 0.15));
  const fit = box.clone();
  if (size.x >= size.z) {
    fit.max.x = box.min.x + segment;
    // Camera on the -X side looking toward +X, offset for a 3/4 view.
    return { fit, azimuth: -Math.PI / 2 + Math.PI / 5 };
  }
  fit.max.z = box.min.z + segment;
  return { fit, azimuth: Math.PI + Math.PI / 5 };
}
