// GET /api/test-sufficiency/rulesets — the shipped frequency-rule registry as
// data (spec §9.2). The ONE new read route Wave C1 adds.
//
// Not project-scoped and it carries no tenant content: rulesets are shipped
// product data (§3.1), and the lot-edit scale control needs the `scaleKeys` of
// whichever authority governs the project. §7 nonetheless says "tenant-isolation
// tests on every new query surface" with no exemption, so §14 AT-19 asserts both
// halves: authentication is required, and two users in different companies get
// byte-identical payloads.

import { Router } from 'express';

import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { SUFFICIENCY_RULESETS } from '../lib/readiness/sufficiency/registry.js';

export const testSufficiencyRouter = Router();

testSufficiencyRouter.use(requireAuth);

testSufficiencyRouter.get(
  '/rulesets',
  asyncHandler(async (_req, res) => {
    res.json({
      rulesets: SUFFICIENCY_RULESETS.map((ruleset) => ({
        id: ruleset.id,
        state: ruleset.state,
        specSet: ruleset.specSet,
        scaleKeys: [...ruleset.scaleKeys],
        defaultScale: ruleset.defaultScale ?? null,
        status: ruleset.status,
        authority: ruleset.provenance.authority,
        document: ruleset.provenance.document,
        edition: ruleset.provenance.edition,
        // Rule LABELS and citations only. There is no free-prose field on a rule
        // (§8.4), so no specification text can reach this payload.
        rules: ruleset.rules.map((rule) => ({
          id: rule.id,
          label: rule.label,
          testType: rule.testType,
          clause: rule.provenance.clause,
        })),
      })),
    });
  }),
);
