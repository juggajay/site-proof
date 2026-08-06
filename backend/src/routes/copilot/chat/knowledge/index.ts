import { ACCOUNT_PAGE_KNOWLEDGE } from './account.js';
import { COMMERCIAL_PAGE_KNOWLEDGE } from './commercial.js';
import { CORE_PAGE_KNOWLEDGE } from './core.js';
import { FOREMAN_SHELL_KNOWLEDGE } from './foremanShell.js';
import { QUALITY_PAGE_KNOWLEDGE } from './quality.js';
import { SUBBIE_PORTAL_KNOWLEDGE } from './subbiePortal.js';
import type { PageKnowledge, PageKnowledgeSearchResult } from './types.js';

export type { PageKnowledge, PageKnowledgeSearchResult } from './types.js';

export const PAGE_KNOWLEDGE: readonly PageKnowledge[] = [
  ...CORE_PAGE_KNOWLEDGE,
  ...QUALITY_PAGE_KNOWLEDGE,
  ...COMMERCIAL_PAGE_KNOWLEDGE,
  ...ACCOUNT_PAGE_KNOWLEDGE,
  ...FOREMAN_SHELL_KNOWLEDGE,
  ...SUBBIE_PORTAL_KNOWLEDGE,
];

const SEARCH_STOP_WORDS = new Set([
  'a',
  'an',
  'can',
  'click',
  'do',
  'does',
  'for',
  'how',
  'i',
  'in',
  'is',
  'mean',
  'my',
  'next',
  'of',
  'on',
  'screen',
  'set',
  'the',
  'to',
  'what',
  'where',
  'why',
]);

function normaliseText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normaliseRoute(value: string): string {
  const withoutOrigin = value.trim().replace(/^https?:\/\/[^/]+/i, '');
  return withoutOrigin.split(/[?#]/, 1)[0]?.replace(/^\/+|\/+$/g, '') ?? '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routePattern(route: string): RegExp {
  const pattern = route
    .split('/')
    .map((segment) => (/^<[^>]+>$/.test(segment) ? '[^/]+' : escapeRegExp(segment)))
    .join('/');
  return new RegExp(`^${pattern}$`, 'i');
}

export function getPageKnowledge(route: string): PageKnowledge | undefined {
  const wanted = normaliseRoute(route);
  return (
    PAGE_KNOWLEDGE.find((page) => page.route.toLowerCase() === wanted.toLowerCase()) ??
    PAGE_KNOWLEDGE.find((page) => routePattern(page.route).test(wanted))
  );
}

function weightedMatch(value: string, query: string, exact: number, partial: number): number {
  if (value === query) return exact;
  if (value.includes(query)) return partial;
  return 0;
}

function scoreToken(
  token: string,
  title: string,
  route: string,
  keywords: string[],
  body: string,
): number {
  const titleScore = weightedMatch(title, token, 90, 45);
  const routeScore = route.split(' ').includes(token) ? 55 : 0;
  const keywordScore = keywords.filter((keyword) => keyword.split(' ').includes(token)).length * 70;
  const bodyScore = body.includes(token) ? 12 : 0;
  return titleScore + routeScore + keywordScore + bodyScore;
}

function scorePage(page: PageKnowledge, query: string, tokens: string[]): number {
  const title = normaliseText(page.title);
  const route = normaliseText(page.route);
  const keywords = page.keywords.map(normaliseText);
  const body = normaliseText(page.body);
  const phraseScore =
    weightedMatch(title, query, 1_000, 400) +
    weightedMatch(route, query, 800, 220) +
    (keywords.includes(query) ? 600 : 0) +
    keywords.filter((keyword) => keyword.includes(query)).length * 260 +
    (body.includes(query) ? 180 : 0);

  return (
    phraseScore +
    tokens.reduce((score, token) => score + scoreToken(token, title, route, keywords, body), 0)
  );
}

function buildSnippet(page: PageKnowledge, query: string, tokens: string[]): string {
  const plainBody = page.body.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const lowerBody = plainBody.toLowerCase();
  const candidates = [query];
  for (let start = 0; start < tokens.length; start += 1) {
    for (let end = tokens.length; end > start; end -= 1) {
      candidates.push(tokens.slice(start, end).join(' '));
    }
  }
  const match = candidates
    .filter((candidate) => candidate.length > 1)
    .map((candidate) => lowerBody.indexOf(candidate))
    .find((index) => index >= 0);
  const centre = match ?? 0;
  const start = Math.max(0, centre - 70);
  const end = Math.min(plainBody.length, start + 240);
  return `${start > 0 ? '…' : ''}${plainBody.slice(start, end).trim()}${end < plainBody.length ? '…' : ''}`;
}

export function searchPageKnowledge(query: string): PageKnowledgeSearchResult[] {
  const normalisedQuery = normaliseText(query);
  if (!normalisedQuery) return [];
  const tokens = [
    ...new Set(
      normalisedQuery
        .split(' ')
        .filter((token) => token.length > 1 && !SEARCH_STOP_WORDS.has(token)),
    ),
  ];

  return PAGE_KNOWLEDGE.map((page, index) => ({
    page,
    index,
    score: scorePage(page, normalisedQuery, tokens),
  }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map(({ page }) => ({
      route: page.route,
      title: page.title,
      snippet: buildSnippet(page, normalisedQuery, tokens),
    }));
}
