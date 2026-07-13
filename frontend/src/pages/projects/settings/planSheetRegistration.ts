/**
 * Plan-sheet georeferencing math — pure, no React, fully unit-testable.
 *
 * A registration maps image pixels (x right, y DOWN) to a projected grid
 * (easting, northing in metres) via a 6-parameter affine transform
 * [a, b, c, d, e, f]:
 *
 *   easting  = a*x + b*y + c
 *   northing = d*x + e*y + f
 *
 * This is exactly the payload the backend stores (see PlanSheet.registration and
 * backend/src/routes/planSheets/validation.ts). The image y axis points down,
 * so a north-up drawing needs a reflection — the similarity fit below folds the
 * y-flip in, and the least-squares affine recovers any orientation directly.
 */

export interface RegistrationPoint {
  /** Image pixel X (right). */
  px: number;
  /** Image pixel Y (down). */
  py: number;
  /** Grid easting (metres). */
  easting: number;
  /** Grid northing (metres). */
  northing: number;
}

/** [a, b, c, d, e, f] affine, matching the backend transform convention. */
export type AffineTransform = [number, number, number, number, number, number];

export type RegistrationMode = 'similarity' | 'affine';

export interface PointResidual {
  /** Residual distance for this point, in metres. */
  residualM: number;
}

export interface RegistrationFit {
  ok: true;
  transform: AffineTransform;
  mode: RegistrationMode;
}

export interface RegistrationError {
  ok: false;
  error: string;
}

export type RegistrationResult = RegistrationFit | RegistrationError;

/** Apply an affine to a pixel coordinate → [easting, northing]. */
export function applyTransform(
  transform: AffineTransform,
  px: number,
  py: number,
): [number, number] {
  const [a, b, c, d, e, f] = transform;
  return [a * px + b * py + c, d * px + e * py + f];
}

/**
 * 2-point similarity (Helmert 4-parameter) fit: rotation + uniform scale +
 * translation, with the image y-down → grid north-up flip folded in.
 *
 * We fit a conformal map on the flipped coordinate v = -y, so
 *   easting  =  k*x + m*y + c
 *   northing =  m*x - k*y + f
 * (k = s·cosθ, m = s·sinθ on the flipped frame). Two point pairs give four
 * equations for the four unknowns — an exact solve when the two pixels differ.
 */
export function computeSimilarityTransform(points: RegistrationPoint[]): RegistrationResult {
  if (points.length !== 2) {
    return { ok: false, error: 'A similarity fit needs exactly 2 points.' };
  }
  const [p1, p2] = points;
  const du = p2.px - p1.px;
  const dv = -(p2.py - p1.py); // flip y so north points up
  const det = du * du + dv * dv;
  if (det < 1e-12) {
    return { ok: false, error: 'The two points are at the same pixel — move them apart.' };
  }

  const dE = p2.easting - p1.easting;
  const dN = p2.northing - p1.northing;

  // Solve [du -dv; dv du] [k; m] = [dE; dN] for the conformal coefficients.
  const k = (du * dE + dv * dN) / det;
  const m = (du * dN - dv * dE) / det;

  const v1 = -p1.py;
  // easting  = k*x - m*v + c  → with v = -y: k*x + m*y + c
  const c = p1.easting - (k * p1.px - m * v1);
  // northing = m*x + k*v + f  → with v = -y: m*x - k*y + f
  const f = p1.northing - (m * p1.px + k * v1);

  const transform: AffineTransform = [k, m, c, m, -k, f];
  return { ok: true, transform, mode: 'similarity' };
}

/**
 * Solve a 3×3 linear system A·θ = r by Gaussian elimination with partial
 * pivoting. Returns null when the matrix is singular (collinear design).
 */
