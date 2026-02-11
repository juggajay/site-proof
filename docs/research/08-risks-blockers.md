# SiteProof Launch: Risk & Blocker Assessment

**Date:** February 2026
**Author:** Risk Analysis (AI-Assisted)
**Version:** 1.0
**Classification:** Internal / Confidential

---

## Executive Summary

SiteProof faces a manageable but non-trivial set of risks heading into its launch as a quality management platform for Australian civil contractors. This assessment identifies **22 distinct risks** across technical, market, operational, and legal dimensions, with **5 classified as critical** requiring immediate mitigation.

**The top 5 risks that could derail or significantly delay launch are:**

1. **Bundle size (3.46MB) causing unacceptable field performance** -- Construction sites frequently have degraded mobile connectivity. At 3.46MB uncompressed, SiteProof's initial load will take 15-30+ seconds on 3G networks common at remote civil sites. The industry performance budget recommendation is 150KB gzipped JavaScript. This is a launch blocker.

2. **iOS Safari IndexedDB instability for offline workflows** -- Apple's aggressive 7-day eviction policy, 50MB PWA cache limits, and documented IndexedDB corruption issues on iOS make offline-first functionality unreliable for the ~55% of Australian smartphone users on iPhones. Field workers who cache inspections offline may lose data.

3. **Missing legal framework (Terms of Service, Privacy Policy, disclaimers)** -- The December 2024 Privacy Act amendments introduced a statutory tort for serious privacy invasions (effective June 2025) and new automated decision transparency requirements. SiteProof cannot launch without compliant legal documents, and construction-specific liability disclaimers around audit reliance are essential.

4. **No defined support infrastructure** -- Construction field workers expect phone-based support with fast response times. SiteProof currently has no support channel, SLA, or incident response process. B2B SaaS benchmarks show 0.2-0.5 tickets per customer per month; even 50 users will generate 10-25 monthly tickets requiring structured handling.

5. **N+1 query degradation at scale in portfolio views** -- Current Prisma ORM patterns likely contain N+1 queries in list/portfolio views. These are invisible in development but will cause 5-10x response time degradation once a company has 50+ projects with hundreds of lots each.

**Recommended timeline impact:** Address items 1 and 3 before any public launch. Items 2 and 5 can ship with known limitations if documented. Item 4 requires minimum viable support (email + in-app chat) at launch.

---

## Table of Contents

