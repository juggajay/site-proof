import { describe, it, expect } from 'vitest';
import { deriveNcrGates, NCR_GATE_KEYS } from './ncrGateStrip';
import type { NCR } from './types';

// Midday UTC so the rendered date is the same calendar day in AEST and in the
// CI runner's timezone.
const RESPONDED_AT = '2026-07-14T12:00:00.000Z';
const REVIEWED_AT = '2026-07-15T12:00:00.000Z';
const RECTIFIED_AT = '2026-07-16T12:00:00.000Z';
const CLOSED_AT = '2026-07-17T12:00:00.000Z';

function makeNcr(overrides: Partial<NCR> = {}): NCR {
  return {
    id: 'ncr-1',
    ncrNumber: 'NCR-0001',
    description: 'Kerb out of tolerance',
    category: 'workmanship',
    severity: 'minor',
    status: 'open',
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Jay Ryan', email: 'jay@example.com' },
    createdAt: '2026-07-13T12:00:00.000Z',
    project: { name: 'Soaring Heights', projectNumber: 'SH-01' },
    ncrLots: [],
    ...overrides,
  };
}

const stateOf = (ncr: NCR, key: string) =>
  deriveNcrGates(ncr).find((gate) => gate.key === key)?.state;
const detailOf = (ncr: NCR, key: string) =>
  deriveNcrGates(ncr).find((gate) => gate.key === key)?.detail;

describe('deriveNcrGates', () => {
  it('returns the four gates in lifecycle order', () => {
    expect(deriveNcrGates(makeNcr()).map((gate) => gate.key)).toEqual([...NCR_GATE_KEYS]);
  });

  it('shows every gate pending on a freshly raised NCR', () => {
    const gates = deriveNcrGates(makeNcr());
    expect(gates.every((gate) => gate.state === 'pending')).toBe(true);
    expect(gates[0]?.detail).toBe('Responded · not yet');
  });

  it('fills a gate once its timestamp exists', () => {
    const ncr = makeNcr({ status: 'investigating', responseSubmittedAt: RESPONDED_AT });
    expect(stateOf(ncr, 'responded')).toBe('done');
    expect(detailOf(ncr, 'responded')).toBe('Responded · 14/07/2026');
    expect(stateOf(ncr, 'reviewed')).toBe('pending');
  });

  it('attributes the close to whoever closed it', () => {
    const ncr = makeNcr({
      status: 'closed',
      responseSubmittedAt: RESPONDED_AT,
      qmReviewedAt: REVIEWED_AT,
      rectificationSubmittedAt: RECTIFIED_AT,
      closedAt: CLOSED_AT,
      closedBy: { fullName: 'Sam Quality', email: 'sam@example.com' },
    });
    expect(detailOf(ncr, 'closed')).toBe('Closed by Sam Quality · 17/07/2026');
  });

  it('falls back to the closer email when no full name is stored', () => {
    const ncr = makeNcr({
      status: 'closed',
      closedAt: CLOSED_AT,
      closedBy: { fullName: '', email: 'sam@example.com' },
    });
    expect(detailOf(ncr, 'closed')).toBe('Closed by sam@example.com · 17/07/2026');
  });

  // Legacy and imported NCRs reach a terminal status with earlier gates blank.
  // Rendering those as "pending" would claim someone still owes work on a
  // finished record.
  it('marks unfilled gates on a closed NCR as not required, never pending', () => {
    const ncr = makeNcr({ status: 'closed', closedAt: CLOSED_AT });
    expect(stateOf(ncr, 'responded')).toBe('not_required');
    expect(stateOf(ncr, 'reviewed')).toBe('not_required');
    expect(stateOf(ncr, 'rectified')).toBe('not_required');
    expect(stateOf(ncr, 'closed')).toBe('done');
    expect(detailOf(ncr, 'responded')).toBe('Responded · not recorded');
  });

  it('treats a concession close as terminal too', () => {
    const ncr = makeNcr({ status: 'closed_concession', closedAt: CLOSED_AT });
    expect(stateOf(ncr, 'rectified')).toBe('not_required');
  });

  // Requesting a revision clears responseSubmittedAt and sends the NCR back to
  // `open` while leaving qmReviewedAt set — gates can fill out of order.
  it('handles the revision path, where Reviewed is done but Responded is not', () => {
    const ncr = makeNcr({ status: 'open', responseSubmittedAt: null, qmReviewedAt: REVIEWED_AT });
    expect(stateOf(ncr, 'responded')).toBe('pending');
    expect(stateOf(ncr, 'reviewed')).toBe('done');
  });

  it('says why a major NCR cannot be closed yet', () => {
    const ncr = makeNcr({
      status: 'verification',
      severity: 'major',
      qmApprovalRequired: true,
      qmApprovedAt: null,
      rectificationSubmittedAt: RECTIFIED_AT,
    });
    expect(detailOf(ncr, 'closed')).toBe('Closed · blocked, awaiting QM approval');
  });

  it('drops the blocked note once QM approval is granted', () => {
    const ncr = makeNcr({
      status: 'verification',
      severity: 'major',
      qmApprovalRequired: true,
      qmApprovedAt: '2026-07-16T12:00:00.000Z',
      rectificationSubmittedAt: RECTIFIED_AT,
    });
    expect(detailOf(ncr, 'closed')).toBe('Closed · not yet');
  });

  // A minor NCR never needs QM approval, so it must never carry the note.
  it('never blocks a minor NCR on QM approval', () => {
    const ncr = makeNcr({ status: 'verification', qmApprovalRequired: true });
    expect(detailOf(ncr, 'closed')).toBe('Closed · not yet');
  });
});
