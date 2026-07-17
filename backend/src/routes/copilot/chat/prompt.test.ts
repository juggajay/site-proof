import { describe, expect, it } from 'vitest';

import {
  CHAT_STAGES,
  isAllowedNavigateTarget,
  isChatStage,
  CLANCY_SYSTEM_PROMPT,
  MAX_ACTIONS,
  PROJECT_PAGES,
  TOP_LEVEL_PAGES,
} from './prompt.js';

describe('isAllowedNavigateTarget', () => {
  it('accepts whitelisted in-app paths', () => {
    for (const path of [
      '/dashboard',
      '/projects',
      '/projects/abc-123',
      '/projects/abc-123/lots',
      '/projects/abc-123/lots/lot-9',
      '/projects/abc-123/copilot',
      '/projects/abc-123/control-lines',
      '/projects/abc-123/plan-sheets',
      '/projects/abc-123/itp',
      '/projects/abc-123/diary',
      '/portfolio',
      '/notifications',
      '/company-settings',
      '/docs',
      '/invitations',
    ]) {
      expect(isAllowedNavigateTarget(path)).toBe(true);
    }
  });

  it('rejects external, protocol-relative, and off-list targets', () => {
    for (const path of [
      'https://evil.com',
      'http://example.com/dashboard',
      '//evil.com',
      '/evil',
      '/projects/abc/settings/secret',
      '/projects/abc?redirect=/x',
      '/projects/abc#/x',
      '/my-company',
      '/reports',
      '/onboarding',
      'javascript:alert(1)',
      '',
      '/projects/abc/lots/lot-9/edit',
    ]) {
      expect(isAllowedNavigateTarget(path)).toBe(false);
    }
  });

  it('rejects non-string input', () => {
    expect(isAllowedNavigateTarget(undefined)).toBe(false);
    expect(isAllowedNavigateTarget(42)).toBe(false);
    expect(isAllowedNavigateTarget(null)).toBe(false);
  });
});

describe('PROJECT_PAGES', () => {
  // Live-probe regression: the whitelist allowed /itp and /variations but Clancy
  // refused to navigate because the prompt never told him those pages exist.
  // One table must drive both, and this pins it.
  it('every page is both navigable and described in the system prompt', () => {
    for (const page of PROJECT_PAGES) {
      const concrete = `/projects/abc-123/${page.path.replace('<lotId>', 'lot-9')}`;
      expect(isAllowedNavigateTarget(concrete)).toBe(true);
      expect(CLANCY_SYSTEM_PROMPT).toContain(`- /projects/<id>/${page.path} — ${page.label}`);
    }
  });

  it('covers the pages from the live-probe refusals', () => {
    const paths = PROJECT_PAGES.map((page) => page.path);
    expect(paths).toContain('itp');
    expect(paths).toContain('variations');
    expect(paths).toContain('hold-points');
    expect(paths).toContain('subcontractors');
  });

  it('covers every project-scoped read page from App.tsx', () => {
    // Manually mirrored from frontend/src/App.tsx /projects/:projectId routes.
    // Excluded on purpose: 'foreman' (legacy path, redirects to /m) and
    // 'lots/<lotId>/edit' (an edit surface, not a navigation destination).
    // If a new project page ships, add it BOTH there and to PROJECT_PAGES.
    const expected = [
      'lots',
      'lots/<lotId>',
      'copilot',
      'control-lines',
      'plan-sheets',
      'itp',
      'hold-points',
      'ncr',
      'tests',
      'diary',
      'dockets',
      'documents',
      'reports',
      'claims',
      'variations',
      'users',
      'subcontractors',
      'drawings',
      'costs',
      'delays',
      'areas',
      'settings',
    ];
    expect(PROJECT_PAGES.map((page) => page.path).sort()).toEqual([...expected].sort());
  });
});

describe('TOP_LEVEL_PAGES', () => {
  it('every page is both navigable and described in the system prompt', () => {
    for (const page of TOP_LEVEL_PAGES) {
      expect(isAllowedNavigateTarget(`/${page.path}`)).toBe(true);
      expect(CLANCY_SYSTEM_PROMPT).toContain(`- /${page.path} — ${page.label}`);
    }
  });

  it('warns that company-settings is owner/admin only so Clancy can flag it to a PM', () => {
    const companySettings = TOP_LEVEL_PAGES.find((p) => p.path === 'company-settings');
    expect(companySettings?.label).toContain('owner/admin only');
  });

  it('covers the authenticated non-project pages a project_manager can reach in App.tsx', () => {
    // Manually mirrored from frontend/src/App.tsx's authenticated top-level
    // routes. Excluded on purpose:
    //   /dashboard, /projects, /projects/<id> — already hardcoded in the whitelist.
    //   /reports, /subcontractors, /documentation — redirects to another page,
    //     not real destinations (project reports live at /projects/<id>/reports).
    //   /my-company — subcontractor-only (SUBCONTRACTOR_ROLES); a project_manager
    //     literally cannot open it.
    //   /onboarding — one-time company onboarding flow, not a nav target.
    //   /reports/scheduled-runs/:runId/artifact, /subcontractor-portal/* — param
    //     routes / subcontractor shell, not office-user destinations.
    // If a new authenticated top-level page ships, add it BOTH there and here.
    const expected = [
      'portfolio',
      'notifications',
      'audit-log',
      'company-settings',
      'docs',
      'support',
      'profile',
      'settings',
      'invitations',
    ];
    expect(TOP_LEVEL_PAGES.map((page) => page.path).sort()).toEqual([...expected].sort());
  });
});

describe('isChatStage', () => {
  it('accepts the four setup stages and nothing else', () => {
    for (const stage of CHAT_STAGES) {
      expect(isChatStage(stage)).toBe(true);
    }
    expect(isChatStage('claims')).toBe(false);
    expect(isChatStage('')).toBe(false);
    expect(isChatStage(undefined)).toBe(false);
  });
});

describe('MAX_ACTIONS', () => {
  it('caps actions at three', () => {
    expect(MAX_ACTIONS).toBe(3);
  });
});
