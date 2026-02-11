---
name: siteproof-codebase-review
description: Use when performing comprehensive codebase review of SiteProof v3. Triggers on requests for code audit, security review, architecture review, or full codebase analysis.
---

# SiteProof v3 Codebase Review

## Overview

Orchestrated multi-agent review that runs **6 parallel subagents** to audit security, performance, architecture, code quality, testing, and patterns. An orchestrator synthesizes findings into actionable recommendations.

## When to Use

- Full codebase audit requested
- Pre-deployment review
- Quarterly code health check
- After major feature additions
- New developer onboarding (understand codebase state)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR AGENT                       │
│  - Launches all review agents in parallel                   │
│  - Collects and synthesizes findings                        │
│  - Prioritizes issues by severity                           │
│  - Generates final report with action items                 │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   SECURITY    │   │  PERFORMANCE  │   │ ARCHITECTURE  │
│    AGENT      │   │    AGENT      │   │    AGENT      │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ CODE QUALITY  │   │   TESTING     │   │   PATTERNS    │
│    AGENT      │   │    AGENT      │   │    AGENT      │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Review Domains

### 1. Security Agent
**Focus:** OWASP Top 10, auth vulnerabilities, data exposure

**Check:**
- SQL injection (raw queries, unsanitized input)
- XSS vulnerabilities (dangerouslySetInnerHTML, unsanitized rendering)
- Authentication bypass (missing authenticateToken middleware)
- Authorization gaps (role checks, data access)
- Sensitive data exposure (logs, error messages, localStorage)
- CSRF protection
- File upload validation
- Environment variable handling
- Supabase RLS policies

**SiteProof-specific:**
- Verify all routes use `authenticateToken` middleware
- Check company/project data isolation
- Review document storage access controls
- Audit commercial data access (claims, dockets)

### 2. Performance Agent
**Focus:** Database queries, bundle size, rendering, API response times

**Check:**
- N+1 query patterns in Prisma
- Missing database indexes
- Large bundle dependencies
- Unoptimized images/assets
- React re-render issues (missing memo, unstable refs)
- Pagination implementation
- Lazy loading usage
- API response payloads (over-fetching)

**SiteProof-specific:**
- Review TanStack Query cache strategies
- Check lot listing performance (can be 1000+ lots)
- Audit PDF generation performance
- Review file upload handling

### 3. Architecture Agent
**Focus:** Code organization, separation of concerns, scalability

**Check:**
- Directory structure consistency
- Module boundaries (circular deps)
- API design (REST conventions, error handling)
- State management patterns
- Component hierarchy
- Hook organization
- Type definitions location

**SiteProof-specific:**
- Backend route organization (`backend/src/routes/`)
- Frontend page/component split
- Shared types between frontend/backend
- tRPC vs REST usage consistency

### 4. Code Quality Agent
**Focus:** Readability, maintainability, technical debt

**Check:**
- Files over 500 lines (refactoring targets)
- Functions over 50 lines
- Deep nesting (>3 levels)
- Duplicate code patterns
- Magic numbers/strings
- Error handling consistency
- TypeScript strict mode compliance
- Dead code

**SiteProof-specific (known large files):**
- `LotDetailPage.tsx` (4,516 lines)
- `LotsPage.tsx` (3,363 lines)
- `pdfGenerator.ts` (2,915 lines)
- `DailyDiaryPage.tsx` (2,669 lines)

### 5. Testing Agent
**Focus:** Coverage, test quality, testing patterns

**Check:**
- Test coverage gaps
- Test file organization
- Mock usage and quality
- E2E test reliability
- Unit vs integration balance
- Test data management
- CI/CD test configuration

**SiteProof-specific:**
- Backend Vitest tests (`backend/test/`)
- Frontend Playwright E2E (`frontend/e2e/`)
- API endpoint coverage
- Auth flow testing

### 6. Patterns Agent
**Focus:** Consistency, best practices, framework usage

**Check:**
- React patterns (hooks, composition)
- Form handling (React Hook Form + Zod)
- API call patterns (apiFetch usage)
- Error boundary usage
- Loading state handling
- Optimistic updates
- Component prop patterns

**SiteProof-specific:**
- `useAuth` hook usage
- `useCommercialAccess` for role checks
- `RoleProtectedRoute` implementation
- TanStack Query patterns
- Prisma query patterns

## Execution Protocol

### Step 1: Launch Orchestrator

```
Invoke this skill, then use Task tool to launch orchestrator agent:

Task(subagent_type="general-purpose", prompt=`
You are the orchestrator for a SiteProof v3 codebase review.

