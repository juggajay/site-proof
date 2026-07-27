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
import { effectiveRulesets } from '../lib/readiness/sufficiency/registry.js';

export const testSufficiencyRouter = Router();

testSufficiencyRouter.use(requireAuth);

testSufficiencyRouter.get(
  '/rulesets',
  asyncHandler(async (_req, res) => {
    res.json({
      // D14.2 §6.5: LIVE packs only. The frontend's `resolveProjectRuleset`
      // matches on state + spec set with no date window, so serving a superseded
      // pack beside its replacement would let the form offer the OLD authority
      // vocabulary while the route-level whitelist enforced the new one.
      rulesets: effectiveRulesets().map((ruleset) => ({
        id: ruleset.id,
        state: ruleset.state,
        specSet: ruleset.specSet,
        scaleKeys: [...ruleset.scaleKeys],
        defaultScale: ruleset.defaultScale ?? null,
        // D14 §4.2 — the lot-form material control and the pack-driven label for
        // whatever `Lot.testScale` carries on this authority.
        materialTypes: ruleset.materialTypes ? [...ruleset.materialTypes] : null,
        scaleLabel: ruleset.scaleLabel ?? null,
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
          // D14.3 §9.3 `[D14R-R10]`: the lot-edit Testing card gates on a rule
          // actually matching the lot's activity. Until `tfnsw-q6.v1` shipped,
          // the card's only gate was "a ruleset resolves", which is tolerable
          // for VIC's A/B/C and obviously wrong for Q6 — a drainage or kerb lot
          // on an NSW project would offer five EARTHWORKS compaction bands under
          // a label reading "Specified relative compaction". Shipped product
          // data, no tenant content, on an already-cached payload.
          activitySlugs: [...rule.appliesTo.activitySlugs],
          // D14.5: a rule whose counts come from ONE band list (`bands`, not
          // `byScale`) reads no scale at all — `evaluateRule` suppresses its
          // scale causes. The lot-edit card must not then ask for a band and
          // tell the user CIVOS cannot check the lot without one: on a pavement
          // lot both halves are false. Derived from the rule SHAPE so a pack can
          // never declare the two out of step.
          scaleIndependent: !!rule.countByAreaBand?.bands,
        })),
      })),
    });
  }),
);
