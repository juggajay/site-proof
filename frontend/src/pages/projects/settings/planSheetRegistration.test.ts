import { describe, expect, it } from 'vitest';

import {
  applyTransform,
  computeAffineLeastSquares,
  computeRegistration,
  computeResiduals,
  computeSimilarityTransform,
  type AffineTransform,
  type RegistrationPoint,
} from './planSheetRegistration';

// A known similarity: rotation 30°, scale 0.5, translation, with the image
// y-down → grid north-up flip. Built directly in the backend affine convention
// so the solvers must reproduce it.
//   easting  =  k*x + m*y + c
//   northing =  m*x - k*y + f    (note the -k: reflection for the y flip)
const THETA = (30 * Math.PI) / 180;
const SCALE = 0.5;
const K = SCALE * Math.cos(THETA);
const M = SCALE * Math.sin(THETA);
const C = 500_000;
const F = 6_250_000;
const KNOWN_SIMILARITY: AffineTransform = [K, M, C, M, -K, F];

function gridFor(transform: AffineTransform, px: number, py: number): RegistrationPoint {
  const [easting, northing] = applyTransform(transform, px, py);
  return { px, py, easting, northing };
}

describe('computeSimilarityTransform (2 points)', () => {
  it('recovers a known rotation+scale+y-flip similarity exactly', () => {
    const points = [gridFor(KNOWN_SIMILARITY, 100, 200), gridFor(KNOWN_SIMILARITY, 3900, 2600)];
    const fit = computeSimilarityTransform(points);

    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    expect(fit.mode).toBe('similarity');
    fit.transform.forEach((v, i) => expect(v).toBeCloseTo(KNOWN_SIMILARITY[i], 6));

    // Round-trip a third, unseen pixel through the recovered transform.
    const check = gridFor(KNOWN_SIMILARITY, 2000, 1500);
    const [E, N] = applyTransform(fit.transform, check.px, check.py);
    expect(E).toBeCloseTo(check.easting, 6);
    expect(N).toBeCloseTo(check.northing, 6);

    const { rmsErrorM } = computeResiduals(points, fit.transform);
    expect(rmsErrorM).toBeLessThan(1e-6);
  });

  it('rejects two coincident pixels', () => {
    const fit = computeSimilarityTransform([
      { px: 10, py: 10, easting: 0, northing: 0 },
      { px: 10, py: 10, easting: 5, northing: 5 },
    ]);
    expect(fit.ok).toBe(false);
  });

  it('rejects a point count other than 2', () => {
    expect(computeSimilarityTransform([]).ok).toBe(false);
  });
});

describe('computeAffineLeastSquares (3+ points)', () => {
  it('recovers a known general affine (with shear) exactly', () => {
    // A non-conformal affine only the LSQ fit can represent.
    const known: AffineTransform = [0.42, 0.05, 500_000, -0.03, -0.48, 6_250_000];
    const points = [
      gridFor(known, 0, 0),
      gridFor(known, 4000, 0),
      gridFor(known, 4000, 3000),
      gridFor(known, 0, 3000),
    ];
    const fit = computeAffineLeastSquares(points);

    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    expect(fit.mode).toBe('affine');
    fit.transform.forEach((v, i) => expect(v).toBeCloseTo(known[i], 6));
    expect(computeResiduals(points, fit.transform).rmsErrorM).toBeLessThan(1e-6);
  });

  it('produces nonzero residuals for a noisy over-determined fit', () => {
    const known: AffineTransform = [0.5, 0, 1000, 0, -0.5, 2000];
    // 4 points with a small perturbation on the easting of one → real residual.
    const points = [
      gridFor(known, 0, 0),
      gridFor(known, 1000, 0),
      gridFor(known, 1000, 1000),
      gridFor(known, 0, 1000),
    ];
    points[2] = { ...points[2], easting: points[2].easting + 3 };

    const fit = computeAffineLeastSquares(points);
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    const { rmsErrorM } = computeResiduals(points, fit.transform);
    expect(rmsErrorM).toBeGreaterThan(0.1);
    expect(rmsErrorM).toBeLessThan(3); // the fit spreads the 3 m error out
  });

  it('returns an error state for collinear points instead of NaNs', () => {
    const known: AffineTransform = [0.5, 0, 0, 0, -0.5, 0];
    const points = [
      gridFor(known, 0, 0),
      gridFor(known, 1000, 0),
      gridFor(known, 2000, 0), // all on y = 0
    ];
    const fit = computeAffineLeastSquares(points);
    expect(fit.ok).toBe(false);
    if (fit.ok) return;
    expect(fit.error).toMatch(/collinear/i);
  });
});

describe('computeRegistration (mode selection)', () => {
  it('uses similarity for 2 points and affine for 3+', () => {
    const two = [gridFor(KNOWN_SIMILARITY, 0, 0), gridFor(KNOWN_SIMILARITY, 1000, 800)];
    const twoFit = computeRegistration(two);
    expect(twoFit.ok && twoFit.mode).toBe('similarity');

    const three = [
      gridFor(KNOWN_SIMILARITY, 0, 0),
      gridFor(KNOWN_SIMILARITY, 1000, 0),
      gridFor(KNOWN_SIMILARITY, 0, 1000),
    ];
    const threeFit = computeRegistration(three);
    expect(threeFit.ok && threeFit.mode).toBe('affine');
    if (threeFit.ok) expect(threeFit.rmsErrorM).toBeLessThan(1e-6);
  });

  it('needs at least 2 points', () => {
    expect(computeRegistration([]).ok).toBe(false);
    expect(computeRegistration([{ px: 0, py: 0, easting: 0, northing: 0 }]).ok).toBe(false);
  });
});
