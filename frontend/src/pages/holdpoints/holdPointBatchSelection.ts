import type { HoldPoint } from './types';

export function isHoldPointBatchRequestReady(holdPoint: HoldPoint): boolean {
  return holdPoint.canRequestRelease !== false;
}
