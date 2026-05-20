---
name: siteproof-codebase-review
description: Deprecated SiteProof-specific codebase review skill. Use only to redirect agents to the current handoff and review tooling.
---

# Deprecated SiteProof Codebase Review Skill

This skill is intentionally retained as a compatibility stub so older agent
prompts that mention `siteproof-codebase-review` do not silently run the stale
February 2026 workflow.

Do not use the old six-subagent review process that previously lived here. It
was written before the May 2026 DeepSec hardening, production-readiness fixes,
repo-hygiene cleanup, and agent-handoff refreshes. It also encouraged agents to
spawn generic subagents, which conflicts with the current repo rule that Jay
means real Claude when he says "Claude".

## Current Review Entry Points

Use these current sources instead:

- `CLAUDE.md` — canonical architecture, commands, production warnings, and
  workflow rules.
- `docs/agent-handoff.md` — current workstream status, completed PR ranges,
  live follow-ups, and agent-specific cautions.
- `docs/production-readiness-audit.md` — active production-readiness evidence
  checklist.
- `.deepsec/README.md` and DeepSec status/export commands — current security
  finding workflow. Do not read `.deepsec/data/**/files/**` mirrored snapshots.
- GitHub PR checks and local focused tests for any concrete code change.

## If Asked For A Fresh Codebase Review

1. Read `CLAUDE.md`, `docs/agent-handoff.md`, and `tasks/lessons.md`.
2. Confirm the scope with Jay: report-only review, security review, QA pass, or
   implementation PR queue.
3. Use the current repo tooling for that scope instead of this deprecated skill.
4. If Jay asks for Claude, do not substitute a Codex subagent unless Jay
   explicitly approves that substitution.

This file should not generate new reports on its own. It exists to prevent stale
instructions from being treated as active project guidance.
