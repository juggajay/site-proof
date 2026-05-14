# SiteProof Launch Readiness — Research Brief

**From:** Product Manager
**To:** Research Team
**Date:** 2026-02-10
**Priority:** Critical — blocks launch timeline

---

## Context

SiteProof is a construction quality management platform for Australian civil contractors. The product is feature-complete across 12 core modules (Lots, ITPs, Hold Points, NCRs, Daily Diaries, Dockets, Progress Claims, Test Results, Documents, Drawings, Subcontractor Portal, Reports). We have a working frontend (React), backend (Express/Prisma/PostgreSQL), landing page, and mobile-optimized foreman experience.

We need to fill critical knowledge gaps before we can confidently launch and acquire our first paying customers. This brief outlines exactly what we need researched, why it matters, and the format we need it delivered in.

---

## Research Area 1: Competitive Landscape

### Why it matters
We need to know exactly what we're up against so we can position correctly, price competitively, and highlight genuine differentiators in demos and marketing.

### What we need

**Direct competitors (AU civil construction quality management):**
- **Procore** — What does their quality module actually cover? What's missing for AU civil specifically? What do they charge? What do real users complain about on G2/Capterra?
- **Fieldwire** — Same questions. How does their mobile experience compare? What's their ITP/hold point story?
- **HammerTech** — AU-based. What's their positioning? Pricing? Feature set vs ours?
- **iAuditor / SafetyCulture** — Inspection-focused. Do AU civil contractors use it for ITPs? Limitations?
- **Assignar** — AU-based, field operations. Do they cover quality or just workforce/plant? Pricing?
- **Aconex / Oracle Aconex** — Enterprise. What's the gap for mid-market civil?
- **Hammertech, Dashpivot, FinalizeIT, Autodesk Build** — Same analysis

**For each competitor, deliver:**

| Field | Detail needed |
|-------|---------------|
| Target market | Who do they sell to? Enterprise only? SMB? Civil-specific or general construction? |
| Pricing model | Per user/month? Per project? Tiered? Published or custom? |
| Actual price points | Get real numbers from G2 reviews, case studies, or direct enquiry if possible |
| Core features | What do they do well? What do users praise? |
| Key gaps | What do users complain about? Missing AU-specific features? Poor mobile? No offline? |
| ITP/Hold Point support | Specifically — do they handle AU state authority ITPs (TfNSW Q6, TMR MRTS, VicRoads)? |
| Claim/evidence bundling | Can they auto-generate evidence packages for progress claims? |
| Mobile/offline | Real offline capability or just "offline viewing"? |
| AU market presence | How many AU customers? Any civil-specific case studies? |
| Switching cost | What makes it hard to leave them? Data lock-in? Integrations? Training investment? |

**Deliverable:** Competitive comparison matrix (spreadsheet) + 1-page summary of our top 3 differentiators vs each competitor.

---

## Research Area 2: Market Sizing (Australia)

### Why it matters
We need credible numbers for investor conversations, pricing decisions, and to understand how big this opportunity actually is.

### What we need

**TAM (Total Addressable Market):**
- How many civil construction companies operate in Australia?
- Break down by state (NSW, QLD, VIC, WA, SA, TAS, NT, ACT)
- Break down by size: <$5M revenue, $5M-$20M, $20M-$50M, $50M-$100M, $100M+
- How many active civil infrastructure projects are there at any time? (state road authorities, local councils, federal)
- What's the total annual spend on civil infrastructure in Australia? (government investment pipeline)

**SAM (Serviceable Addressable Market):**
- How many companies fit our sweet spot: 10-200 employees, $5M-$100M revenue, doing road/bridge/earthworks?
- What % currently use quality management software vs spreadsheets/paper?
- What's the typical IT/software budget for a civil contractor this size?

**SOM (Serviceable Obtainable Market):**
- Realistic first-year target: how many companies could we convert?
- What's a credible ARPU assumption? (look at competitor pricing for companies with 10-50 users)

**Growth drivers:**
- What's the Australian government infrastructure investment pipeline for 2026-2030? (federal + state budgets)
- Are there any upcoming regulatory changes that would force digital quality records?
- Is there movement toward mandatory digital ITP submission by state authorities?

**Deliverable:** Market sizing model (spreadsheet) with sources cited + 1-page executive summary.

---

## Research Area 3: Buyer Journey & Sales Intelligence

### Why it matters
We need to know who we're selling to, how they buy, and what triggers the purchase decision so we can build the right sales process.

### What we need

