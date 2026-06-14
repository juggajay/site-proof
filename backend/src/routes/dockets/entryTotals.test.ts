import { describe, expect, it, vi } from 'vitest';
import {
  lockEditableDocketForEntryMutation,
  lockDocketForEntryMutation,
  refreshLabourSubmittedTotals,
  refreshPlantSubmittedTotals,
  type DocketEntryMutationTx,
} from './entryTotals.js';

// These helpers receive a Prisma transaction client (`tx`) by parameter and
// only ever touch it — there is no module-level `prisma` and no real
// connection — so they are characterized here with hand-rolled mock
// transaction objects (DB-free). Each mock exposes only the surface the helper
// under test actually uses, cast through `unknown` to DocketEntryMutationTx.

type LabourAggregate = {
  _sum: { submittedHours: number | null; submittedCost: number | null };
};
type PlantAggregate = {
  _sum: { hoursOperated: number | null; submittedCost: number | null };
};

function makeLabourTx(aggregate: LabourAggregate) {
  const update = vi.fn().mockResolvedValue({});
  const aggregateFn = vi.fn().mockResolvedValue(aggregate);
  const tx = {
    docketLabour: { aggregate: aggregateFn },
    dailyDocket: { update },
  } as unknown as DocketEntryMutationTx;
  return { tx, aggregateFn, update };
}

function makePlantTx(aggregate: PlantAggregate) {
  const update = vi.fn().mockResolvedValue({});
  const aggregateFn = vi.fn().mockResolvedValue(aggregate);
  const tx = {
    docketPlant: { aggregate: aggregateFn },
    dailyDocket: { update },
  } as unknown as DocketEntryMutationTx;
  return { tx, aggregateFn, update };
}

describe('docket entry totals helpers (pure, DB-free)', () => {
  describe('refreshLabourSubmittedTotals', () => {
    it('coerces null aggregate sums to 0 and writes totalLabourSubmitted = 0', async () => {
      const { tx, update } = makeLabourTx({
        _sum: { submittedHours: null, submittedCost: null },
      });

      const result = await refreshLabourSubmittedTotals(tx, 'd1');

      expect(result).toEqual({ hours: 0, cost: 0 });
      expect(update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { totalLabourSubmitted: 0 },
      });
    });

    it('writes the submitted cost (not hours) to totalLabourSubmitted', async () => {
      const { tx, aggregateFn, update } = makeLabourTx({
        _sum: { submittedHours: 12.5, submittedCost: 400 },
      });

      const result = await refreshLabourSubmittedTotals(tx, 'd1');

      expect(result).toEqual({ hours: 12.5, cost: 400 });
      // Aggregates over only this docket's labour rows.
      expect(aggregateFn).toHaveBeenCalledWith({
        where: { docketId: 'd1' },
        _sum: { submittedHours: true, submittedCost: true },
      });
      // Distinct numbers prove the cost (400), not the hours (12.5), is persisted.
      expect(update).toHaveBeenCalledWith({
        where: { id: 'd1' },
        data: { totalLabourSubmitted: 400 },
      });
    });
  });

  describe('refreshPlantSubmittedTotals', () => {
    it('coerces null aggregate sums to 0 and writes totalPlantSubmitted = 0', async () => {
      const { tx, update } = makePlantTx({
        _sum: { hoursOperated: null, submittedCost: null },
      });

      const result = await refreshPlantSubmittedTotals(tx, 'd2');

      expect(result).toEqual({ hours: 0, cost: 0 });
      expect(update).toHaveBeenCalledWith({
        where: { id: 'd2' },
        data: { totalPlantSubmitted: 0 },
      });
    });

    it('writes the submitted cost (not hours) to totalPlantSubmitted', async () => {
      const { tx, aggregateFn, update } = makePlantTx({
        _sum: { hoursOperated: 8, submittedCost: 250 },
      });

      const result = await refreshPlantSubmittedTotals(tx, 'd2');

      expect(result).toEqual({ hours: 8, cost: 250 });
      // Plant hours come from `hoursOperated`, cost from `submittedCost`.
      expect(aggregateFn).toHaveBeenCalledWith({
        where: { docketId: 'd2' },
        _sum: { hoursOperated: true, submittedCost: true },
      });
      expect(update).toHaveBeenCalledWith({
        where: { id: 'd2' },
        data: { totalPlantSubmitted: 250 },
      });
    });
  });

  describe('lockDocketForEntryMutation', () => {
    it('issues one $queryRaw and binds the docket id as a parameter (not string-concatenated)', async () => {
      const queryRaw = vi.fn().mockResolvedValue([{ id: 'docket-123', status: 'queried' }]);
      const tx = { $queryRaw: queryRaw } as unknown as DocketEntryMutationTx;

      await expect(lockDocketForEntryMutation(tx, 'docket-123')).resolves.toEqual({
        id: 'docket-123',
        status: 'queried',
      });

      expect(queryRaw).toHaveBeenCalledTimes(1);
      // Tagged-template call shape: [templateStrings, ...interpolatedValues].
      // The docket id must be the sole bound parameter.
      const [, ...values] = queryRaw.mock.calls[0];
      expect(values).toEqual(['docket-123']);
    });
  });

  describe('lockEditableDocketForEntryMutation', () => {
    it('rejects stale entry mutations when the locked docket is no longer editable', async () => {
      const queryRaw = vi
        .fn()
        .mockResolvedValue([{ id: 'docket-123', status: 'pending_approval' }]);
      const tx = { $queryRaw: queryRaw } as unknown as DocketEntryMutationTx;

      await expect(lockEditableDocketForEntryMutation(tx, 'docket-123')).rejects.toThrow(
        'Can only modify entries on draft, queried, or rejected dockets',
      );
    });
  });
});
