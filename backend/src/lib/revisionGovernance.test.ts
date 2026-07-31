import { afterEach, describe, expect, it } from 'vitest';

import {
  isGovernedEntityType,
  loadSupersededGoverningRevisions,
  revisionGovernanceEnabled,
} from './revisionGovernance.js';

const ORIGINAL = process.env.REVISION_GOVERNANCE_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.REVISION_GOVERNANCE_ENABLED;
  else process.env.REVISION_GOVERNANCE_ENABLED = ORIGINAL;
});

describe('REVISION_GOVERNANCE_ENABLED (spec §1.9, [GR-A2])', () => {
  it('is OFF when unset — including under NODE_ENV=production', () => {
    delete process.env.REVISION_GOVERNANCE_ENABLED;
    expect(revisionGovernanceEnabled()).toBe(false);

    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(revisionGovernanceEnabled()).toBe(false);
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('accepts exactly the three opt-in tokens, case- and space-insensitively', () => {
    for (const value of ['true', '1', 'yes', 'TRUE', ' Yes ']) {
      process.env.REVISION_GOVERNANCE_ENABLED = value;
      expect(revisionGovernanceEnabled()).toBe(true);
    }
    for (const value of ['false', '0', 'no', '', 'on', 'enabled']) {
      process.env.REVISION_GOVERNANCE_ENABLED = value;
      expect(revisionGovernanceEnabled()).toBe(false);
    }
  });

  it('short-circuits the readiness loader while off, so no query is issued', async () => {
    delete process.env.REVISION_GOVERNANCE_ENABLED;
    // Non-empty lot ids: if the flag check were missing this would hit the
    // database, and the assertion below would not be reachable in a unit test.
    await expect(loadSupersededGoverningRevisions(['lot-1', 'lot-2'])).resolves.toEqual(new Map());
  });
});

describe('governed entity vocabulary', () => {
  it('accepts the five governed classes and nothing else', () => {
    for (const value of [
      'drawing',
      'specification',
      'itp_template',
      'approved_method',
      'client_direction',
    ]) {
      expect(isGovernedEntityType(value)).toBe(true);
    }
    for (const value of ['photo', 'ncr', 'lot', '']) {
      expect(isGovernedEntityType(value)).toBe(false);
    }
  });
});