**Decision makers:**
- In a 10-50 person civil contractor, who decides on software purchases? Owner? Operations Manager? PM? IT?
- In a 50-200 person company, same question — is there a formal procurement process?
- Do subcontractors have any influence on head contractor software choice? (e.g., "we already use X, can you use it too?")

**Purchase triggers (validate our assumptions):**
- Talk to 5-10 civil contractors (cold outreach, LinkedIn, industry contacts) and ask:
  - What would make you look for quality management software TODAY?
  - What are you currently using for ITP tracking? Hold points? NCRs?
  - How do you currently prepare progress claims?
  - How long does claim prep take you?
  - Have you ever failed an audit or had a compliance issue?
  - What's the cost when things go wrong? (rework, delays, disputes)
  - What software have you tried? What did you like/hate?
  - What would you pay per month for something that solved these problems?

**Sales cycle:**
- How long does it typically take from first demo to signed contract for construction software?
- Do they need a trial period? How long?
- Do they need to see it work on THEIR project data before committing?
- Is there a "champion" inside the company who drives adoption? (usually PM or quality manager?)
- What objections come up? (security, data migration, change management, training)

**Channel research:**
- Where do civil contractors go for software recommendations? (industry associations, peer referrals, Google, LinkedIn, trade publications?)
- What industry events/conferences should we attend? (CCF, CCAA, Roads Australia, state-level events)
- Are there industry publications or newsletters that reach our target? (Roads & Infrastructure, Infrastructure Magazine, etc.)
- Would a partnership with a testing lab, surveying company, or engineering consultancy open doors?

**Deliverable:** Buyer persona validation report + recommended sales process + channel strategy (1-2 pages each).

---

## Research Area 4: Pricing Strategy

### Why it matters
We currently have "custom quotes" as our pricing model. We need to decide if that's right or if transparent pricing would convert better, and we need to know what price point the market will bear.

### What we need

**Competitor pricing intelligence:**
- Actual price points for Procore, Fieldwire, HammerTech, Assignar, iAuditor in AU market
- Pricing model: per user? Per project? Flat fee? Tiered by features?
- What do mid-market construction companies (our target) typically pay for similar tools?

**Willingness to pay:**
- What would a 20-person civil contractor pay monthly for this? (from customer interviews)
- What would a 100-person company pay?
- Is there a "no brainer" price point where the ROI is so obvious they'd sign immediately?
- Should we price per user, per project, or flat fee? What do contractors prefer?

**Value-based pricing analysis:**
- If we save a PM 3+ hours per claim (say 12 claims/year), what's that worth?
- If we reduce payment cycle by 26 days ($180K/month cash flow improvement), what's that worth?
- If we prevent one audit failure ($180K rectification), what's that worth?
- What % of that value can we capture in price?

**Pricing model options to evaluate:**

| Model | Pros | Cons | Research needed |
|-------|------|------|-----------------|
| Per user/month | Predictable, scales with adoption | Discourages adding users (especially subbies) | What do competitors charge per user? |
| Per project/month | Aligns with how they think about costs | Revenue drops if project count fluctuates | What's a typical project count for our target? |
| Flat monthly fee by tier | Simple, encourages full adoption | Hard to price correctly for different company sizes | What tier breakpoints make sense? |
| Custom quotes | Maximizes per-deal revenue | Friction, slower sales cycle, requires sales team | Is our market too price-sensitive for this? |

**Free tier / trial strategy:**
- Should we offer a free trial? How long?
- Should we have a free tier (limited projects/users) to drive adoption?
- Would a "freemium for subcontractors" model drive head contractor sign-ups?

**Deliverable:** Pricing recommendation with 2-3 options modeled out (spreadsheet) + rationale document.

---

## Research Area 5: Regulatory & Compliance Landscape

### Why it matters
Our biggest moat is AU state authority compliance. We need to know exactly what's required, what's changing, and where the regulatory wind is blowing.

### What we need

**Current requirements by state:**
- **NSW (TfNSW):** What are the current digital quality record requirements? Is Q6 being updated? Any push toward digital submission?
- **QLD (TMR):** Same questions for MRTS framework. Any digital mandate coming?
- **VIC (VicRoads / DTP):** Same. What's happening with Section 175 and quality systems?
- **WA (MRWA):** What are their quality system requirements? Are they moving digital?
- **SA, TAS, NT:** Smaller markets but — any requirements we should know about?

