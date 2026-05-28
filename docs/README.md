# SiteProof Documentation Index

This folder contains tracked product, operations, and handoff documentation for
SiteProof. Runtime browser artifacts, QA screenshots, local security scans, and
agent scratch work belong under ignored local folders such as `.gstack/` or
`.deepsec/`, not in this directory.

## Current References

| Document                                                       | Use it for                                                                                                |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [agent-handoff.md](agent-handoff.md)                           | Current workstream state, production warnings, recently merged PRs, and handoff rules for a fresh agent.  |
| [user-guide.md](user-guide.md)                                 | Product workflow guide mirrored by the in-app `/docs` page. Use this for user-facing documentation edits. |
| [product/user-stories.md](product/user-stories.md)             | Curated target users, pain points, role-based stories, and UX decision checks extracted from research.     |
| [product/pilot-journeys.md](product/pilot-journeys.md)         | Four core pilot journeys for owner, PM/QM, foreman, and subcontractor UX and QA planning.                 |
| [supabase-storage-setup.md](supabase-storage-setup.md)         | Production storage configuration, bucket policy, and upload surface notes.                                |
| [design-system.md](design-system.md)                           | Visual language, UI patterns, and product tone.                                                           |
| [production-readiness-audit.md](production-readiness-audit.md) | Historical readiness audit. Recheck current `master` before treating a finding as active.                 |

## Archive And Research

- `archive/` contains historical docs preserved for audit trail and context.
- `product/` contains curated product strategy references extracted from the
  raw research so agents do not need to parse every market report before
  planning UX or feature work.
- `research/` contains target-user, competitor, and standards research used to
  shape product decisions. Some research files are large and should not be
  treated as app-facing help content.

## Editing Rules

1. Keep tracked docs free of secrets, connection strings, cookies, JWTs, browser
   profiles, backup dumps, and local audit exports.
2. When the in-app documentation changes, update [user-guide.md](user-guide.md)
   in the same PR.
3. When a PR sequence changes the current workstream state, update
   [agent-handoff.md](agent-handoff.md).
4. Treat `.gstack/dev-browser` reports as evidence trails, not live backlog
   sources. Confirm current production or current `master` before reopening an
   old finding.