1. [Risk Register Matrix](#1-risk-register-matrix)
2. [Top 5 Risk Mitigation Plans](#2-top-5-risk-mitigation-plans)
3. [Technical Risk Deep-Dive](#3-technical-risk-deep-dive)
4. [Market Risk Analysis](#4-market-risk-analysis)
5. [Operational Risk Analysis](#5-operational-risk-analysis)
6. [Legal Requirements Checklist](#6-legal-requirements-checklist)
7. [Action Items](#7-action-items)
8. [Sources](#8-sources)

---

## 1. Risk Register Matrix

### Likelihood x Impact Scoring

| Score | Likelihood | Impact |
|-------|-----------|--------|
| 1 | Rare (<10%) | Negligible |
| 2 | Unlikely (10-30%) | Minor |
| 3 | Possible (30-60%) | Moderate |
| 4 | Likely (60-85%) | Major |
| 5 | Almost Certain (>85%) | Critical |

**Risk Score = Likelihood x Impact** (1-25 scale)

| Rating | Score Range | Action Required |
|--------|------------|-----------------|
| Critical | 15-25 | Immediate mitigation before launch |
| High | 10-14 | Mitigation plan required, may delay launch |
| Medium | 5-9 | Monitor and plan mitigation |
| Low | 1-4 | Accept and monitor |

### Technical Risks

| ID | Risk | Likelihood | Impact | Score | Rating |
|----|------|-----------|--------|-------|--------|
| T1 | Bundle size (3.46MB) causes unacceptable load times on construction site networks | 5 | 5 | **25** | CRITICAL |
| T2 | iOS Safari IndexedDB eviction/corruption loses offline data | 4 | 5 | **20** | CRITICAL |
| T3 | N+1 queries degrade portfolio view performance at scale | 4 | 4 | **16** | CRITICAL |
| T4 | Offline sync conflicts cause data loss or duplication | 3 | 5 | **15** | CRITICAL |
| T5 | Supabase outage causes complete platform unavailability | 2 | 5 | **10** | HIGH |
| T6 | Image/document uploads fail on poor connections without resume | 4 | 3 | **12** | HIGH |
| T7 | Prisma cold start latency on serverless/Railway | 3 | 3 | **9** | MEDIUM |
| T8 | JWT token expiry during long offline sessions causes data loss | 3 | 3 | **9** | MEDIUM |

### Market Risks

| ID | Risk | Likelihood | Impact | Score | Rating |
|----|------|-----------|--------|-------|--------|
| M1 | Procore/Autodesk aggressively targets AU civil niche | 3 | 4 | **12** | HIGH |
| M2 | State authority mandates specific compliance platforms | 2 | 4 | **8** | MEDIUM |
| M3 | AU infrastructure pipeline slowdown reduces customer base | 2 | 3 | **6** | MEDIUM |
| M4 | Open-source alternative gains traction in AU market | 1 | 3 | **3** | LOW |
| M5 | Price sensitivity -- civil contractors resist SaaS subscription model | 3 | 3 | **9** | MEDIUM |
| M6 | Competitor launches AI-native QA platform targeting same niche | 2 | 4 | **8** | MEDIUM |

### Operational Risks

| ID | Risk | Likelihood | Impact | Score | Rating |
|----|------|-----------|--------|-------|--------|
| O1 | No support infrastructure at launch causes churn | 4 | 4 | **16** | CRITICAL |
| O2 | Critical bug in production with no incident response process | 3 | 5 | **15** | CRITICAL |
| O3 | Onboarding complexity causes abandonment in first week | 3 | 4 | **12** | HIGH |
| O4 | Single point of failure in team knowledge (bus factor) | 3 | 4 | **12** | HIGH |
| O5 | Data migration from spreadsheets/legacy systems is painful | 4 | 2 | **8** | MEDIUM |

### Legal Risks

| ID | Risk | Likelihood | Impact | Score | Rating |
|----|------|-----------|--------|-------|--------|
| L1 | Missing/inadequate Terms of Service and Privacy Policy | 5 | 4 | **20** | CRITICAL |
| L2 | Liability if contractor relies on SiteProof data and fails audit | 3 | 5 | **15** | CRITICAL |
| L3 | No professional indemnity insurance | 4 | 4 | **16** | CRITICAL |
| L4 | Non-compliance with Privacy Act 2024 amendments | 3 | 4 | **12** | HIGH |

### Risk Heat Map

```
IMPACT
  5 |  T5    T2,T4,O2  T1
    |        L2
  4 |  M2,M6 M1,O3,O4  T3,O1,L3
    |        L4        L1
  3 |  M3,M4 T7,T8,M5  T6
    |        O5
  2 |
    |
  1 |
    +------------------------
      1     2     3     4     5
                LIKELIHOOD
```

---

## 2. Top 5 Risk Mitigation Plans

### Mitigation #1: Bundle Size (T1) -- LAUNCH BLOCKER

**Current State:** 3.46MB uncompressed bundle. On a 3G connection (1.6 Mbps effective throughput), this takes ~17 seconds to download. On degraded 4G at a remote civil site, 5-8 seconds. Neither meets the 3-second user expectation threshold.

**Target:** Under 150KB gzipped for initial JavaScript payload (industry standard per Google performance budget recommendations).

**Mitigation Steps:**

| Step | Action | Effort | Expected Reduction |
|------|--------|--------|-------------------|
| 1 | Implement route-based code splitting with React.lazy() for all pages | 2 days | 40-50% initial load |
| 2 | Audit and tree-shake unused dependencies (run `npx vite-bundle-visualizer`) | 1 day | 10-20% |
| 3 | Move heavy libraries (PDF generation, charting) to dynamic imports | 1 day | 15-25% |
| 4 | Configure Vite manualChunks to separate vendor libraries | 0.5 day | Better caching |
| 5 | Enable gzip/brotli compression on Railway deployment | 0.5 day | 60-70% transfer size |
| 6 | Implement service worker precaching for repeat visits | 1 day | Near-instant reload |
| 7 | Add performance monitoring (Core Web Vitals tracking) | 0.5 day | Ongoing visibility |

**Success Criteria:** LCP under 2.5 seconds on throttled 4G (DevTools simulation). Initial JS payload under 200KB gzipped.

**Owner:** Frontend lead
**Deadline:** Before any public beta

---

### Mitigation #2: iOS Safari IndexedDB Instability (T2)

**Current State:** SiteProof may plan to use Dexie.js/IndexedDB for offline data. iOS Safari has documented issues including:
- 7-day eviction of unused origin data (data deleted if user hasn't interacted in 7 days)
- 50MB strict PWA cache limit
- Known IndexedDB corruption and transaction failure bugs
- FormData/Blob limitations in service workers on Safari

**Mitigation Steps:**

| Step | Action | Effort |
|------|--------|--------|
| 1 | Implement "sync status" indicator showing users when data is cached vs. synced | 1 day |
| 2 | Add periodic background sync attempts when connection is available | 2 days |
| 3 | Implement data export/backup to prevent loss from eviction | 1 day |
| 4 | Add "last synced" timestamps visible to users on all offline-capable views | 0.5 day |
| 5 | Test extensively on real iOS devices (not simulators) across iOS 16-17+ | 2 days |
| 6 | Implement graceful degradation: detect IndexedDB failures and fall back to server-only mode | 1 day |
| 7 | Document known iOS limitations for users; recommend Chrome on Android for best offline experience | 0.5 day |
| 8 | Evaluate Dexie Cloud for managed sync if self-built sync proves unreliable | 1 day evaluation |

**Success Criteria:** Zero silent data loss. Users always know sync state. Graceful handling of eviction events.

**Owner:** Frontend lead
**Deadline:** Before offline features are marketed

---

### Mitigation #3: Missing Legal Framework (L1, L2, L3)

**Current State:** No Terms of Service, Privacy Policy, or construction-specific disclaimers exist. The December 2024 Privacy Act amendments are now in effect with significant new requirements.

**Mitigation Steps:**

| Step | Action | Effort | Cost |
|------|--------|--------|------|
| 1 | Engage Australian SaaS/technology lawyer for TOS + Privacy Policy drafting | 1-2 weeks | $3,000-8,000 |
| 2 | Add construction-specific disclaimers (data accuracy, audit reliance, compliance) | Included above | Included |
| 3 | Implement cookie consent and privacy preference centre | 2 days dev | -- |
| 4 | Add automated decision-making disclosure (Privacy Act 2024 requirement, 24-month grace) | 1 day dev | -- |
| 5 | Obtain professional indemnity insurance (PI) | 1-2 weeks | $2,000-5,000/yr |
| 6 | Obtain cyber liability insurance | 1-2 weeks | $1,500-4,000/yr |
| 7 | Implement data processing agreement template for enterprise customers | Included in step 1 | Included |
| 8 | Add "SiteProof is a tool, not a substitute for professional judgement" disclaimer in key workflows | 1 day dev | -- |

**Success Criteria:** Legally reviewed TOS + Privacy Policy live on site. PI and cyber insurance certificates available. Construction-specific disclaimers on all compliance-related features.

**Owner:** Founder + Legal counsel
**Deadline:** Absolute launch blocker -- must be complete before first paying customer

---

### Mitigation #4: Support Infrastructure (O1, O2)

**Current State:** No customer support channels, SLA, or incident response process exist. Construction field workers are a demanding user base -- they need fast, practical help when they're on site and something isn't working.

**Benchmarks:**
- B2B SaaS: 0.2-0.5 tickets per customer per month
- At 50 users: expect 10-25 tickets/month
- At 200 users: expect 40-100 tickets/month
- Response time expectation: 90% of customers rate "immediate" as critical; 60% define "immediate" as within 10 minutes

**Minimum Viable Support (Launch):**

| Channel | Tool | Cost | Notes |
|---------|------|------|-------|
| Email support | Shared inbox (e.g., help@siteproof.com.au) | Free | Respond within 4 business hours |
| In-app chat | Intercom Starter or Crisp | $29-65/mo | Self-service + live chat |
| Knowledge base | Help centre (Intercom/Notion) | Included | 20+ articles covering core workflows |
| Status page | Betteruptime or similar | Free tier | Uptime monitoring + incident communication |
| Incident response | Documented runbook | 2 days to write | Escalation path, rollback procedures |

**Scaling Support (100+ Users):**

| Addition | Trigger | Cost |
|----------|---------|------|
| Phone support (AU number) | 100+ users or enterprise contract | $200-500/mo (virtual reception) |
| Dedicated support hire | 200+ users or >50 tickets/month | $60-80k/yr |
| SLA guarantees | Enterprise contracts | Define tiers: 1hr/4hr/24hr by severity |

**Success Criteria:** Every user inquiry gets a response within 4 business hours. Critical issues (data loss, full outage) get response within 1 hour. Status page operational.

**Owner:** Founder (initially)
**Deadline:** Support email + knowledge base before launch. Chat within 30 days of launch.

---

### Mitigation #5: N+1 Query Performance (T3)

**Current State:** Prisma ORM's default behavior of lazy-loading relations creates N+1 patterns. In portfolio/list views (e.g., "all lots across all projects"), a company with 20 projects and 100 lots each could generate 2,000+ database queries per page load.

**When It Becomes a Problem:**
- **10 users, 5 projects:** Invisible. Queries complete in <500ms.
- **50 users, 20 projects:** Noticeable. Portfolio views take 2-5 seconds.
- **200 users, 50+ projects:** Breaking. Timeouts, connection pool exhaustion, cascading failures.

**Mitigation Steps:**

| Step | Action | Effort |
|------|--------|--------|
| 1 | Audit all Prisma queries using `prisma.$queryRawUnsafe` logging or Prisma query events | 1 day |
| 2 | Add `include` and `select` to all list endpoint queries (eager loading) | 2-3 days |
| 3 | Implement pagination on all list endpoints (default 50 items) | 2 days |
| 4 | Add database indexes on foreign keys and commonly filtered columns | 0.5 day |
| 5 | Implement query response time monitoring (log queries >500ms) | 0.5 day |
| 6 | Add connection pooling configuration (PgBouncer or Supabase pooler) | 0.5 day |
| 7 | Consider materialised views for portfolio dashboard aggregations | 2 days (future) |

**Success Criteria:** No endpoint exceeds 1 second response time with 1,000 lots across 50 projects. Zero N+1 patterns in list/portfolio views.

**Owner:** Backend lead
**Deadline:** Before onboarding any customer with >10 projects

---

## 3. Technical Risk Deep-Dive

### 3.1 Bundle Size Analysis

**The Problem in Numbers:**

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Uncompressed bundle | ~3.46MB | <500KB initial | 7x over |
| Gzipped transfer (est.) | ~900KB-1.1MB | <150KB | 6-7x over |
| 3G load time (1.6 Mbps) | ~17 seconds | <3 seconds | 5.7x over |
| 4G load time (good signal) | ~3-5 seconds | <2 seconds | 1.5-2.5x over |
| 4G load time (degraded/rural) | ~8-12 seconds | <3 seconds | 2.7-4x over |

**Why This Matters for Construction:**

Civil construction sites in Australia are frequently located in:
- Rural and regional areas with limited 4G coverage
- Underground or below-grade environments (tunnels, basements)
- Remote infrastructure corridors (rail, pipeline)
- Areas with high electromagnetic interference from heavy equipment

The performance inequality gap is significant: while developers test on fast office Wi-Fi, field workers on construction sites often have 3G-equivalent or worse connectivity. A 2021 analysis by Alex Russell showed that the global baseline for JavaScript payload should be approximately 300-350KB compressed on the wire, and the recommended performance budget per Google is 150KB gzipped JavaScript for initial load.

**Bundle Composition (Estimated, requires `vite-bundle-visualizer` to confirm):**

Based on the tech stack (React 18, TanStack Query, Zustand, React Hook Form, Zod, shadcn/ui, Tailwind, PDF generation), likely contributors:

| Library | Est. Size (gzipped) | Lazy-loadable? |
|---------|---------------------|----------------|
| React + React DOM | ~42KB | No (core) |
| TanStack Query | ~12KB | No (core) |
| React Router | ~10KB | No (core) |
| shadcn/ui + Radix | ~30-50KB | Partially |
| Tailwind CSS | ~10-30KB (purged) | No (core) |
| PDF generation (pdfGenerator.ts) | ~100-200KB | Yes |
| Zod | ~12KB | No (core) |
| React Hook Form | ~9KB | No (core) |
| Other dependencies | ~50-100KB | Varies |

**Recommendation:** The single largest win will be route-based code splitting combined with lazy-loading the PDF generator (which at 2,915 lines is a significant chunk). The initial route should only load the dashboard, with all other pages loaded on navigation.

### 3.2 IndexedDB/Dexie Offline Deep-Dive

**iOS Safari Specific Issues:**

| Issue | Severity | Workaround Available? |
|-------|----------|----------------------|
| 7-day data eviction for unused origins | HIGH | Partial -- user must interact with site regularly |
| 50MB PWA cache limit | MEDIUM | Yes -- prioritise critical data, compress |
| IndexedDB corruption on version upgrades | HIGH | Partial -- implement integrity checks |
| FormData not supported in service workers | LOW | Yes -- convert Blob to data URL |
| No background sync API | MEDIUM | Partial -- sync on foreground resume |
| No persistent storage permission prompt | HIGH | No -- cannot guarantee persistence |

**Storage Limits by Platform:**

| Platform | IndexedDB Limit | Notes |
|----------|----------------|-------|
| Chrome (Android) | Up to 80% disk | Persistent storage available via API |
| Chrome (Desktop) | Up to 80% disk | Can request persistent storage |
| Safari (iOS 17+) | Up to 80% disk (browser) | **But 50MB for PWA; 7-day eviction** |
| Safari (macOS) | Up to 80% disk | More generous than iOS |
| Firefox | Up to 50% disk | Eviction possible under storage pressure |

**Key Dexie.js Limitations for SiteProof:**

1. **Sync is hard:** Four concurrent challenges: (a) only sending unsynced data, (b) managing what to send, (c) preventing duplicates, (d) handling new data during sync.
2. **Conflict resolution:** When a field worker edits offline and a project manager edits the same record online, who wins? Dexie has no built-in conflict resolution.
3. **Dexie Cloud** is the commercial solution ($) but adds vendor dependency.
4. **Testing complexity:** Must test on actual iOS devices; simulators do not accurately reproduce Safari storage behaviour.

**Recommendation:** Ship with explicit "online-preferred" mode. Offline should be a graceful degradation (queue submissions, display cached data) rather than a full offline-first architecture. Display clear sync indicators. Do not promise offline editing of shared records without a robust conflict resolution strategy.

### 3.3 N+1 Query Scaling Thresholds

**Modelled degradation based on typical Prisma patterns:**

| Data Scale | Estimated Queries (N+1) | Response Time | User Experience |
|------------|------------------------|---------------|-----------------|
| 5 projects, 50 lots | ~55 queries | 200ms | Acceptable |
| 20 projects, 200 lots | ~220 queries | 800ms-1.5s | Noticeable delay |
| 50 projects, 500 lots | ~550 queries | 3-8s | Frustrating |
| 100 projects, 1000 lots | ~1,100 queries | 10-30s+ | Broken |

**Critical paths likely affected:**
- Portfolio dashboard (all projects summary)
- Lots list with ITP completion status
- NCR register across projects
- Daily diary calendar view
- Progress claims with lot references

**PostgreSQL connection pool exhaustion:**
At 50+ concurrent queries per request and Supabase's default connection limits, a handful of simultaneous users hitting portfolio views could exhaust the pool. Supabase free tier allows 60 connections; Pro tier allows 200.

### 3.4 Uptime and Infrastructure

**SLA Expectations for Construction SaaS:**

| Tier | Uptime | Annual Downtime | Suitable For |
|------|--------|-----------------|-------------|
| 99.5% | 43.8 hours/year | ~3.65 hrs/month | Early-stage startup, non-critical |
| 99.9% | 8.76 hours/year | ~43 min/month | **Standard for enterprise B2B SaaS** |
| 99.95% | 4.38 hours/year | ~22 min/month | Large enterprise |
| 99.99% | 52.6 minutes/year | ~4.4 min/month | Mission-critical only |

**Recommendation for SiteProof:** Target 99.9% uptime in SLA. This is the industry gold standard for enterprise SaaS. Railway (hosting) and Supabase (database) both publish 99.9%+ uptime, but SiteProof's effective SLA is the product of all dependencies:

Effective Uptime = Railway uptime x Supabase uptime x Supabase Storage uptime

If each is 99.9%, effective uptime = 99.7% (26 hours/year downtime). This means SiteProof should NOT promise 99.9% unless it has redundancy on at least one layer.

---

## 4. Market Risk Analysis

### 4.1 Procore/Autodesk Acquisition Threat (M1)

**Current Landscape:**
- Procore has 313 Australian customers (~4.32% of global user base)
- Construction software market projected to reach USD 16.62 billion by 2030 (9.33% CAGR)
- Procore is actively launching infrastructure-specific modules for handovers and project tracking
- Autodesk Construction Cloud is gaining share, with documented switching from Procore to ACC

**Threat Level: HIGH but Manageable**

SiteProof's moat is vertical specialisation in AU civil quality management (ITPs, hold points, NCRs). Procore and Autodesk are horizontal platforms -- they cover everything broadly but lack depth in AU civil-specific compliance workflows. However:

- Procore could acquire an AU civil niche player at any time
- Autodesk could partner with state road authorities for mandated compliance
- Both can undercut on price to buy market share

**Defensive Strategy:**
1. Become the de facto standard for AU civil quality specifically -- depth over breadth
2. Build integrations WITH Procore/Autodesk (complementary, not competitive positioning)
3. Focus on SMB civil contractors who find Procore too expensive and complex
4. Build switching costs through data accumulation and workflow customisation

### 4.2 State Authority Platform Mandation (M2)

**Current State:** No Australian state currently mandates a specific quality management platform. However:
- State road authorities (VicRoads, Transport for NSW, TMR Queensland) do mandate specific ITP formats and hold point processes
- The National Construction Code (NCC) sets baseline requirements enforced at state level
- WorkSafe/SafeWork regulators conduct inspections but don't mandate specific software

**Risk Assessment:** Low-to-medium probability. Government mandates tend to specify standards and formats, not specific software vendors. If anything, this creates an opportunity: SiteProof could position itself as the platform that best aligns with state authority requirements.

### 4.3 Infrastructure Pipeline Slowdown (M3)

**Current Data:**
- AU major public infrastructure pipeline valued at $213 billion over 5 years (2023-2028)
- 8% drop in pipeline value in the last 12 months
- NSW and Victoria reduced by $39 billion; Queensland and NT grew by $16 billion
- Construction output still expected to grow 3.8% in 2025, 3% CAGR through 2029
- Peak workforce demand shifted from mid-2026 to mid-2027

**Assessment:** The pipeline is shifting geographically (south to north) and temporally (delays), but total investment remains substantial. Growth is slowing, not contracting. SiteProof should target states with growing pipelines (QLD, NT, WA) alongside established markets (NSW, VIC).

### 4.4 Open-Source Alternatives (M4)

**Current State:** No credible open-source construction quality management platform exists. All identified Procore alternatives (Mastt, Archdesk, Fieldwire, Oracle, etc.) are commercial products. The construction industry has very low open-source adoption due to:
- Compliance and liability concerns
- Need for vendor support and guarantees
- Low technical sophistication of end users
- Data security and privacy requirements

**Assessment:** Minimal risk. Construction is not a sector where open-source disruption is likely in the near term.

---

## 5. Operational Risk Analysis

### 5.1 Support Infrastructure Requirements

**What Construction Field Workers Expect:**

Construction field workers are not typical SaaS users. They are:
- Working in harsh physical environments (dust, rain, bright sunlight)
- Under time pressure (hold points have contractual deadlines)
- Often not tech-native (especially older foremen and site managers)
- Frustrated quickly by anything that "doesn't just work"
- Accustomed to picking up the phone, not writing support tickets

**Minimum Support Requirements by User Count:**

| Users | Channels Required | Staff | Monthly Cost |
|-------|------------------|-------|-------------|
| 0-50 | Email + Knowledge Base | Founder (part-time) | $0-100 |
| 50-100 | Email + Chat + Knowledge Base | 0.5 FTE or outsourced | $1,000-3,000 |
| 100-300 | Email + Chat + Phone (AU hours) + Knowledge Base | 1 FTE | $5,000-8,000 |
| 300+ | All channels + Dedicated CSM + SLA tiers | 2+ FTE | $12,000+ |

**Support Ticket Volume Projections:**

Based on industry benchmarks of 0.2-0.5 tickets per customer per month:

| Users | Monthly Tickets (Low) | Monthly Tickets (High) | Peak Tickets (Launch Month) |
|-------|----------------------|------------------------|---------------------------|
| 50 | 10 | 25 | 50-75 (2-3x normal) |
| 100 | 20 | 50 | 100-150 |
| 200 | 40 | 100 | 200-300 |

**Note:** Launch month and first 90 days typically see 2-3x normal ticket volume due to onboarding issues, feature requests, and expectations calibration.

### 5.2 Incident Response Requirements

**Expected SLA by Severity:**

| Severity | Definition | Response Time | Resolution Target |
|----------|-----------|--------------|-------------------|
| P1 - Critical | Platform down, data loss risk | 1 hour | 4 hours |
| P2 - Major | Core feature broken, workaround exists | 4 hours | 24 hours |
| P3 - Minor | Non-critical feature broken | 24 hours | 5 business days |
| P4 - Low | Enhancement request, cosmetic issue | 48 hours | Next release |

**Incident Response Requirements Before Launch:**
- [ ] Monitoring and alerting (uptime, error rates, response times)
- [ ] On-call rotation (even if one person initially)
- [ ] Incident response runbook (detect > assess > communicate > fix > post-mortem)
- [ ] Status page (public-facing)
- [ ] Database backup and restore procedure (tested)
- [ ] Rollback procedure for bad deployments
- [ ] Customer communication templates for outages

### 5.3 AU-Based Support Team Necessity

**Assessment:** For the first 100 users, AU-based support is helpful but not strictly necessary. However:
- AU business hours (AEST/AEDT) must be covered
- Construction typically starts at 6:00-6:30 AM, so support from 6 AM AEST is ideal
- "Mate, I can't get this bloody thing to work" calls need someone who understands the lingo
- Cultural familiarity with AU civil construction terminology is a genuine advantage

**Recommendation:** Founder or AU-based contractor for initial support. Do not outsource to offshore support until the knowledge base is extremely comprehensive.

---

## 6. Legal Requirements Checklist

### 6.1 Terms of Service Requirements (AU)

- [ ] **Governing law clause** -- specify Australian state (e.g., "Laws of New South Wales")
- [ ] **Limitation of liability** -- cap at 12 months of fees paid (standard SaaS), with carve-outs for gross negligence, wilful misconduct, and IP infringement
- [ ] **Data accuracy disclaimer** -- "SiteProof provides tools to assist with quality management. Data entered and maintained in SiteProof is the responsibility of the user. SiteProof does not guarantee compliance with any regulatory standard."
- [ ] **Audit reliance disclaimer** -- "SiteProof is not a substitute for professional engineering judgement, independent quality assurance, or regulatory compliance verification."
- [ ] **Acceptable use policy** -- define prohibited uses
- [ ] **Suspension and termination clauses** -- rights to suspend for non-payment or TOS violation
- [ ] **Data portability** -- commit to data export in standard formats on termination
- [ ] **Service level commitment** -- target uptime with remedy (service credits)
- [ ] **IP ownership** -- SiteProof owns platform; customer owns their data
- [ ] **Unfair contract terms compliance** -- per ACL, ensure no terms are one-sided or unduly harsh
- [ ] **Force majeure clause** -- covering natural disasters, pandemics, etc.

### 6.2 Privacy Policy Requirements (AU)

Under the Privacy Act 1988 (as amended December 2024):

- [ ] **APP 1: Open and transparent management** -- clear privacy policy accessible from website
- [ ] **APP 5: Notification of collection** -- state what personal info is collected and why
- [ ] **APP 6: Use and disclosure** -- only use data for stated purposes
- [ ] **APP 8: Cross-border disclosure** -- disclose if data is processed outside Australia (Supabase servers, Resend email, etc.)
- [ ] **APP 11: Security of personal information** -- describe security measures
- [ ] **APP 12: Access to personal information** -- provide mechanism for users to access their data
- [ ] **APP 13: Correction of personal information** -- provide mechanism for users to correct data
- [ ] **Notifiable Data Breaches scheme** -- process to notify OAIC within 30 days of eligible breach
- [ ] **Statutory tort for privacy invasion** (effective June 2025) -- ensure data handling cannot constitute "serious invasion of privacy"
- [ ] **Automated decision-making transparency** (24-month grace period from Dec 2024) -- disclose any automated decisions affecting users
- [ ] **Data retention policy** -- specify how long data is kept and when it's deleted
- [ ] **Third-party sub-processors** -- list all services that process user data (Supabase, Resend, Railway, etc.)

### 6.3 Construction-Specific Disclaimers

- [ ] **No compliance guarantee** -- "Use of SiteProof does not guarantee compliance with NCC, WHS regulations, or state/territory construction requirements"
- [ ] **ITP completion disclaimer** -- "ITP checklists in SiteProof are configuration tools. Users are responsible for ensuring ITP templates meet project and regulatory requirements"
- [ ] **Hold point disclaimer** -- "SiteProof notifications for hold points are a convenience feature. Contractual hold point obligations remain the responsibility of the contractor and superintendent"
- [ ] **NCR tracking disclaimer** -- "SiteProof assists with tracking non-conformances. SiteProof does not verify the accuracy, completeness, or adequacy of NCR resolution"
- [ ] **Document storage disclaimer** -- "While SiteProof stores documents, it is not a certified document management system for legal proceedings. Users should maintain independent records"

### 6.4 Insurance Requirements

| Insurance Type | Purpose | Estimated Annual Cost | Priority |
|---------------|---------|----------------------|----------|
| Professional Indemnity (PI) | Covers claims of negligent advice/service, breach of contract | $2,000-5,000/yr | **CRITICAL** |
| Cyber Liability | Covers data breach costs, notification, forensics | $1,500-4,000/yr | **CRITICAL** |
| Public Liability | General business liability | $500-1,500/yr | MEDIUM |
| Business Interruption | Covers revenue loss during outage | $500-1,000/yr | LOW |

**Note:** B2B enterprise customers will request Certificates of Insurance (COIs) before signing contracts. Professional indemnity is especially important given the compliance-adjacent nature of SiteProof's functionality. Australian providers such as upcover, BizCover, and Chubb offer PI policies tailored to technology startups.

---

## 7. Action Items

### Pre-Launch Blockers (Must Complete Before First Paying Customer)

| # | Action | Owner | Deadline | Effort | Depends On |
|---|--------|-------|----------|--------|------------|
| 1 | Run `vite-bundle-visualizer` and document actual bundle composition | Frontend | Week 1 | 2 hours | -- |
| 2 | Implement route-based code splitting for all pages | Frontend | Week 2 | 2 days | #1 |
| 3 | Lazy-load PDF generator and other heavy dependencies | Frontend | Week 2 | 1 day | #1 |
| 4 | Enable gzip/brotli on Railway deployment | DevOps | Week 1 | 2 hours | -- |
| 5 | Achieve <200KB gzipped initial payload; verify on throttled 4G | Frontend | Week 3 | -- | #2, #3, #4 |
| 6 | Engage AU technology lawyer for TOS + Privacy Policy | Founder | Week 1 | Initiate | -- |
| 7 | Legal documents reviewed and published on site | Founder | Week 4 | -- | #6 |
| 8 | Obtain professional indemnity insurance | Founder | Week 3 | 1-2 weeks | -- |
| 9 | Obtain cyber liability insurance | Founder | Week 3 | 1-2 weeks | -- |
| 10 | Set up support email (help@siteproof.com.au) | Founder | Week 1 | 1 hour | -- |
| 11 | Write initial knowledge base (20 articles covering core workflows) | Founder | Week 2-3 | 3-5 days | -- |
| 12 | Implement monitoring and alerting (uptime, errors, response times) | Backend | Week 2 | 1 day | -- |
| 13 | Write incident response runbook | Backend | Week 2 | 0.5 day | -- |
| 14 | Set up public status page | DevOps | Week 1 | 2 hours | -- |
| 15 | Add construction-specific disclaimers to ITP, Hold Point, and NCR features | Frontend | Week 3 | 1 day | #6 |

### Post-Launch / First 90 Days

| # | Action | Owner | Trigger | Effort |
|---|--------|-------|---------|--------|
| 16 | Audit all Prisma queries for N+1 patterns | Backend | Before 10th customer | 1 day |
| 17 | Add eager loading to all list endpoints | Backend | After #16 | 2-3 days |
| 18 | Implement pagination on all list endpoints | Backend | After #16 | 2 days |
| 19 | Set up in-app chat support (Intercom/Crisp) | Founder | 30 users | 0.5 day |
| 20 | Test offline features on real iOS devices (iPhone 13+, iOS 16-17) | QA | Before marketing offline | 2 days |
| 21 | Implement sync status indicators for offline features | Frontend | Before marketing offline | 1 day |
| 22 | Add Core Web Vitals monitoring to production | Frontend | Launch | 0.5 day |

### Strategic / Quarterly

| # | Action | Owner | Quarter | Notes |
|---|--------|-------|---------|-------|
| 23 | Evaluate Procore integration partnership | Founder | Q2 2026 | Complementary positioning |
| 24 | Map state authority ITP requirements for QLD, NSW, VIC | Product | Q2 2026 | Differentiation |
| 25 | Assess need for SOC 2 Type I certification | Founder | Q3 2026 | Enterprise sales requirement |
| 26 | Evaluate phone support outsourcing (AU-based) | Ops | 100 users | $200-500/mo |
| 27 | Review and update risk register | Founder | Quarterly | This document |

---

## 8. Sources

### Technical Performance

- [APM KPIs: Mobile App Performance Monitoring Metrics and Targets](https://www.luciq.ai/blog/app-performance-metrics-and-kpis)
- [Mobile Site Load Speed Statistics 2025](https://www.amraandelma.com/mobile-site-load-speed-statistics/)
- [Top Mobile App Performance Metrics 2026 - Medium](https://medium.com/@testwithblake/top-mobile-app-performance-metrics-every-product-team-should-monitor-in-2026-bb7cc4f45136)
- [Website Load Time Statistics 2026 - Hostinger](https://www.hostinger.com/tutorials/website-load-time-statistics)
- [Why Web Application Bundle Size Matters - RelativeCI](https://relative-ci.com/why-web-application-bundle-size-matters)
- [The Mobile Performance Inequality Gap - Alex Russell](https://infrequently.org/2021/03/the-performance-inequality-gap/)
- [Why 90% of Web Apps Fail Core Web Vitals in 2025](https://markaicode.com/core-web-vitals-fixes-2025/)
- [Working With Web Performance Budgets - DebugBear](https://www.debugbear.com/blog/working-with-performance-budgets)
- [Performance Budget Calculator](https://www.performancebudget.io/)
- [Optimizing React Vite Application - Reducing Bundle Size](https://shaxadd.medium.com/optimizing-your-react-vite-application-a-guide-to-reducing-bundle-size-6b7e93891c96)
- [Taming Large Chunks in Vite + React](https://www.mykolaaleksandrov.dev/posts/2025/11/taming-large-chunks-vite-react/)

### IndexedDB and Offline

- [Navigating Safari/iOS PWA Limitations - Vinova](https://vinova.sg/navigating-safari-ios-pwa-limitations/)
- [Updates to Storage Policy - WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)
- [PWA iOS Limitations and Safari Support - MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [IndexedDB Max Storage Size Limit - RxDB](https://rxdb.info/articles/indexeddb-max-storage-limit.html)
- [Storage Quotas and Eviction Criteria - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Service Worker Cache Storage Limit - Love2Dev](https://love2dev.com/blog/what-is-the-service-worker-cache-storage-limit/)
- [Current Progressive Web App Limitations on iOS - Tigren](https://www.tigren.com/blog/progressive-web-app-limitations/)
- [PWA Limitations Towards Browsers - Medium](https://medium.com/@zaffarabbasmughal/browsers-support-and-limitation-towards-pwa-2e6c58cd16d5)
- [Offline First with Dexie.js - Medium](https://medium.com/@bvjebin/yours-insanely-offline-first-3b946e526cc1)
- [Dexie.js - Build Offline-First Apps](https://dexie.org/)
- [Using Dexie.js in React for Offline Data Storage - LogRocket](https://blog.logrocket.com/dexie-js-indexeddb-react-apps-offline-data-storage/)

### SLA and Uptime

- [SLA & Uptime Calculator](https://uptime.is/)
- [Negotiate a SaaS SLA - TechTarget](https://www.techtarget.com/searchcloudcomputing/tip/Negotiate-a-SaaS-SLA-for-compliance-uptime-considerations)
- [SaaS SLA Guide 2026 - Spendflo](https://www.spendflo.com/blog/saas-service-level-agreements-sla)
- [Enterprise Ready SaaS - SLA and Support](https://www.enterpriseready.io/features/sla-support/)
- [Service Level Agreements in SaaS: Founder's Guide - Adlega](https://adlega.com/blog/service-level-agreements-in-saas-a-founders-complete-guide/)

### Market and Competition

- [Construction Software Market Size Report 2034 - Fortune Business Insights](https://www.fortunebusinessinsights.com/construction-software-market-110155)
- [Construction Management Software Market 2025-2030 - Mordor Intelligence](https://www.mordorintelligence.com/industry-reports/construction-management-software-market)
- [Procore Market Share in Project Collaboration - 6sense](https://6sense.com/tech/project-collaboration/procore-market-share)
- [Best 10 Procore Alternatives - Kynection (AU)](https://www.kynection.com.au/best-10-procore-alternatives-for-integrated-construction/)
- [Why Organizations Switch from Procore to Autodesk ACC - IMAGINiT](https://resources.imaginit.com/building-solutions-blog/why-organizations-are-switching-from-procore-to-autodesk-construction-cloud-acc)
- [Top 7 Procore Alternatives 2026 - ServiceTitan](https://www.servicetitan.com/blog/procore-alternatives)
- [Procore Competitors and Alternatives 2026 - Mastt](https://www.mastt.com/software/best-procore-alternatives)

### Australia Infrastructure

- [2025 Infrastructure Market Capacity Report - Infrastructure Australia](https://www.infrastructureaustralia.gov.au/reports/2025-infrastructure-market-capacity-report)
- [Australian Infrastructure Investment Monitor 2025 - IPA](https://infrastructure.org.au/policy-research/major-reports/australian-infrastructure-investment-monitor-2025/)
- [Australia Construction Industry Report 2025 - GlobeNewsWire](https://www.globenewswire.com/news-release/2026/02/03/3231330/28124/en/Australia-Construction-Industry-Report-2025-Output-to-Grow-at-AAGR-of-3-3-Between-2026-2029-Following-Growth-of-3-8-in-2025-Driven-by-PPI-in-Transport-Data-Centers-Renewable-Energy.html)

### Legal and Privacy

- [Privacy and Other Legislation Amendment Act 2024 - MinterEllison](https://www.minterellison.com/articles/privacy-and-other-legislation-amendment-act-2024-now-in-effect)
- [Australian Privacy Alert: Parliament Passes Major Reform - Norton Rose Fulbright](https://www.nortonrosefulbright.com/en/knowledge/publications/be98b0ff/australian-privacy-alert-parliament-passes-major-and-meaningful-privacy-law-reform)
- [Australia Privacy Act Reforms 2025 - SecurePrivacy](https://secureprivacy.ai/blog/what-australia-privacy-act-reforms-mean-for-your-business-2025)
- [Privacy Law Reforms 2024 Set Priorities for 2025 - Holding Redlich](https://www.holdingredlich.com/the-privacy-law-reforms-finally-passed-in-2024-set-the-priorities-for-2025)
- [Terms and Conditions for Australian Websites - Legal123](https://legal123.com.au/how-to-guide/how-to-write-terms-and-conditions/)
- [Terms of Service in Australia - Sprintlaw](https://sprintlaw.com.au/articles/terms-of-service-in-australia-what-to-include-and-get-right/)
- [Disclaimer Statements: Protecting Your Business - Sprintlaw](https://sprintlaw.com.au/articles/disclaimer-statements-protecting-your-business-legally/)
- [Limitation of Liability Clauses for SaaS - TermsFeed](https://www.termsfeed.com/blog/saas-limitation-liability/)
- [SaaS Agreements: Key Contractual Provisions - ABA](https://www.americanbar.org/groups/business_law/resources/business-law-today/2021-november/saas-agreements-key-contractual-provisions/)

### Insurance

- [Insurance for Startups - upcover (AU)](https://www.upcover.com/startups-vc)
- [SaaS Insurance Guide - Embroker](https://www.embroker.com/blog/saas-insurance/)
- [Startup Business Insurance - BizCover (AU)](https://www.bizcover.com.au/insurance-for-tech-startups/)
- [Professional Indemnity Insurance - Chubb Australia](https://www.chubb.com/au-en/business/professional-indemnity-insurance.html)
- [Insurance by Stages: Early Stage - Upsure (AU)](https://www.upsure.com.au/quick-start-guides/insurance-by-stages-part-1-early-stage)

### Support and Operations

- [100+ Customer Support Statistics 2025 - Fullview](https://www.fullview.io/blog/support-stats)
- [True Cost of Customer Support 2025 - LiveChatAI](https://livechatai.com/blog/customer-support-cost-benchmarks)
- [SaaS Customer Support Explained 2025 - Freshworks](https://www.freshworks.com/customer-service/support/saas/)
- [Ultimate Guide to SaaS Customer Support 2026 - Help Scout](https://www.helpscout.com/helpu/saas-customer-support/)
- [Acceptable Volume of Support Tickets for B2B SaaS - Quora](https://www.quora.com/What-is-an-acceptable-volume-of-support-tickets-for-a-SaaS-B2B-company)

### N+1 Queries and Database Performance

- [Solving the N+1 Query Problem - DEV Community](https://dev.to/vasughanta09/solving-the-n1-query-problem-a-developers-guide-to-database-performance-321c)
- [What is the N+1 Query Problem - PlanetScale](https://planetscale.com/blog/what-is-n-1-query-problem-and-how-to-solve-it)
- [N+1 Query Problem: Silent Performance Killer - DEV Community](https://dev.to/lovestaco/the-n1-query-problem-the-silent-performance-killer-2b1c)
- [Investigating and Optimizing Over-Querying - Readyset](https://readyset.io/blog/investigating-and-optimizing-over-querying)
- [PostgreSQL Common Pitfalls - CompileNRun](https://www.compilenrun.com/docs/database/postgresql/postgresql-best-practices/postgresql-common-pitfalls/)

---

*This document should be reviewed and updated quarterly. Risk scores should be reassessed after each mitigation action is completed. The legal checklist items should be reviewed by qualified Australian legal counsel before implementation.*
