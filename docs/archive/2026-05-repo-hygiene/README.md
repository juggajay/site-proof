# Archive — 2026-05 Repo Hygiene (Batch 2)

Archived 2026-05-14 as part of the Batch 2 repo hygiene PR (`chore/archive-stale-docs`). These files are kept for historical reference but are no longer top-level docs because the planning work they describe has either shipped, been superseded, or stopped being maintained.

**Nothing in this folder is current product documentation.** For the current state of the codebase, see [`CLAUDE.md`](../../../CLAUDE.md) and [`docs/`](../..).

## Index

### Implementation plans (Jan–Feb 2026)

| File | Subject |
|------|---------|
| `2026-01-22-siteproof-comprehensive-testing.md` | Comprehensive testing program design |
| `2026-01-23-foreman-mobile-ui.md` | Foreman mobile UI plan |
| `2026-01-24-foreman-mobile-ux-restructure.md` | Foreman mobile UX restructure |
| `2026-01-27-foreman-mobile-browser-test-plan.md` | Foreman mobile browser test plan |
| `2026-01-27-mobile-diary-timeline.md` | Mobile diary timeline |
| `2026-01-29-mobile-itp-completion-design.md` | Mobile ITP completion design |
| `2026-01-29-subcontractor-itp-permissions-design.md` | Subbie ITP permissions design |
| `2026-01-29-subcontractor-itp-permissions-implementation.md` | Subbie ITP permissions implementation |
| `2026-02-02-codebase-remediation-plan.md` | Codebase remediation plan |
| `2026-02-02-itp-flexibility-design.md` | ITP flexibility design |
| `2026-02-02-state-based-test-filtering-design.md` | State-based test filtering design |
| `foreman-mobile-handoff.md` | Foreman mobile handoff doc |

### Research briefs (Feb 2026)

| File | Subject |
|------|---------|
| `research-brief-launch-readiness.md` | Pre-launch research |
| `research-brief-qld-itp-templates.md` | QLD ITP template research brief |
| `research-brief-sa-itp-templates.md` | SA ITP template research brief |
| `research-brief-vic-itp-templates.md` | VIC ITP template research brief |

Note: the consolidated research outputs that backed these briefs remain at `docs/research/qld-itp/`, `docs/research/sa-dit-*`, and `docs/research/vic-itp/` and are still current.

### Reference / persona / source material (Jan–Feb 2026)

| File | Subject |
|------|---------|
| `Foreman persona document (AU civil).md` | Foreman persona research |
| `ITP-TEMPLATE-RESEARCH-PROMPT.md` | Research-prompt scratch |
| `landing-page-spec.md` | Superseded landing page specification |
| `Mobile App Development Best Practices.md` | Generic mobile dev write-up |
| `test-execution-plan.md` | Superseded manual test execution plan |
| `test-plan-full-regression.md` | Superseded full regression test plan |
| `tmr-mrts-itp-raw.txt` | Raw TMR MRTS ITP source text (used by QLD research) |

## Internal cross-references

Several files in this folder cross-reference each other using their original (pre-archive) paths — e.g. `docs/plans/2026-01-24-...` or `docs/Foreman persona document (AU civil).md`. Those paths are stale; the files now live alongside one another in this directory. The contents were preserved exactly (no in-line link rewrites) because these are frozen historical artifacts.

## Why not deleted?

These files weren't dead code — they were design plans and research that informed shipped features. Deleting them would lose useful provenance. Archiving keeps them searchable and `git log --follow`-traceable while removing clutter from the top-level `docs/` view.