function solve3(a: number[][], r: number[]): number[] | null {
  // Work on an augmented copy so the inputs stay untouched.
  const m = a.map((row, i) => [...row, r[i]]);
  const n = 3;

  for (let col = 0; col < n; col++) {
    // Partial pivot: largest magnitude in this column.
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-9) return null; // singular
    [m[col], m[pivot]] = [m[pivot], m[col]];

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k <= n; k++) {
        m[row][k] -= factor * m[col][k];
      }
    }
  }

  return [m[0][3] / m[0][0], m[1][3] / m[1][1], m[2][3] / m[2][2]];
}

/**
 * Least-squares 6-parameter affine fit for 3+ points. The easting row
 * (a, b, c) and northing row (d, e, f) share the same design matrix [x y 1], so
 * we build the normal equations AᵀA once and solve it against each RHS.
 * Collinear (or coincident) points make AᵀA singular → a clear error state, not
 * NaNs.
 */
export function computeAffineLeastSquares(points: RegistrationPoint[]): RegistrationResult {
  if (points.length < 3) {
    return { ok: false, error: 'A least-squares affine fit needs at least 3 points.' };
  }

  // Normal-equation accumulators for the shared design matrix [x, y, 1].
  let sxx = 0;
  let sxy = 0;
  let sx = 0;
  let syy = 0;
  let sy = 0;
  const s1 = points.length;
  // RHS accumulators for easting (E) and northing (N).
  let sxE = 0;
  let syE = 0;
  let sE = 0;
  let sxN = 0;
  let syN = 0;
  let sN = 0;

  for (const p of points) {
    const { px: x, py: y, easting: E, northing: N } = p;
    sxx += x * x;
    sxy += x * y;
    sx += x;
    syy += y * y;
    sy += y;
    sxE += x * E;
    syE += y * E;
    sE += E;
    sxN += x * N;
    syN += y * N;
    sN += N;
  }

  const ata = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, s1],
  ];

  const eastRow = solve3(ata, [sxE, syE, sE]);
  const northRow = solve3(ata, [sxN, syN, sN]);
  if (!eastRow || !northRow) {
    return {
      ok: false,
      error: 'Points are collinear — spread them across the sheet so the fit is solvable.',
    };
  }

  const transform: AffineTransform = [
    eastRow[0],
    eastRow[1],
    eastRow[2],
    northRow[0],
    northRow[1],
    northRow[2],
  ];
  return { ok: true, transform, mode: 'affine' };
}

/** Per-point residual distances (metres) and the RMS residual. */
export function computeResiduals(
  points: RegistrationPoint[],
  transform: AffineTransform,
): { residuals: PointResidual[]; rmsErrorM: number } {
  if (points.length === 0) {
    return { residuals: [], rmsErrorM: 0 };
  }

  let sumSq = 0;
  const residuals = points.map((p) => {
    const [E, N] = applyTransform(transform, p.px, p.py);
    const dE = E - p.easting;
    const dN = N - p.northing;
    const residualM = Math.hypot(dE, dN);
    sumSq += residualM * residualM;
    return { residualM };
  });

  return { residuals, rmsErrorM: Math.sqrt(sumSq / points.length) };
}

/**
 * Full registration: pick the mode from point count (2 → similarity, 3+ →
 * least-squares affine), fit, and attach residuals. This is what the modal
 * saves to the backend.
 */
export function computeRegistration(points: RegistrationPoint[]):
  | {
      ok: true;
      transform: AffineTransform;
      mode: RegistrationMode;
      rmsErrorM: number;
      residuals: PointResidual[];
    }
  | RegistrationError {
  if (points.length < 2) {
    return { ok: false, error: 'Add at least 2 control points to register this sheet.' };
  }

  const fit =
    points.length === 2 ? computeSimilarityTransform(points) : computeAffineLeastSquares(points);

  if (!fit.ok) return fit;

  const { residuals, rmsErrorM } = computeResiduals(points, fit.transform);
  return { ok: true, transform: fit.transform, mode: fit.mode, rmsErrorM, residuals };
}
