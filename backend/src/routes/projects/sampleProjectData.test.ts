import { describe, expect, it } from 'vitest';
import {
  SAMPLE_CHECKLIST_ITEMS,
  SAMPLE_HOLD_POINT_ITEM_INDEX,
  SAMPLE_ITP_TEMPLATE,
  SAMPLE_LOTS,
  SAMPLE_NCR,
  SAMPLE_PROJECT,
  SAMPLE_PROJECT_NAME,
  SAMPLE_PROJECT_NUMBER,
  SAMPLE_TEST_RESULTS,
} from './sampleProjectData.js';

// Mirrors backend/src/routes/lots/validation.ts (validStatuses + terminal
// 'conformed'); the seed writes statuses directly, so it must stay inside the
// vocabulary the lot routes accept.
const VALID_LOT_STATUSES = new Set([
  'not_started',
  'in_progress',
  'awaiting_test',
  'hold_point',
  'ncr_raised',
  'completed',
  'conformed',
]);

const VALID_LOT_TYPES = new Set(['chainage', 'area', 'structure']);

describe('sample project seed data', () => {
  it('labels the project unmistakably as example data', () => {
    expect(SAMPLE_PROJECT.name).toBe(SAMPLE_PROJECT_NAME);
    expect(SAMPLE_PROJECT.name).toContain('Example');
    expect(SAMPLE_PROJECT.projectNumber).toBe(SAMPLE_PROJECT_NUMBER);
    expect(SAMPLE_PROJECT.settings.sampleProject).toBe(true);
    expect(SAMPLE_ITP_TEMPLATE.name).toContain('Example');
  });

  it('keeps lot numbers unique and statuses within the lot-route vocabulary', () => {
    const lotNumbers = SAMPLE_LOTS.map((lot) => lot.lotNumber);
    expect(new Set(lotNumbers).size).toBe(lotNumbers.length);

    for (const lot of SAMPLE_LOTS) {
      expect(VALID_LOT_STATUSES.has(lot.status), `${lot.lotNumber} status ${lot.status}`).toBe(
        true,
      );
      expect(VALID_LOT_TYPES.has(lot.lotType), `${lot.lotNumber} lotType ${lot.lotType}`).toBe(
        true,
      );
      expect(lot.budgetAmount).toBeGreaterThan(0);
    }
  });

  it('spreads lots across the lifecycle including a claimable conformed lot', () => {
    const statuses = SAMPLE_LOTS.map((lot) => lot.status);
    expect(statuses).toContain('not_started');
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('conformed');

    // The claim modal's conformed-lot flow needs a conformed lot with a budget.
    const conformed = SAMPLE_LOTS.filter((lot) => lot.status === 'conformed');
    expect(conformed.length).toBeGreaterThanOrEqual(1);
    for (const lot of conformed) {
      expect(lot.budgetAmount).toBeGreaterThan(0);
    }
  });

  it('mirrors the lot-creation invariant that area lots carry an areaZone', () => {
    for (const lot of SAMPLE_LOTS) {
      if (lot.lotType === 'area') {
        expect(lot.areaZone, `${lot.lotNumber} must set areaZone`).toBeTruthy();
      }
    }
  });

  it('defines exactly one hold-point checklist item with unique ordering', () => {
    const sequenceNumbers = SAMPLE_CHECKLIST_ITEMS.map((item) => item.sequenceNumber);
    expect(new Set(sequenceNumbers).size).toBe(sequenceNumbers.length);

    const holdPointItems = SAMPLE_CHECKLIST_ITEMS.filter((item) => item.pointType === 'hold_point');
    expect(holdPointItems).toHaveLength(1);
    expect(SAMPLE_CHECKLIST_ITEMS[SAMPLE_HOLD_POINT_ITEM_INDEX]).toBe(holdPointItems[0]);
  });

  it('seeds one awaiting and one released hold point on ITP-assigned lots', () => {
    const holdPointLots = SAMPLE_LOTS.filter((lot) => lot.holdPoint);
    expect(holdPointLots.map((lot) => lot.holdPoint).sort()).toEqual(['awaiting', 'released']);

    // The hold point hangs off the lot's ITP checklist item, so every lot
    // seeded with a hold point must also be seeded with the ITP.
    for (const lot of holdPointLots) {
      expect(lot.itp, `${lot.lotNumber} hold point requires an ITP assignment`).toBeTruthy();
    }

    // Partially-complete ITPs stop before the hold point; the released hold
    // point belongs to the fully-completed (conformed) lot.
    const released = holdPointLots.find((lot) => lot.holdPoint === 'released');
    expect(released?.itp).toBe('complete');
    const awaiting = holdPointLots.find((lot) => lot.holdPoint === 'awaiting');
    expect(awaiting?.itp).toBe('partial');
  });

  it('links the open NCR and every test result to seeded lots', () => {
    const lotNumbers = new Set(SAMPLE_LOTS.map((lot) => lot.lotNumber));

    expect(lotNumbers.has(SAMPLE_NCR.lotNumber)).toBe(true);
    expect(SAMPLE_NCR.status).toBe('open');
    const ncrLot = SAMPLE_LOTS.find((lot) => lot.lotNumber === SAMPLE_NCR.lotNumber);
    expect(ncrLot?.status).toBe('ncr_raised');

    expect(SAMPLE_TEST_RESULTS.length).toBeGreaterThanOrEqual(2);
    for (const testResult of SAMPLE_TEST_RESULTS) {
      expect(lotNumbers.has(testResult.lotNumber), testResult.lotNumber).toBe(true);
    }
  });

  it('keeps the verified test result internally consistent', () => {
    const verified = SAMPLE_TEST_RESULTS.filter((testResult) => testResult.status === 'verified');
    expect(verified.length).toBeGreaterThanOrEqual(1);

    for (const testResult of verified) {
      expect(testResult.passFail).toBe('pass');
      expect(testResult.resultValue).toBeDefined();
      if (testResult.specificationMin !== undefined) {
        expect(testResult.resultValue!).toBeGreaterThanOrEqual(testResult.specificationMin);
      }
      if (testResult.specificationMax !== undefined) {
        expect(testResult.resultValue!).toBeLessThanOrEqual(testResult.specificationMax);
      }
    }
  });
});