Your job:
1. Launch all 6 review agents IN PARALLEL using Task tool
2. Wait for all agents to complete
3. Collect their findings
4. Synthesize into prioritized report

Launch these agents NOW (all in parallel in a single message):
[Include agent prompts from Step 2]

After all complete, create report in tasks/codebase-review-YYYY-MM-DD.md
`)
```

### Step 2: Agent Prompts

**Security Agent:**
```
Review SiteProof v3 for security vulnerabilities.

Focus areas:
- All files in backend/src/routes/ - verify authenticateToken usage
- All files in backend/src/middleware/ - review auth logic
- Frontend auth patterns in frontend/src/lib/auth.ts
- Search for: raw SQL, dangerouslySetInnerHTML, eval, localStorage sensitive data
- Check Prisma queries for injection risks
- Review file upload handling
- Check error messages for data leakage

Output: Markdown list of findings with severity (CRITICAL/HIGH/MEDIUM/LOW), file:line, and fix recommendation.
```

**Performance Agent:**
```
Review SiteProof v3 for performance issues.

Focus areas:
- Prisma queries in backend/src/routes/ - look for N+1, missing includes
- Bundle size - check frontend/package.json for heavy deps
- React components over 200 lines - check for memo opportunities
- API endpoints returning large payloads
- Missing pagination
- Image/file handling

Output: Markdown list of findings with impact (HIGH/MEDIUM/LOW), file:line, and optimization recommendation.
```

**Architecture Agent:**
```
Review SiteProof v3 architecture and organization.

Focus areas:
- Directory structure in frontend/src/ and backend/src/
- Module dependencies - look for circular imports
- API design consistency in backend/src/routes/
- State management patterns
- Type sharing between frontend/backend
- Component hierarchy depth

Output: Markdown list of findings with category, location, and improvement recommendation.
```

**Code Quality Agent:**
```
Review SiteProof v3 for code quality issues.

Focus areas:
- Files over 500 lines (especially the known large files)
- Functions over 50 lines
- Deep nesting (>3 levels)
- Duplicate code patterns
- TypeScript any usage
- Missing error handling
- Dead/commented code

Output: Markdown list of findings with severity, file:line, and refactoring recommendation.
```

**Testing Agent:**
```
Review SiteProof v3 test coverage and quality.

Focus areas:
- backend/test/ - what's tested, what's missing
- frontend/e2e/ - E2E coverage
- Check if critical paths are tested (auth, payments, data mutations)
- Test organization and naming
- Mock quality

Output: Markdown list of coverage gaps, test quality issues, and recommendations.
```

**Patterns Agent:**
```
Review SiteProof v3 for pattern consistency.

Focus areas:
- React Hook Form + Zod usage across all forms
- apiFetch vs direct fetch usage
- useAuth and useCommercialAccess patterns
- TanStack Query usage (useQuery, useMutation)
- Error handling patterns
- Loading state patterns
- Component composition patterns

Output: Markdown list of inconsistencies, anti-patterns, and standardization recommendations.
```

### Step 3: Report Synthesis

Orchestrator creates final report with:

```markdown
# SiteProof v3 Codebase Review - [DATE]

## Executive Summary
[2-3 sentences on overall health]

## Critical Issues (Fix Immediately)
[Security vulnerabilities, data exposure risks]

## High Priority (Fix This Sprint)
[Performance blockers, major code quality issues]

## Medium Priority (Plan for Next Sprint)
[Architecture improvements, testing gaps]

## Low Priority (Technical Debt Backlog)
[Refactoring targets, pattern inconsistencies]

## Metrics
- Files reviewed: X
- Issues found: X (Critical: X, High: X, Medium: X, Low: X)
- Estimated effort: X hours

## Detailed Findings by Domain
### Security
### Performance
### Architecture
### Code Quality
### Testing
### Patterns
```

## Output Location

All review outputs go to `tasks/` directory:
- `tasks/codebase-review-YYYY-MM-DD.md` - Final synthesized report
- Individual agent outputs are collected by orchestrator (not saved separately)

## Quick Reference

| Agent | Primary Tools | Key Files |
|-------|--------------|-----------|
| Security | Grep, Read | routes/, middleware/, auth.ts |
| Performance | Grep, Read | routes/, package.json, large components |
| Architecture | Glob, Read | Directory structure, imports |
| Code Quality | Grep, Read | All .ts/.tsx files |
| Testing | Glob, Read | test/, e2e/ |
| Patterns | Grep, Read | hooks/, components/, lib/ |

## Common Issues Found in Previous Reviews

(Update this section after each review)

- [ ] Large files need component extraction
- [ ] Inconsistent error handling patterns
- [ ] Missing pagination on list endpoints
- [ ] Test coverage gaps in commercial features