**Upcoming regulatory changes:**
- Is there any movement toward mandatory digital ITP/quality records at any state level?
- Are any authorities requiring contractors to use specific platforms? (This could be a threat OR opportunity)
- What's happening with the National Construction Code and quality requirements?
- Any changes to SOPA (Security of Payment Act) across states that affect claims?

**Data sovereignty requirements:**
- What are the specific data residency requirements for government contractors in AU?
- Do we need to certify anything? (ISO 27001, SOC 2, AU government certifications?)
- Are there specific requirements for how long quality records must be retained?
- What happens with records when a project is completed — who owns the data?

**Insurance implications:**
- Do professional indemnity insurers look at digital quality management as a positive?
- Could using SiteProof reduce insurance premiums? (This would be a powerful sales argument)

**Deliverable:** State-by-state compliance requirements summary + regulatory forecast (what's changing in the next 2 years) + data requirements checklist.

---

## Research Area 6: Integration Ecosystem

### Why it matters
Contractors don't use one tool. We need to know what other software is in their stack so we can plan integrations that make us stickier and reduce friction.

### What we need

**Common software stack for AU civil contractors:**
- Accounting: MYOB? Xero? Which is dominant for construction?
- Project management: Procore? Microsoft Project? Primavera? Powerproject?
- Estimating: CostX? Buildsoft? Cubit?
- Surveying: Trimble? Leica? 12d?
- Document management: Aconex? Asite? SharePoint?
- HR/Payroll: Employment Hero? KeyPay? Elmo?
- Fleet/plant management: Chevin? Teletrac Navman?
- Accounting/ERP for larger firms: COINS? Viewpoint? Jonas?

**Integration priorities:**
- Which of these integrations would move the needle on sales?
- Which would reduce data entry for users? (high value)
- Which are "checkbox" items that enterprises need to see before buying?
- What APIs/webhooks do these tools expose?

**Data import/export:**
- What formats do contractors currently use for lot lists? (Excel templates?)
- Can we import existing ITP templates from Word/Excel?
- What PDF report formats do state authorities actually require?

**Deliverable:** Integration priority matrix (effort vs impact) + recommended Phase 1 integrations (top 3-5).

---

## Research Area 7: Onboarding & Implementation

### Why it matters
Construction teams are not tech-savvy. If onboarding is painful, they'll churn. We need to know what "good" looks like.

### What we need

**Competitor onboarding:**
- How do Procore, Fieldwire, HammerTech onboard new customers?
- Do they charge for implementation? How much?
- How long does typical onboarding take? (days, weeks, months?)
- Do they provide on-site training? Remote? Self-serve?

**Customer expectations:**
- What level of hand-holding do AU civil contractors expect?
- Will foremen need in-person training, or can they learn from videos/guides?
- How important is data migration from existing systems?
- What does "success" look like at 30/60/90 days?

**Content we need to create:**
- Training videos — what topics, what length, what format?
- Help documentation — what level of detail?
- Template library — what pre-built ITP templates would accelerate adoption?
- Quick-start guide — what's the minimum a foreman needs to know?

**Deliverable:** Recommended onboarding playbook (step-by-step from sign-up to "fully operational") + content creation priority list.

---

## Research Area 8: Risk & Blockers

### Why it matters
We need to know what could kill us before we launch.

### What we need

**Technical risks:**
- Our current bundle size is 3.46MB (target is <200KB). This WILL cause slow load times on mobile in the field. What's the acceptable load time for construction field apps?
- We have known N+1 query issues in portfolio views. At what user count does this become a problem?
- Our offline support uses IndexedDB (Dexie). What are the known limitations? Storage limits? iOS Safari issues?
- What uptime SLA do construction companies expect? (99.9%? 99.99%?)

**Market risks:**
- Could Procore or Autodesk acquire a competitor and dominate the AU civil space?
- Could a state authority mandate a specific platform (like they've done in other industries)?
- Is there a risk of open-source alternatives emerging?
- What happens if the AU infrastructure investment pipeline slows down?

**Operational risks:**
- What support infrastructure do we need at launch? (phone support? email? chat? SLA?)
- What's the expected support ticket volume per 100 users?
- Do we need an AU-based support team, or can we do remote?
- What happens when a critical bug affects an active project? (incident response expectations)

**Legal risks:**
- Are our Terms of Service and Privacy Policy adequate for AU construction?
- Do we need specific disclaimers about data accuracy (e.g., "SiteProof does not guarantee compliance")?
- What liability exposure do we have if a contractor relies on our system and fails an audit?
- Do we need professional indemnity insurance?

**Deliverable:** Risk register (likelihood x impact matrix) + mitigation plan for top 5 risks.

---

## Research Area 9: Launch Channel Strategy

### Why it matters
We need to know exactly where to show up, what to say, and how to generate our first 10-50 paying customers.

### What we need

**Digital channels:**
- What keywords do AU civil contractors search when looking for quality management software? (Google Keyword Planner data)
- What's the search volume and competition for: "ITP software", "construction quality management", "hold point software", "NCR tracking software"?
- What LinkedIn targeting options reach our audience? (job titles, companies, industries, groups)
- Are there construction-specific online communities or forums in AU?
- Would Google Ads or LinkedIn Ads be more effective for our audience?

**Industry channels:**
- What are the top 5 industry events/conferences where our target audience attends?
- What are the key industry associations? (CCF, CCAA, Roads Australia, Engineers Australia)
- Can we sponsor or speak at these events?
- What industry publications should we write for or advertise in?

**Referral and partnership channels:**
- Would testing laboratories refer us to their clients?
- Would engineering consultancies recommend us?
- Would state authority innovation teams promote us?
- Could we partner with Supabase, Resend, or other tech partners for co-marketing?

**Content marketing:**
- What topics would AU civil contractors actually read? (compliance guides, ITP templates, audit preparation checklists?)
- Should we create free ITP templates as a lead magnet?
- Would a "State Authority Compliance Guide" (free PDF) drive downloads?
- What video content would work? (demo videos, customer interviews, compliance explainers)

**Deliverable:** 90-day launch marketing plan with specific channels, budgets, and expected outcomes.

---

## Research Area 10: Success Metrics & KPIs

### Why it matters
We need to define what "launch success" looks like so we can measure it.

### What we need

**Benchmark data:**
- What's a typical conversion rate from demo to paid for construction SaaS? (industry benchmarks)
- What's a healthy monthly churn rate for B2B construction software?
- What's a typical NPS score for construction software? (from G2/Capterra data)
- What does "good" DAU/MAU ratio look like for a field tool vs office tool?

**Our launch targets (help us validate these):**
- Are these realistic for a first-year launch in AU civil construction?
  - Month 1-3: 5-10 paying companies
  - Month 4-6: 15-30 paying companies
  - Month 7-12: 50+ paying companies
  - Year 1 ARR target: $300K-$500K
- What's a realistic CAC (Customer Acquisition Cost) for this market?
- What LTV:CAC ratio should we target?

**Deliverable:** KPI dashboard template with benchmarks + validated 12-month targets.

---

## Delivery Format

For each research area, we need:

1. **Raw data** — Sources, links, data points (spreadsheet or structured doc)
2. **Executive summary** — 1-page max with key findings and recommendations
3. **Action items** — What decisions this research enables and what we should do next

**Total deliverables: 10 research reports + supporting data**

---

## Timeline

| Priority | Research Area | Needed by |
|----------|--------------|-----------|
| P0 (blocks launch) | Competitive landscape | Week 1 |
| P0 (blocks launch) | Pricing strategy | Week 1 |
| P0 (blocks launch) | Buyer journey & sales | Week 2 |
| P1 (shapes launch) | Market sizing | Week 2 |
| P1 (shapes launch) | Launch channel strategy | Week 2 |
| P1 (shapes launch) | Onboarding playbook | Week 3 |
| P2 (strengthens launch) | Regulatory landscape | Week 3 |
| P2 (strengthens launch) | Integration ecosystem | Week 3 |
| P2 (strengthens launch) | Risk & blockers | Week 4 |
| P2 (strengthens launch) | Success metrics & KPIs | Week 4 |

---

## Notes for the Research Team

- **Be specific to AU civil construction.** General "construction software" research is not useful. We need roads, bridges, earthworks — state authority contract work.
- **Get real numbers.** "Competitive" pricing is not useful. "$45/user/month for Fieldwire" is useful.
- **Talk to real people.** Desk research gets us 60% of the way. The other 40% comes from actual conversations with contractors, PMs, and foremen.
- **Cite everything.** We'll use this research in investor decks, sales materials, and strategic decisions. Every claim needs a source.
- **Flag surprises.** If you discover something that changes our assumptions (e.g., a competitor we didn't know about, a regulation that kills our approach), flag it immediately — don't wait for the full report.

---

*This brief was generated by the Product Manager based on a complete codebase review of SiteProof v3 (12 modules, 26 API routes, 84 frontend pages, 252 backend tests). The product is feature-complete and needs market intelligence to launch successfully.*
