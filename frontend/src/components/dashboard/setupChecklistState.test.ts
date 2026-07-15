import { describe, expect, it } from 'vitest';
import { deriveSetupSteps, resolveSoleProjectId, type SetupCounts } from './setupChecklistState';

const ZERO: SetupCounts = {
  projects: 0,
  controlLines: 0,
  planSheets: 0,
  lots: 0,
  lotsWithItp: 0,
  teamMembers: 0,
};

describe('deriveSetupSteps ordering', () => {
  it('emits the six onboarding steps in workflow order', () => {
    expect(deriveSetupSteps(ZERO).map((s) => s.key)).toEqual([
      'project',
      'control-line',
      'plan-sheets',
      'lots',
      'itp',
      'team',
    ]);
  });
});

describe('deriveSetupSteps tick conditions', () => {
  const doneFor = (counts: SetupCounts): Record<string, boolean> =>
    Object.fromEntries(deriveSetupSteps(counts).map((s) => [s.key, s.done]));

  it('leaves every step unticked for a brand-new company', () => {
    expect(doneFor(ZERO)).toEqual({
      project: false,
      'control-line': false,
      'plan-sheets': false,
      lots: false,
      itp: false,
      team: false,
    });
  });

  it('ticks the project step once a project exists', () => {
    expect(doneFor({ ...ZERO, projects: 1 }).project).toBe(true);
  });

  it('ticks the control-line step from the control line count', () => {
    expect(doneFor({ ...ZERO, controlLines: 0 })['control-line']).toBe(false);
    expect(doneFor({ ...ZERO, controlLines: 2 })['control-line']).toBe(true);
  });

  it('ticks the plan-sheets step from the plan sheet count', () => {
    expect(doneFor({ ...ZERO, planSheets: 1 })['plan-sheets']).toBe(true);
  });

  it('ticks the lots step from the lot count', () => {
    expect(doneFor({ ...ZERO, lots: 5 }).lots).toBe(true);
  });

  it('ticks the ITP step only when a lot has an ITP attached', () => {
    // Lots existing is not enough — the ITP tick needs a materialised instance.
    expect(doneFor({ ...ZERO, lots: 5, lotsWithItp: 0 }).itp).toBe(false);
    expect(doneFor({ ...ZERO, lots: 5, lotsWithItp: 1 }).itp).toBe(true);
  });

  it('ticks the team step once one other teammate exists', () => {
    // teamMembers already excludes the current user, so > 0 means someone was invited.
    expect(doneFor({ ...ZERO, teamMembers: 0 }).team).toBe(false);
    expect(doneFor({ ...ZERO, teamMembers: 1 }).team).toBe(true);
  });
});

describe('resolveSoleProjectId', () => {
  it('returns the id only when there is exactly one project', () => {
    expect(resolveSoleProjectId([])).toBeNull();
    expect(resolveSoleProjectId(['p1'])).toBe('p1');
    expect(resolveSoleProjectId(['p1', 'p2'])).toBeNull();
  });
});

describe('deriveSetupSteps deep links', () => {
  it('uses generic links when no sole project is given', () => {
    const links = Object.fromEntries(deriveSetupSteps(ZERO, null).map((s) => [s.key, s.to]));
    expect(links['control-line']).toBe('/projects');
    expect(links['plan-sheets']).toBe('/projects');
    expect(links.lots).toBe('/projects');
    expect(links.itp).toBe('/projects');
  });

  it('deep-links spatial/lot/ITP/team steps into the sole project', () => {
    const links = Object.fromEntries(deriveSetupSteps(ZERO, 'proj 1').map((s) => [s.key, s.to]));
    expect(links['control-line']).toBe('/projects/proj%201/control-lines');
    expect(links['plan-sheets']).toBe('/projects/proj%201/plan-sheets');
    expect(links.lots).toBe('/projects/proj%201/lots');
    expect(links.itp).toBe('/projects/proj%201/itp');
    // Team ticks on project membership, so its link points at the project users page.
    expect(links.team).toBe('/projects/proj%201/users');
  });

  it('keeps the project step fixed and falls back to company settings for team without a sole project', () => {
    const soleLinks = Object.fromEntries(deriveSetupSteps(ZERO, 'p1').map((s) => [s.key, s.to]));
    expect(soleLinks.project).toBe('/projects');
    const genericLinks = Object.fromEntries(deriveSetupSteps(ZERO, null).map((s) => [s.key, s.to]));
    expect(genericLinks.team).toBe('/company-settings');
  });
});
