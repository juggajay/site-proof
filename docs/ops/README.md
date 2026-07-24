# docs/ops — Customer Operations

Operational documentation for CIVOS (SiteProof v3) customer/procurement due diligence.

## Contents

- [`customer-operations-pack.md`](customer-operations-pack.md) — the single
  procurement-readiness pack: backup & recovery, incident response, monitoring,
  support, data handling, subprocessors, production access, security posture,
  insurance, and customer implementation runbook. Every line item is tagged
  **[VERIFIED]** / **[NOT-YET-VERIFIED]** / **[JAY-ACTION]** with evidence.

Related existing docs (not superseded by this pack):

- [`../database-backup-restore-runbook.md`](../database-backup-restore-runbook.md) — DB backup/restore detail.
- [`../production-readiness-audit.md`](../production-readiness-audit.md) — codebase readiness evidence.
- [`../supabase-storage-setup.md`](../supabase-storage-setup.md) — storage configuration.

## State roll-up (as of 2026-07-24)

Tag occurrences in the pack (some states are restated in prose, so the
occurrence count is higher than the number of distinct line items):

| State | Tag occurrences |
|-------|-----------------|
| **[VERIFIED]** | 61 |
| **[NOT-YET-VERIFIED]** | 12 |
| **[JAY-ACTION]** | 30 (22 distinct actions — see below) |

Verified = confirmed from repo code/config/CI/docs. Not-yet-verified = depends on
vendor dashboards we cannot read (Railway/Supabase/Vercel/Anthropic/GitHub
settings). Jay-action = a founder decision or task.

## Distinct [JAY-ACTION] items (the to-do list)

1. Execute and record a database **restore drill** (tooling exists; never run) — §1.
2. Establish a **Supabase Storage backup** — no repo mechanism backs up the `documents` bucket — §1.
3. Adopt a written **incident-response procedure** (severity/escalation/comms) — §2.
4. Name a **security/disclosure contact + backup responder** distinct from the shared support inbox — §2.
5. Confirm **Notifiable Data Breach** obligations with a legal advisor — §2.
6. Add an **external uptime monitor** polling `/ready` — §3.
7. Stand up a **public status page** — §3.
8. Establish a **customer outage-notification** mechanism — §3.
9. Publish **support hours** — §4.
10. Adopt a **support response-time / severity SLA** — §4.
11. Decide on **phone support** / publish a number — §4.
12. Build or formalise a **whole-company / full-tenant export** (export is per-user only today) — §5.
13. Build or formalise a **tenant offboarding** procedure (delete/return all company data) — §5.
14. Implement **automated retention/purge** to enforce the stated 7-year policy — §5.
15. Sign **DPAs** with each subprocessor — §7.
16. Establish **formal change-approval / segregation of duties** (second approver) — §8.
17. Commission a **penetration test** — §9.
18. Decide on **ISO 27001 / SOC 2** posture (or state plainly that none exist) — §9.
19. **Substantiate or soften** the Privacy Policy security claims ("ISO 27001 certified providers", "regular security audits") so public copy does not outrun evidence — §9.
20. Obtain **cyber liability insurance** — §10.
21. Obtain **professional indemnity insurance** — §10.
22. Clarify **public liability** cover for the software entity — §10.

## Maintenance

When product capability changes, update the pack's tables and re-run the state
counts:

```bash
for s in VERIFIED NOT-YET-VERIFIED JAY-ACTION; do \
  echo "$s: $(grep -o "\[$s\]" docs/ops/customer-operations-pack.md | wc -l)"; done
```
