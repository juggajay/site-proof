import { describe, expect, it, vi } from 'vitest';

import {
  authorityClassForProjectSettings,
  decisionEligible,
  isLifecycleTerminal,
  projectLatestRound,
  releaseRequestAllowed,
  reRequestable,
} from './roundCore.js';

describe('round predicates', () => {
  it('requires the current open round and notified hold-point status for a decision', () => {
    const openRound = { id: 'round-2', outcome: null, withdrawnAt: null };

    expect(decisionEligible({ status: 'notified', currentRoundId: 'round-2' }, openRound)).toBe(
      true,
    );
    expect(decisionEligible({ status: 'pending', currentRoundId: 'round-2' }, openRound)).toBe(
      false,
    );
    expect(decisionEligible({ status: 'notified', currentRoundId: 'round-1' }, openRound)).toBe(
      false,
    );
    expect(
      decisionEligible(
        { status: 'notified', currentRoundId: 'round-2' },
        { ...openRound, outcome: 'rejected' },
      ),
    ).toBe(false);
    expect(
      decisionEligible(
        { status: 'notified', currentRoundId: 'round-2' },
        { ...openRound, withdrawnAt: new Date() },
      ),
    ).toBe(false);
    expect(decisionEligible({ status: 'notified', currentRoundId: null }, null)).toBe(false);
  });

  it('keeps only released and completed lifecycle-terminal', () => {
    expect(isLifecycleTerminal('released')).toBe(true);
    expect(isLifecycleTerminal('completed')).toBe(true);
    expect(isLifecycleTerminal('pending')).toBe(false);
    expect(isLifecycleTerminal('notified')).toBe(false);
    expect(isLifecycleTerminal('rejected')).toBe(false);
  });

  it('allows re-request only after the latest rejection NCR is closed', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ outcome: 'rejected', linkedNcr: { status: 'open' } })
      .mockResolvedValueOnce({ outcome: 'rejected', linkedNcr: { status: 'closed' } });
    const db = { holdPointDecisionRound: { findFirst } } as never;
    const holdPoint = { id: 'hp-1', status: 'pending' };

    await expect(reRequestable(holdPoint, db)).resolves.toBe(false);
    await expect(reRequestable(holdPoint, db)).resolves.toBe(true);
    await expect(reRequestable({ ...holdPoint, status: 'notified' }, db)).resolves.toBe(false);
    expect(findFirst).toHaveBeenCalledTimes(2);
  });

  it('treats a withdrawn round as pre-request state while preserving the rejection gate', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ withdrawnAt: new Date('2026-08-07T00:00:00.000Z') })
      .mockResolvedValueOnce({ withdrawnAt: null })
      .mockResolvedValueOnce({ outcome: 'rejected', linkedNcr: { status: 'open' } });
    const db = { holdPointDecisionRound: { findFirst } } as never;
    const holdPoint = { id: 'hp-1', status: 'pending' };

    await expect(releaseRequestAllowed(holdPoint, db)).resolves.toBe(true);
    await expect(releaseRequestAllowed(holdPoint, db)).resolves.toBe(false);
    await expect(releaseRequestAllowed({ ...holdPoint, status: 'notified' }, db)).resolves.toBe(
      true,
    );
    expect(findFirst).toHaveBeenCalledTimes(3);
  });
});

describe('round derivation and presentation', () => {
  it('maps superintendent approval to principal authority only', () => {
    expect(
      authorityClassForProjectSettings(JSON.stringify({ hpApprovalRequirement: 'superintendent' })),
    ).toBe('principal');
    expect(authorityClassForProjectSettings(JSON.stringify({ hpApprovalRequirement: 'any' }))).toBe(
      'contractor_internal',
    );
    expect(authorityClassForProjectSettings(null)).toBe('contractor_internal');
  });

  it('projects the latest outcome, NCR and open-condition count null-safely', () => {
    const decidedAt = new Date('2026-08-07T01:02:03.000Z');
    expect(
      projectLatestRound([
        {
          outcome: 'rejected',
          decidedAt,
          decisionReason: 'The submitted evidence does not demonstrate compliance.',
          linkedNcr: { id: 'ncr-1', ncrNumber: 'NCR-0042', status: 'open' },
          _count: { conditions: 2 },
        },
      ]),
    ).toEqual({
      outcome: 'rejected',
      decidedAt,
      decisionReason: 'The submitted evidence does not demonstrate compliance.',
      ncrId: 'ncr-1',
      ncrNumber: 'NCR-0042',
      ncrStatus: 'open',
      openConditionCount: 2,
    });
    expect(projectLatestRound([])).toBeNull();
    expect(projectLatestRound(undefined)).toBeNull();
  });
});
