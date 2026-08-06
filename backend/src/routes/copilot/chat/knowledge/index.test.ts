import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PROJECT_PAGES, TOP_LEVEL_PAGES } from '../prompt.js';
import { PAGE_KNOWLEDGE, getPageKnowledge, searchPageKnowledge } from './index.js';

function findRepoRoot(): string {
  let candidate = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    try {
      readFileSync(join(candidate, 'frontend/src/App.tsx'), 'utf8');
      return candidate;
    } catch {
      const parent = dirname(candidate);
      if (parent === candidate)
        throw new Error('Could not find repository root from knowledge test');
      candidate = parent;
    }
  }
}

const REPO_ROOT = findRepoRoot();

function canonicaliseRoute(route: string): string {
  return route
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/\*$/, '')
    .replace(/:([A-Za-z][A-Za-z0-9_]*)/g, '<$1>');
}

function extractAbsoluteAppRoutes(): Set<string> {
  const source = readFileSync(join(REPO_ROOT, 'frontend/src/App.tsx'), 'utf8');
  const routes = new Set<string>();
  for (const match of source.matchAll(/path="([^"]+)"/g)) {
    const route = match[1];
    if (route?.startsWith('/')) routes.add(canonicaliseRoute(route));
  }
  // The only relative child registered inline in App.tsx. Its index route is a redirect.
  routes.add('projects/<projectId>/foreman/today');
  return routes;
}

function extractShellRoutes(relativeFile: string, prefix: string): Set<string> {
  const source = readFileSync(join(REPO_ROOT, relativeFile), 'utf8');
  const routes = new Set<string>();
  for (const match of source.matchAll(/<Route\s+(index\b|path="([^"]+)")/g)) {
    if (match[1] === 'index') {
      routes.add(prefix);
      continue;
    }
    const child = match[2];
    if (!child || child === '*' || child.endsWith('/*')) continue;
    routes.add(canonicaliseRoute(`${prefix}/${child}`));
  }
  return routes;
}

const EXCLUDED_APP_ROUTES = new Map<string, string>([
  ['', 'root chooser/redirect, not an authenticated product page'],
  ['login', 'authentication'],
  ['register', 'authentication'],
  ['forgot-password', 'authentication'],
  ['reset-password', 'authentication'],
  ['verify-email', 'authentication'],
  ['auth/magic-link', 'authentication callback'],
  ['auth/oauth-callback', 'authentication callback'],
  ['auth/oauth-mock', 'development-only authentication callback'],
  ['landing', 'public marketing'],
  ['privacy-policy', 'public legal'],
  ['terms-of-service', 'public legal'],
  ['subcontractor-portal/accept-invite', 'public invitation flow'],
  ['accept-invite', 'public invitation alias'],
  ['hp-release/<token>', 'public tokenised hold-point response'],
  ['hp-release/batch/<token>', 'public tokenised hold-point response'],
  ['reports', 'redirect alias to Projects'],
  ['subcontractors', 'redirect alias to Projects'],
  ['documentation', 'redirect alias to Documentation'],
  ['projects/<projectId>/foreman', 'index redirect; the registered Today child is mapped'],
]);

function sourceProductRoutes(): Set<string> {
  const routes = extractAbsoluteAppRoutes();
  for (const route of EXCLUDED_APP_ROUTES.keys()) routes.delete(route);

  const shellFiles: Array<[string, string]> = [
    ['frontend/src/shell/screens/diary/DiaryShellRoutes.tsx', 'm/diary'],
    ['frontend/src/shell/screens/lots/LotsShellRoutes.tsx', 'm/lots'],
    ['frontend/src/shell/screens/dockets/DocketsShellRoutes.tsx', 'm/dockets'],
    ['frontend/src/shell/screens/issues/IssuesShellRoutes.tsx', 'm/issues'],
    ['frontend/src/shell/screens/photos/PhotosShellRoutes.tsx', 'm/photos'],
    ['frontend/src/shell/screens/docs/DocsShellRoutes.tsx', 'm/docs'],
    ['frontend/src/shell/subbie/SubbieShellRoutes.tsx', 'p'],
  ];
  for (const [file, prefix] of shellFiles) {
    for (const route of extractShellRoutes(file, prefix)) routes.add(route);
  }
  return routes;
}

describe('page knowledge route coverage', () => {
  it('pins every authenticated product route in App and the field shells in both directions', () => {
    const sourceRoutes = [...sourceProductRoutes()].sort();
    const knowledgeRoutes = PAGE_KNOWLEDGE.map(({ route }) => route).sort();
    expect(knowledgeRoutes).toEqual(sourceRoutes);
  });

  it('pins every navigate-list page to a knowledge entry', () => {
    const knowledgeRoutes = new Set(PAGE_KNOWLEDGE.map(({ route }) => route));
    const navigableRoutes = [
      ...TOP_LEVEL_PAGES.map(({ path }) => path),
      ...PROJECT_PAGES.map(({ path }) => `projects/<projectId>/${path}`),
    ];
    expect(navigableRoutes.filter((route) => !knowledgeRoutes.has(route))).toEqual([]);
  });

  it('keeps entries unique, searchable and within the keyword budget', () => {
    const routes = PAGE_KNOWLEDGE.map(({ route }) => route);
    expect(new Set(routes).size).toBe(routes.length);
    for (const page of PAGE_KNOWLEDGE) {
      expect(page.title.length).toBeGreaterThan(2);
      expect(page.roles.length).toBeGreaterThan(10);
      expect(page.body.length).toBeGreaterThan(100);
      expect(page.keywords.length, page.route).toBeGreaterThanOrEqual(5);
      expect(page.keywords.length, page.route).toBeLessThanOrEqual(8);
    }
  });

  it('resolves canonical patterns and real application paths', () => {
    expect(getPageKnowledge('projects/<projectId>/tests')?.title).toBe('Test Results');
    expect(getPageKnowledge('/projects/project-123/lots/lot-456?tab=itp')?.title).toBe(
      'Lot Detail',
    );
    expect(getPageKnowledge('/not/a/real/page')).toBeUndefined();
  });
});

describe('page knowledge retrieval quality', () => {
  it.each([
    ['What is the Views button for in Test Results?', 'projects/<projectId>/tests', 'Views'],
    ['What do the four dots next to an NCR status mean?', 'projects/<projectId>/ncr', 'four-dot'],
    [
      'Why can’t I click Request selected on Hold Points?',
      'projects/<projectId>/hold-points',
      'Request selected',
    ],
    [
      'What does the amber photos banner on the foreman home screen mean?',
      'm',
      'amber photos banner',
    ],
    [
      'Where do I set acceptance criteria on an ITP template?',
      'projects/<projectId>/itp',
      'Acceptance criteria',
    ],
  ])('ranks %s first with an answer-shaped snippet', (query, expectedRoute, expectedText) => {
    const results = searchPageKnowledge(query);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(3);
    expect(results[0]?.route).toBe(expectedRoute);
    expect(results[0]?.snippet.length).toBeGreaterThan(20);
    expect(results[0]?.snippet).toContain(expectedText);
  });

  it('returns no matches for an empty query', () => {
    expect(searchPageKnowledge('   ')).toEqual([]);
  });
});
