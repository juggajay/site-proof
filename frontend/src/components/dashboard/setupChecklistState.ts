/**
 * Pure state engine for the dashboard first-run setup checklist.
 *
 * `deriveSetupSteps` maps company-level counts to the ordered onboarding steps a
 * new head contractor works through — create project → control line → plan
 * sheets → lots → ITP → team. Every tick comes from a count; nothing is
 * hardcoded. Keeping this deterministic and side-effect-free is deliberate: it
 * is the seed of the future project-state "copilot", and these unit tests are
 * its spec.
 */

export interface SetupCounts {
  /** Projects the company has created. */
  projects: number;
  /** Control lines across the company's projects. */
  controlLines: number;
  /** Registered plan sheets across the company's projects. */
  planSheets: number;
  /** Lots across the company's projects. */
  lots: number;
  /** Lots that have an ITP attached (materialised ITP instances). */
  lotsWithItp: number;
  /**
   * Distinct teammates on the company's projects EXCLUDING the current user, so
   * the "invite your team" step ticks the moment one other person is added
   * regardless of how the creator's own membership is recorded.
   */
  teamMembers: number;
}

export interface SetupStep {
  key: string;
  title: string;
  description: string;
  done: boolean;
  to: string;
}

/**
 * Deep-link target for spatial/lot/ITP steps: when the company has exactly one
 * project we point straight into it; with zero or many projects we fall back to
 * the generic project list so the user picks first.
 */
export function resolveSoleProjectId(projectIds: readonly string[]): string | null {
  return projectIds.length === 1 ? projectIds[0] : null;
}

function projectLink(soleProjectId: string | null, suffix: string): string {
  return soleProjectId ? `/projects/${encodeURIComponent(soleProjectId)}${suffix}` : '/projects';
}

export function deriveSetupSteps(
  counts: SetupCounts,
  soleProjectId: string | null = null,
): SetupStep[] {
  return [
    {
      key: 'project',
      title: 'Create your first project',
      description: 'Projects hold your lots, quality records, diaries, and reports.',
      to: '/projects',
      done: counts.projects > 0,
    },
    {
      key: 'control-line',
      title: 'Add a control line',
      description: 'Set the survey control line so lots can be placed by chainage and offset.',
      to: projectLink(soleProjectId, '/control-lines'),
      done: counts.controlLines > 0,
    },
    {
      key: 'plan-sheets',
      title: 'Add plan sheets',
      description: 'Register the drawing sheets your lots and inspections are set out against.',
      to: projectLink(soleProjectId, '/plan-sheets'),
      done: counts.planSheets > 0,
    },
    {
      key: 'lots',
      title: 'Add lots',
      description: 'Break the work into lots so conformance is tracked lot by lot.',
      to: projectLink(soleProjectId, '/lots'),
      done: counts.lots > 0,
    },
    {
      key: 'itp',
      title: 'Assign an ITP',
      description:
        'Attach an inspection and test plan to a lot so hold points and inspections are ready for the crew.',
      to: projectLink(soleProjectId, '/itp'),
      done: counts.lotsWithItp > 0,
    },
    {
      key: 'team',
      title: 'Invite your team',
      description: 'Add the engineers and foremen who will run inspections on site.',
      to: '/company-settings',
      done: counts.teamMembers > 0,
    },
  ];
}
