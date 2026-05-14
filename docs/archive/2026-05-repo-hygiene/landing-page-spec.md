# SiteProof Landing Page Specification

> **Purpose:** This file provides everything needed to build a high-converting landing page for SiteProof - a construction quality management platform for Australian civil contractors.

---

## Table of Contents

1. [Product Overview](#product-overview)
2. [Target Audience](#target-audience)
3. [User Stories](#user-stories)
4. [Page Structure](#page-structure)
5. [Section Content](#section-content)
6. [Design Guidelines](#design-guidelines)
7. [Technical Requirements](#technical-requirements)

---

## Product Overview

**SiteProof** is a construction quality management platform purpose-built for Australian civil contractors. It centralizes compliance, quality control, and documentation that's currently scattered across spreadsheets, emails, and clipboards.

### Core Problem

Civil contractors managing road, bridge, and infrastructure projects face:
- **Fragmented quality records** - ITPs on clipboards, photos in camera rolls, test results in emails
- **Compliance risk** - State authority audits (TfNSW, TMR, VicRoads) require immutable evidence trails
- **Approval bottlenecks** - Hold points wait days for superintendent site visits
- **Claim delays** - Month-end scramble to assemble evidence packages
- **Subcontractor disputes** - No single source of truth for work completed

### Core Solution

One platform connecting field to office:
- **Lots** - Track work sections from start → testing → conformance → claim
- **ITPs** - Digital checklists with photo evidence and signatures
- **Hold Points** - Remote superintendent release via email tokens
- **NCRs** - Full defect lifecycle with corrective action tracking
- **Test Results** - Lab test tracking with pass/fail against specs
- **Daily Diaries** - Weather, crew, plant, activities in one place
- **Dockets** - Subcontractor timesheets with approval workflow
- **Progress Claims** - Evidence auto-bundled for faster certification

---

## Target Audience

### Primary Personas

| Persona | Role | Primary Need | Device |
|---------|------|--------------|--------|
| **Sarah** | Owner/Director | Visibility across all projects | Desktop |
| **Marcus** | Project Manager | Claim prep & compliance | Desktop + Tablet |
| **Danny** | Foreman | Fast evidence capture | Mobile (phone) |
| **Tony** | Subcontractor | Proof of work, faster payment | Mobile + Desktop |

### Company Profile

- **Size:** 10-200+ employees
- **Revenue:** $5M - $100M+
- **Geography:** Australia (NSW, QLD, VIC, WA, SA)
- **Project Types:** Roads, bridges, earthworks, drainage, concrete, asphalt
- **Clients:** State road authorities, local councils, transport agencies

### Buying Triggers

- Failed audit or compliance notice
- Lost dispute due to missing documentation
- Key PM/foreman complaining about paperwork
- Scaling projects but not admin staff
- Client requiring digital quality records

---

## User Stories

### Owner Story - Sarah Chen

**Company:** Pacific Civil Contractors (45 employees, $28M revenue)

**Before SiteProof:**
> "I find out about NCRs when the client calls me angry. Month-end is chaos - PMs scrambling to assemble claim evidence. We failed a TfNSW audit last year - $180K in rectification because we couldn't prove compaction tests were done."

**After SiteProof:**
> "Last Tuesday I got a push notification - major NCR raised on the M7 upgrade. I called the PM before the client even knew. We had a remediation plan in 2 hours. Before SiteProof, I'd have found out a week later when TfNSW sent a formal notice."

**Key Metric:** Audit findings reduced from 3 to 0

---

### Project Manager Story - Marcus Webb

**Project:** Princes Highway Upgrade, $4.2M, 8km rehabilitation

**Before SiteProof:**
> "I spend Sunday nights compiling claim evidence from 47 different email threads. Foremen text me photos with no context - which lot? Which ITP item? Hold points get stuck because the superintendent is on another site."

**After SiteProof:**
> "Claim 7 was due Friday. Wednesday afternoon I pulled up SiteProof - 42 lots ready to claim, all ITPs complete, test results linked, photos geotagged. I exported the evidence package, submitted by 3pm. Client certified it Monday without a single query."

**Key Metric:** Claim prep time reduced from 4 hours to 45 minutes

---

### Foreman Story - Danny Nguyen

**Role:** Leading hand, earthworks and pavement crew (6 people)

**Before SiteProof:**
> "I take 50 photos a day. By Friday I can't remember which lot they belong to. Paper ITP checklists get wet, lost, or illegible. I have to call the office to check if a hold point is released."

**After SiteProof:**
> "Monday morning the app showed hold point HP-042 released overnight - superintendent signed off remotely at 6am. I had the crew on that section by 7:30. Old way? I'd be calling the office at 7, they'd call the super, super would drive out by 10, we'd lose half a day."

**Key Metric:** End-of-day paperwork reduced from 45 minutes to 0

---

### Subcontractor Story - Tran Bros Earthmoving

**Company:** Family business, 8 operators, 12 machines

**Before SiteProof:**
> "We submit timesheets, they get 'lost', we don't get paid for 60 days. They raise NCRs against us but we never see them until it's a dispute. We spend hours in meetings arguing about what happened 3 weeks ago."

**After SiteProof:**
> "Last month they raised an NCR - said our fill material was out of spec. I logged in, saw the NCR with photos attached. I responded with our delivery dockets within the hour. NCR closed same day. Before? That would've been a 2-week email war and probably a $15K backcharge."

**Key Metric:** Payment cycle reduced from 67 days to 41 days

---

## Page Structure

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER                                                     │
│  Logo | Features | Pricing | Resources | Login | Get Demo   │
├─────────────────────────────────────────────────────────────┤
│  HERO SECTION                                               │
│  Headline + Subhead + CTA + Hero Image/Video               │
├─────────────────────────────────────────────────────────────┤
│  SOCIAL PROOF BAR                                           │
│  Client logos + Key stat                                    │
├─────────────────────────────────────────────────────────────┤
│  PROBLEM SECTION                                            │
│  Pain points civil contractors face                         │
├─────────────────────────────────────────────────────────────┤
│  SOLUTION OVERVIEW                                          │
│  Platform introduction + Feature grid                       │
├─────────────────────────────────────────────────────────────┤
│  FEATURES DEEP DIVE                                         │
│  Tabbed/scrolling feature sections with screenshots         │
├─────────────────────────────────────────────────────────────┤
│  ROLE-BASED BENEFITS                                        │
│  Cards for Owner, PM, Foreman, Subcontractor               │
├─────────────────────────────────────────────────────────────┤
│  TESTIMONIALS / CASE STUDIES                                │
│  User stories with photos and metrics                       │
├─────────────────────────────────────────────────────────────┤
│  COMPLIANCE & STANDARDS                                     │
│  TfNSW, TMR, VicRoads compatibility                        │
├─────────────────────────────────────────────────────────────┤
│  MOBILE SHOWCASE                                            │
│  Phone mockups showing foreman experience                   │
├─────────────────────────────────────────────────────────────┤
│  PRICING SECTION                                            │
│  Plans or "Request Quote" CTA                              │
├─────────────────────────────────────────────────────────────┤
│  FAQ SECTION                                                │
│  Common questions                                           │
├─────────────────────────────────────────────────────────────┤
│  FINAL CTA                                                  │
│  Strong closing CTA + contact options                       │
├─────────────────────────────────────────────────────────────┤
│  FOOTER                                                     │
│  Links, contact, legal                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Section Content

### 1. Header

**Navigation Items:**
- Features (dropdown: Lots, ITPs, Hold Points, NCRs, Diaries, Claims)
- Pricing
- Resources (dropdown: Blog, Help Center, API Docs)
- Login
- **Get a Demo** (primary CTA button)

---

### 2. Hero Section

**Headline Options:**

Option A (Problem-focused):
> **Stop chasing paperwork. Start proving compliance.**

Option B (Outcome-focused):
> **Quality management built for the field, not the office.**

Option C (Direct):
> **The compliance platform Australian civil contractors trust.**

**Subheadline:**
> SiteProof connects your field crews, QA team, and project managers in one platform. Capture evidence on site, release hold points remotely, and submit claims with proof attached.

**Primary CTA:** `Book a Demo`
**Secondary CTA:** `Watch 2-min Overview`

**Hero Visual:**
- Option A: Split screen - left shows foreman on phone at job site, right shows PM dashboard on desktop
- Option B: Animated product demo showing lot → ITP → hold point → claim flow
- Option C: Video thumbnail with play button (customer testimonial or product tour)

---

### 3. Social Proof Bar

**Format:** Horizontal scrolling logo bar + key stat

**Stat Options:**
- "Trusted by 50+ civil contractors across Australia"
- "2,400+ lots conformed last month"
- "$47M in claims processed"

**Client Logos:** (placeholder - replace with actual clients)
- Pacific Civil
- Georgiou
- BMD Constructions
- Fulton Hogan
- Downer

---

### 4. Problem Section

**Section Title:**
> Sound familiar?

**Pain Point Cards:**

| Icon | Pain Point | Detail |
|------|------------|--------|
| 📋 | Paperwork piles up | ITPs on clipboards, photos in camera rolls, test results in emails. Nobody can find anything. |
| ⏰ | Hold points block work | Waiting days for superintendent site visits. Crews standing around. |
| 📧 | Claims take forever | Sunday nights compiling evidence from 47 email threads. Still get RFIs. |
| ⚠️ | Audits are stressful | Can't prove compaction tests were done. $180K rectification costs. |
| 💸 | Subbie disputes | Arguing about what happened 3 weeks ago. No single source of truth. |
| 📱 | Foremen hate "the system" | Complex software designed for desks, not dirt. 45 mins paperwork after knock-off. |

---

### 5. Solution Overview

**Section Title:**
> One platform. Field to office.

**Section Copy:**
> SiteProof brings your quality records, approvals, and evidence into one place. Foremen capture proof on site. QA verifies without site visits. PMs submit claims with evidence attached. Everyone sees the same truth.

**Feature Grid (6 items):**

| Feature | One-liner | Icon |
|---------|-----------|------|
| **Lot Tracking** | Track every work section from start to conformance | 📍 |
| **Digital ITPs** | Checklists with photos, signatures, and GPS | ✅ |
| **Hold Point Release** | Superintendents approve remotely via email | 🔓 |
| **NCR Management** | Capture defects, track corrective actions | ⚠️ |
| **Daily Diaries** | Weather, crew, plant, activities in 10 minutes | 📝 |
| **Claims & Evidence** | Auto-bundled proof for faster certification | 💰 |

---

### 6. Features Deep Dive

**Format:** Tabbed interface or vertical scroll with alternating image/text

#### 6.1 Lot Management

**Headline:** Track every lot from first cut to final claim

**Copy:**
> Create lots for each work section. See status at a glance - not started, in progress, completed, conformed. Link ITPs, tests, photos, and NCRs. When it's time to claim, everything's already there.

**Screenshot:** Lots list view with status badges and progress indicators

**Key Points:**
- Bulk create from CSV or wizard
- Filter by activity type, subcontractor, status
- Print QR code labels for site marking
- Export to Excel for reporting

---

#### 6.2 Digital ITPs

**Headline:** Checklists built for gloves, not keyboards

**Copy:**
> Your ITP templates, digitized. Foremen tap through checklist items, snap photos, capture signatures. GPS and timestamp recorded automatically. QA verifies from the office.

**Screenshot:** Mobile ITP checklist with photo attachment

**Key Points:**
- Templates for earthworks, pavement, concrete, asphalt, drainage
- Witness points and hold points embedded
- Works offline - syncs when signal returns
- Verification workflow (completed → verified → signed)

---

#### 6.3 Hold Point Release

**Headline:** Release hold points without the site visit

**Copy:**
> Superintendents receive an email with photos, test results, and ITP evidence. One click to release. Work continues without waiting for a site visit. Chase notifications ensure nothing goes stale.

**Screenshot:** Hold point release email + dashboard showing released/pending

**Key Points:**
- External release via secure email token
- Scheduled release dates with reminders
- Automatic chase notifications
- Full audit trail of who released when

---

#### 6.4 NCR Management

**Headline:** Capture defects. Close them fast.

**Copy:**
> Raise an NCR in 60 seconds with photos and location. Track root cause, corrective action, and rectification. QA reviews and approves. Lessons learned captured for next time.

**Screenshot:** NCR detail view with status timeline

**Key Points:**
- Minor and major severity classification
- Corrective action workflow
- Client notification toggle
- Lessons learned database

---

#### 6.5 Daily Diaries

**Headline:** End-of-day done in 10 minutes

**Copy:**
> Weather auto-filled from location. Tap to add crew, plant, activities by lot. Log delays with impact. Submit and lock. No more Sunday night data entry.

**Screenshot:** Mobile diary entry with weather and activities

**Key Points:**
- Weather API integration
- Personnel and plant tracking
- Activity quantities by lot
- Delay logging with impact assessment
- Addendums for late updates

---

#### 6.6 Progress Claims

**Headline:** Claims with evidence attached

**Copy:**
> Select conformed lots. Evidence package generates automatically - ITPs, photos, test results, signatures. Submit to client. Certification in days, not weeks.

**Screenshot:** Claim preparation view with lot selection

**Key Points:**
- Lot-level claiming with quantities
- Auto-bundled evidence packages
- Certification workflow tracking
- Payment reference recording

---

### 7. Role-Based Benefits

**Section Title:**
> Built for how you actually work

**Cards:**

#### For Owners & Directors

**Headline:** See everything. Chase nothing.

**Benefits:**
- Real-time dashboard across all projects
- NCR alerts before clients call you
- Audit-ready records, always
- Scale projects without scaling admin

**Quote:**
> "We went from 3 audit findings last year to zero this year. That's not luck - it's having the evidence ready." — Sarah, Managing Director

---

#### For Project Managers

**Headline:** Claims done Wednesday, not Sunday.

**Benefits:**
- Evidence auto-bundled - no more email hunting
- Hold point visibility - know what's blocking work
- Subcontractor dockets approved daily
- NCRs tracked to closure

**Quote:**
> "Claim certification time dropped from 3 weeks to 5 days. That's $180K in cash flow improvement per month." — Marcus, Project Manager

---

#### For Foremen

**Headline:** Capture proof. Get home on time.

**Benefits:**
- Tap-photo-done checklist completion
- GPS and timestamp automatic
- Works offline in the paddock
- Dockets approved while memory's fresh

**Quote:**
> "I used to stay back 45 minutes doing paperwork. Now I'm done by knock-off. My wife noticed." — Danny, Foreman

---

#### For Subcontractors

**Headline:** Prove your work. Get paid faster.

**Benefits:**
- Digital docket submission
- See NCRs raised against your work
- Complete assigned ITP items
- No more "lost" timesheets

**Quote:**
> "Payment cycle went from 67 days average to 41 days. That's real money for a small business like ours." — Tony, Subcontractor Director

---

### 8. Compliance & Standards

**Section Title:**
> Built for Australian civil standards

**Copy:**
> SiteProof understands TfNSW Q6, TMR MRTS, VicRoads specifications. ITPs mapped to your state requirements. Evidence packages formatted for authority audits.

**Standards Grid:**

| Logo | Standard | Coverage |
|------|----------|----------|
| TfNSW | Transport for NSW | Q6 Quality Systems, R-series specs |
| TMR | Queensland Main Roads | MRTS technical specs |
| VicRoads | Victoria | Section specs (204, 304, 407, 610) |
| Austroads | National | Guide to Pavement Technology |
| AS | Australian Standards | AS 1289, AS 1012, AS 1141 |

---

### 9. Mobile Showcase

**Section Title:**
> Designed for dirt, not desks

**Copy:**
> Your foremen work in dust, rain, and poor signal. SiteProof's mobile app is built for that reality. Big buttons for gloved hands. Offline mode for the paddock. Camera launches in one tap.

**Visual:** iPhone/Android mockups showing:
1. ITP checklist with photo capture
2. Daily diary quick entry
3. Hold point status check
4. Docket approval

**Key Points:**
- Works offline, syncs automatically
- GPS captured without asking
- Photo-first interface
- Push notifications for approvals

---

### 10. Pricing Section

**Option A - Transparent Pricing:**

| Plan | Price | Includes |
|------|-------|----------|
| **Starter** | $X/user/month | Up to 3 projects, core features |
| **Professional** | $X/user/month | Unlimited projects, claims, API access |
| **Enterprise** | Custom | SSO, dedicated support, custom integrations |

**Option B - Request Quote:**

> **Pricing tailored to your business**
>
> Project count, user roles, and integration needs vary. Let's build a package that fits.
>
> `Request a Quote`

---

### 11. FAQ Section

**Q: How long does setup take?**
> Most teams are running within a week. We import your lot lists, set up ITP templates for your activity types, and train your team. Foremen usually get it within an hour.

**Q: Does it work offline?**
> Yes. The mobile app stores data locally and syncs when you're back in signal. Your foremen can complete ITPs, take photos, and submit diaries from anywhere.

**Q: Can superintendents outside our company release hold points?**
> Yes. They receive a secure email with the evidence package and can release with one click. No login required. Full audit trail recorded.

**Q: What about our existing data?**
> We can import lot lists from Excel/CSV. Historical records can be linked as documents. Most teams start fresh with SiteProof going forward.

**Q: Is it secure?**
> Yes. Data encrypted in transit and at rest. Hosted on Australian servers (Supabase/AWS Sydney). MFA available. Role-based permissions ensure people only see what they should.

**Q: How does it handle different state specs?**
> ITP templates can be configured for TfNSW, TMR, VicRoads, or any other spec set. You can run projects across multiple states with the right templates for each.

---

### 12. Final CTA

**Headline:**
> Ready to stop chasing paperwork?

**Copy:**
> Join 50+ civil contractors who've brought their quality management into one place. Book a demo and see SiteProof on your actual project data.

**Primary CTA:** `Book a Demo`
**Secondary CTA:** `Contact Sales`

**Trust Signals:**
- "No credit card required"
- "30-minute demo, no pressure"
- "See it with your own project data"

---

### 13. Footer

**Columns:**

| Product | Resources | Company | Legal |
|---------|-----------|---------|-------|
| Features | Help Center | About | Privacy Policy |
| Pricing | API Docs | Careers | Terms of Service |
| Mobile App | Blog | Contact | Security |
| Integrations | System Status | | |

**Contact:**
- Email: hello@siteproof.com.au
- Phone: 1300 XXX XXX
- Address: Sydney, Australia

**Social:** LinkedIn, YouTube (product demos)

---

## Design Guidelines

### Brand Voice

| Attribute | Description |
|-----------|-------------|
| **Direct** | No fluff. Say what it does. |
| **Practical** | Focus on outcomes, not features |
| **Australian** | Understands the industry, the specs, the slang |
| **Confident** | We know civil construction. We built this for you. |

**Avoid:**
- Corporate jargon ("leverage", "synergy", "paradigm")
- Over-promising ("revolutionary", "game-changing")
- Generic SaaS speak ("powerful", "robust", "seamless")

### Visual Style

**Colors:**
- Primary: Deep blue (trust, reliability) - suggest `#1e3a5f`
- Accent: Safety orange (construction, visibility) - suggest `#f97316`
- Background: Light gray/white for readability
- Success: Green for completed/conformed status
- Warning: Amber for pending/attention needed
- Error: Red for NCRs/failures

**Typography:**
- Headlines: Bold, clean sans-serif (Inter, Geist, or similar)
- Body: Readable at small sizes (16px base)
- Monospace: For lot numbers, chainage, spec references

**Imagery:**
- Real construction sites (Australian landscapes preferred)
- Diverse crews (reflect actual workforce)
- Devices in context (phone on site, tablet in site office, laptop in main office)
- Avoid: Stock photos of people pointing at screens, overly polished "tech" imagery

**Icons:**
- Lucide or similar clean icon set
- Consistent stroke weight
- Meaningful, not decorative

### Responsive Approach

- **Desktop (1200px+):** Full layout, side-by-side comparisons, feature grids
- **Tablet (768-1199px):** Stacked sections, maintained imagery
- **Mobile (< 768px):** Single column, thumb-friendly CTAs, collapsed navigation

### Animation

- Subtle scroll reveals (fade up)
- Tab transitions (crossfade)
- Avoid: Parallax, bouncing elements, auto-playing videos

---

## Technical Requirements

### Performance

- **Target:** Lighthouse score 90+ on mobile
- **LCP:** < 2.5s (optimize hero image)
- **CLS:** < 0.1 (reserve space for images)
- **FID:** < 100ms

### SEO

**Target Keywords:**
- "construction quality management software"
- "ITP software Australia"
- "civil construction compliance"
- "hold point management"
- "construction NCR tracking"
- "daily diary software construction"

**Meta:**
```html
<title>SiteProof | Construction Quality Management for Civil Contractors</title>
<meta name="description" content="Quality management platform built for Australian civil contractors. Digital ITPs, hold point release, NCR tracking, and progress claims in one place.">
```

### Analytics

- Google Analytics 4 or Plausible
- Track: Page scroll depth, CTA clicks, demo form submissions, video plays
- Conversion goals: Demo booked, contact form submitted

### Forms

**Demo Request Form:**
- Name (required)
- Email (required)
- Phone (required)
- Company (required)
- Role (dropdown: Owner, PM, Site Manager, Foreman, Other)
- Number of projects (dropdown: 1-2, 3-5, 6-10, 10+)
- Message (optional)

### Integrations

- Calendly or HubSpot for demo booking
- CRM integration for lead capture
- Live chat (Intercom or similar) - optional

### Hosting

- Vercel or Netlify for static hosting
- CDN for images (Cloudflare or similar)
- Australian edge nodes for fast local delivery

---

## Implementation Notes

### Build Approach

This landing page can be built as:

1. **Standalone static site** - Astro, Next.js static export, or plain HTML/TailwindCSS
2. **Within existing frontend** - Add `/landing` route to current React app
3. **CMS-backed** - Contentful, Sanity, or similar for marketing team updates

**Recommendation:** Standalone static site for performance, separate deployment from main app.

### Component Checklist

- [ ] Header with sticky navigation
- [ ] Hero section with responsive image/video
- [ ] Logo carousel (horizontal scroll)
- [ ] Pain point cards (grid)
- [ ] Feature grid (6 items)
- [ ] Feature deep dive (tabs or scroll sections)
- [ ] Role benefit cards (4 cards)
- [ ] Testimonial cards with photos
- [ ] Standards/compliance grid
- [ ] Mobile device mockups
- [ ] Pricing table or CTA block
- [ ] FAQ accordion
- [ ] Final CTA section
- [ ] Footer with columns

### Assets Needed

- [ ] SiteProof logo (SVG, multiple sizes)
- [ ] Product screenshots (desktop + mobile)
- [ ] Client logos (with permission)
- [ ] Team/customer photos (optional)
- [ ] Construction site photography
- [ ] Device mockups (iPhone, Android, tablet, laptop)
- [ ] Icon set
- [ ] Social share images (OG images)

---

## Gemini 3 Pro Prompting Guide

> **Purpose:** This section provides best practices for using Gemini 3 Pro to build this landing page effectively.

### Key Differences from Previous Models

Gemini 3 is a **reasoning model** - it thinks differently than Gemini 2.x:

| Old Approach | Gemini 3 Approach |
|--------------|-------------------|
| Verbose, detailed prompts | Concise, direct instructions |
| Chain-of-thought prompting | Use `thinking_level: "high"` instead |
| Temperature tuning | Keep at default `1.0` (required) |
| Complex prompt engineering | Simplified prompts work better |

**Critical:** Do NOT set temperature below 1.0 - it causes looping and degraded performance.

---

### Recommended Prompt Structure

Use this pattern: **Role + Goal + Constraints + Context + Task**

```
<role>
Act as a world-class frontend engineer and UX designer specializing in high-converting landing pages.
</role>

<constraints>
- Use React + TypeScript + TailwindCSS
- Mobile-first responsive design
- No placeholder content or fake data
- Lighthouse score 90+ target
- Follow the design system in the spec
</constraints>

<context>
[Paste the relevant section of the landing-page-spec.md]
</context>

<task>
Build the Hero section with:
1. Pre-headline calling out civil contractors
2. H1: "Stop Chasing Paperwork. Start Proving Compliance."
3. Sub-headline with timeframe
4. Single primary CTA with friction reducer
5. Product screenshot placeholder area
</task>
```

---

### Gemini 3 Pro Best Practices

#### 1. Context Placement
Place all context FIRST, then your question/task at the END:
```
[All your reference material, specs, examples]

Based on the information above, build the Problem section...
```

#### 2. Constraint Placement
Put behavioral constraints at the TOP or in system instructions:
```
<constraints>
- Code must use TypeScript strict mode
- No external dependencies beyond those specified
- Output only the code, no explanations
</constraints>
```

Put negative constraints at the END of your task:
```
Build the feature grid component.
Do not include placeholder images.
Do not add comments to the code.
```

#### 3. Control Verbosity
Gemini 3 is naturally less verbose than 2.x. If you want explanations:
```
Explain your approach, then provide the code.
```

If you want code only:
```
Output only the code. No explanations or comments.
```

#### 4. Use Thinking for Complex Tasks
For multi-component work, leverage the thinking capability:
```
First, analyze the spec and create a component architecture plan.
Then, implement each component following the plan.
```

Or use the API parameter: `thinking_level: "high"`

#### 5. Structured Output
Request specific formats:
```
Output as a single React component file.
Use this structure:
- Imports at top
- Types/interfaces
- Component definition
- Export
```

---

### Frontend-Specific Prompts

#### Landing Page Hero Section
```
<role>
Act as a frontend engineer with a strong sense of aesthetics,
specializing in high-converting SaaS landing pages.
</role>

<tech-stack>
React 18, TypeScript, TailwindCSS, Lucide icons, Framer Motion
</tech-stack>

<design-requirements>
- Deep blue primary (#1e3a5f), safety orange accent (#f97316)
- Clean sans-serif typography (Inter or Geist)
- Generous whitespace (8px spacing scale)
- Mobile-first responsive
- Subtle scroll animations only
</design-requirements>

<task>
Build the Hero section for SiteProof landing page.

Required elements:
1. Pre-headline: "For Civil Construction Teams"
2. H1: "Stop Chasing Paperwork. Start Proving Compliance."
3. Sub-headline: "Setup in one week. Capture audit-ready evidence from day one."
4. Primary CTA button: "Book a Demo"
5. Friction reducer text: "No credit card required • 30-minute demo"
6. Hero image area (use a placeholder div with aspect ratio)

Follow the spacing scale: 8, 16, 24, 32, 48, 64, 96, 128px
Hero headline: 48-72px, Sub-headline: 20-24px
</task>

Output only the React component code.
```

#### Feature Grid Component
```
<role>
Senior frontend developer building a landing page feature section.
</role>

<context>
Features to display:
1. Lot Tracking - "Track every work section from start to conformance"
2. Digital ITPs - "Checklists with photos, signatures, and GPS"
3. Hold Point Release - "Superintendents approve remotely via email"
4. NCR Management - "Capture defects, track corrective actions"
5. Daily Diaries - "Weather, crew, plant, activities in 10 minutes"
6. Claims & Evidence - "Auto-bundled proof for faster certification"
</context>

<task>
Create a 6-item feature grid component.
- 3 columns on desktop, 2 on tablet, 1 on mobile
- Each card: icon, title, one-line description
- Use Lucide icons
- Subtle hover effect (shadow or scale)
- Consistent 24px internal padding
- 32px gap between cards
</task>

Use TypeScript and TailwindCSS. Output code only.
```

#### FAQ Accordion
```
<role>
Frontend developer building an accessible FAQ section.
</role>

<questions>
1. "How long does setup take?" → "Most teams are running within a week..."
2. "Does it work offline?" → "Yes. The mobile app stores data locally..."
3. "Can superintendents outside our company release hold points?" → "Yes. They receive a secure email..."
4. "Is it secure?" → "Yes. Data encrypted in transit and at rest..."
</questions>

<task>
Build an FAQ accordion component.
- Accessible (keyboard navigation, ARIA attributes)
- Smooth expand/collapse animation
- Only one item open at a time
- Plus/minus icon indicator
- Mobile-friendly tap targets (min 44px)
</task>

React + TypeScript + TailwindCSS + Framer Motion.
No external accordion libraries.
```

---

### Iterative Refinement Pattern

Gemini 3 tracks conversation context well. Use this pattern:

**Prompt 1:** Build the component
```
Build the Hero section following [spec]...
```

**Prompt 2:** Refine specific issues
```
Update the Hero component:
- Increase headline size to 64px on desktop
- Add subtle fade-in animation on load
- Fix mobile padding to 24px instead of 16px
```

**Prompt 3:** Verify against spec
```
Review this component against the design system:
- Spacing uses 8px scale?
- Colors match palette?
- Typography matches scale?

List any violations and fix them.
```

---

### Common Pitfalls to Avoid

| Pitfall | Fix |
|---------|-----|
| Setting temperature below 1.0 | Keep at default 1.0 |
| Overly verbose prompts | Be direct and concise |
| Burying the task in context | Put task at the END |
| Not specifying output format | Request "code only" or specific structure |
| Using chain-of-thought prompts | Use `thinking_level` parameter instead |
| Asking for whole app at once | Break into component-by-component requests |

---

### Recommended Workflow

1. **Start with architecture** - Ask Gemini to plan the component structure first
2. **Build section by section** - Hero → Problem → Solution → Features → etc.
3. **Review against spec** - After each section, verify against design system
4. **Refine iteratively** - Use follow-up prompts for specific fixes
5. **Final pass** - Ask for accessibility and performance review

---

### Sources

- [Gemini 3 Prompting: Best Practices](https://www.philschmid.de/gemini-3-prompt-practices)
- [Google Cloud Gemini 3 Prompting Guide](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/gemini-3-prompting-guide)
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Turbocharge UI with Gemini 3](https://designedforhumans.tech/blog/can-gemini-3-speed-up-ui-design-without-losing-quality)
- [Gemini 3 Prompts for Developers](https://skywork.ai/blog/ai-agent/gemini-3-prompts-developers/)

---

## AI Developer Build Guidelines

> **Important:** Follow these guidelines precisely when building the landing page. These rules optimize for conversion and professional design quality.

### Phase 1: Pre-Build Checklist

Before writing any code, confirm these details:

| Item | SiteProof Answer |
|------|------------------|
| **Product name** | SiteProof |
| **One-sentence description** | Construction quality management platform for Australian civil contractors |
| **Target audience** | Civil contractors (owners, PMs, foremen, subcontractors) managing road/bridge/infrastructure projects |
| **Primary pain point** | Fragmented quality records, compliance risk, approval bottlenecks, claim delays |
| **Dream outcome** | Audit-ready compliance, claims done in hours not days, foremen home on time |
| **Traffic source** | TBD - likely LinkedIn ads, Google search, industry referrals |
| **Launch stage** | Fresh launch (adapt trust builders accordingly) |

---

### Phase 2: Content Strategy

#### The Value Equation

Every piece of copy must optimize for:

```
Value = (Dream Outcome × Likelihood of Achievement) ÷ (Time Delay × Effort & Sacrifice)
```

- **Maximize:** Dream outcome specificity, proof it works
- **Minimize:** Perceived time to value, perceived effort to start

#### Copy Rules

| Rule | Example |
|------|---------|
| Write headlines as outcomes, not features | "Claims done Wednesday, not Sunday" ✓ / "Claim management feature" ✗ |
| Do the math for them | "Save 10 hours/week" ✓ / "Increased efficiency" ✗ |
| Use specific numbers | "45 minutes → 0" ✓ / "Much faster" ✗ |
| Benefits answer "So what?" | "Automated alerts → Never scramble for certificates at audit time" |
| No jargon | Use words the customer would use |
| People scan, not read | Every section needs a clear headline |
| One core action per page | Remove competing CTAs |

#### No Mock Data Policy

**DO NOT include fake or placeholder content:**
- ❌ No fake testimonials or quotes
- ❌ No fake company logos ("Trusted by...")
- ❌ No fake statistics ("10,000+ users...")
- ❌ No fake ratings or review scores
- ❌ No stock photos of fake customers

**If we don't have social proof yet, build trust through:**
- ✅ Product screenshots showing real UI
- ✅ Specificity about the problem (proves we understand)
- ✅ Clear explanation of how it works
- ✅ Strong guarantee or risk reversal
- ✅ Founder credibility (if applicable)
- ✅ Free trial or demo access

---

### Phase 3: Page Structure (Conversion-Optimized)

Follow this vertical hierarchy. Every section must earn its place.

#### Section A: The Hook (Above the Fold)

**Goal:** Buy 30 seconds of attention. This is 80% of the battle.

Required elements:

1. **Pre-headline:** Call out the specific audience
   ```
   "For Civil Construction Project Managers"
   ```

2. **H1 Headline:** The dream outcome in 10 words or less
   ```
   "Stop Chasing Paperwork. Start Proving Compliance."
   ```

3. **Sub-headline:** Timeframe + ease of getting started
   ```
   "Setup in one week. Start capturing audit-ready evidence today."
   ```

4. **Primary CTA:** Single, clear action
   - Cold traffic: Low friction ("See How It Works", "Watch Demo")
   - Warm traffic: Direct ("Book a Demo", "Start Free Trial")
   - Always include friction reducer: "No credit card required"

5. **Hero Visual:** Product screenshot or outcome visualization
   - Show the actual product UI
   - Show it solving the core problem
   - NEVER use generic stock photos

6. **Trust Indicator:** Only if we have real data, otherwise skip entirely

#### Section B: The Argument (Problem → Solution)

**Goal:** Agitate the pain, then present the solution.

**Structure (Problem-Agitate-Solve):**

1. **The Problem:** Describe their current painful reality
   - Be specific about what sucks
   - Use their language, their frustrations
   - Make them feel understood

2. **The Agitation:** What happens if this continues?
   - Cost of inaction (time, money, stress, risk)
   - Don't fear-monger, just be honest about consequences

3. **The Solution:** Introduce product as the vehicle to the outcome
   - Position as the bridge from pain to dream outcome
   - Keep focus on THEIR transformation, not YOUR product

4. **Benefit Stack:** 3-4 key benefits (not features)
   - Each benefit = Feature + "So what?" outcome

#### Section C: How It Works

**Goal:** Reduce perceived effort and time delay.

Show 3-4 simple steps from signup to value:
1. Step 1: First action they take
2. Step 2: What happens next
3. Step 3: The result they get

Keep it dead simple. If it looks complex, they'll bounce.

#### Section D: Features/Capabilities

**Goal:** Support the benefits with specifics.

Only include features that directly support the core value proposition.

For each feature:
- Icon or visual
- Feature name
- One sentence on the outcome it enables

Do not list everything the product does. Prioritize ruthlessly.

#### Section E: Trust Builders (Adapt to Launch Stage)

**For FRESH LAUNCH (no customers yet):**
- Product demo video or walkthrough
- Detailed "How it works" with screenshots
- Founder note explaining why you built this
- Money-back guarantee or free trial
- Specific domain expertise signals

**For ESTABLISHED (have customers):**
- Real testimonials with names and photos
- Case studies with specific outcomes
- Customer logos (only real ones)
- Metrics and statistics (only real ones)

**NEVER fake social proof.** An empty trust section is better than fake trust.

#### Section F: Objection Handling (FAQ)

**Goal:** Address the top 3-5 anxieties preventing action.

Common objections to address:
- Price concerns ("Is it worth it?")
- Effort concerns ("Is it hard to setup?")
- Risk concerns ("What if it doesn't work?")
- Timing concerns ("Do I need this now?")
- Comparison concerns ("How is this different from X?")

Format as FAQ with clear, honest answers.

#### Section G: The Closer

**Goal:** Final conversion push with risk reversal.

Elements:
1. Recap the transformation (Before → After)
2. Restate the guarantee
3. Final CTA (same as hero, repeated)
4. Friction reducer reminder

---

### Phase 4: Visual Design System

#### Hierarchy

Every element is primary, secondary, or tertiary. Make it obvious.

| Level | Elements | Treatment |
|-------|----------|-----------|
| **Primary** | Headlines, CTAs | Largest, boldest, highest contrast |
| **Secondary** | Body copy, feature descriptions | Medium weight, gray |
| **Tertiary** | Fine print, metadata | Smallest, lightest |

#### Spacing Scale

Use a consistent spacing scale throughout:

```
Base unit: 8px
Scale: 8, 16, 24, 32, 48, 64, 96, 128px
```

| Use Case | Spacing |
|----------|---------|
| Section padding | 80-120px vertical |
| Component gaps | 24-48px |
| Text spacing | 16-24px |
| Tight grouping | 8-16px |

**Rule:** Start with MORE whitespace than you think you need. Generous spacing looks professional. Cramped looks amateur.

#### Typography Scale

```
Type scale: 14, 16, 18, 20, 24, 30, 36, 48, 60, 72px
```

| Element | Size | Line Height |
|---------|------|-------------|
| Hero headline | 48-72px | 1.1-1.2 |
| Section headlines | 30-36px | 1.2-1.3 |
| Body text | 18-20px | 1.5-1.7 |
| Small text | 14-16px | 1.5 |

**Rules:**
- Line length: Max 65-75 characters for body text
- Left-align body text, never justify
- Larger body text than app UI for readability

#### Color System

| Role | Color | Usage |
|------|-------|-------|
| **Primary** | Deep blue `#1e3a5f` | Brand, primary CTAs |
| **Accent** | Safety orange `#f97316` | Highlights, secondary CTAs |
| **Text - Headlines** | Near black `#111827` | H1, H2, H3 |
| **Text - Body** | Dark gray `#374151` | Paragraphs (not pure black) |
| **Text - Muted** | Medium gray `#6b7280` | Captions, metadata |
| **Background - Primary** | White `#ffffff` | Main sections |
| **Background - Alt** | Off-white `#f9fafb` | Alternating sections |
| **Success** | Green `#10b981` | Completed, positive |
| **Warning** | Amber `#f59e0b` | Pending, attention |
| **Error** | Red `#ef4444` | NCRs, failures |

**Rules:**
- Primary CTA must have highest contrast on page
- Don't use pure gray - add slight warmth or coolness
- On colored backgrounds, use tints not grays for secondary text

#### Buttons

| Type | Style | Usage |
|------|-------|-------|
| **Primary** | Solid, high contrast, brand color | One per viewport |
| **Secondary** | Outlined or ghost | Doesn't compete with primary |
| **Tertiary** | Text links only | Navigation, minor actions |

**Sizing:**
- Padding: 12-16px vertical, 20-32px horizontal for primary CTAs
- Min height: 44px for touch targets
- Clear hover/active states

#### Borders vs Shadows

- Minimize borders - they make pages look busy
- Use subtle shadows to create depth and separation
- Use background color changes to separate sections
- Use spacing to group related elements

**Shadow scale:**
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.07);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
```

#### Cards and Containers

- Consistent border-radius: `8px` or `12px` throughout
- Shadow OR border, not both
- Adequate internal padding: `24px` minimum
- Clear content hierarchy within

#### Mobile Considerations

- Design mobile-first
- Stack elements vertically
- Increase tap targets (min 44px)
- Test that CTAs are easily reachable with thumb
- Hero content must work without horizontal scrolling

#### Section Backgrounds

- Alternate between white and subtle off-white for sections
- Can use subtle gradients, patterns, or decorative shapes
- Background decoration should enhance, not distract
- Ensure sufficient contrast for all text

---

### Phase 5: Conversion Killers to Avoid

❌ **Navigation menus with multiple options** (decision fatigue)

❌ **Multiple competing CTAs** asking for different actions

❌ **Vague headlines** that could apply to any product

❌ **Feature lists without benefit translation**

❌ **Walls of text** without visual breaks

❌ **Generic stock photos** of people in hard hats pointing at screens

❌ **Fake testimonials** or placeholder logos

❌ **Auto-playing videos** with sound

❌ **Parallax effects** and excessive animation

❌ **Forms asking for too much** information upfront

❌ **No clear next step** - every section should lead somewhere

❌ **Burying the CTA** below the fold with no repeats

---

### Implementation Checklist

#### Above the Fold
- [ ] Pre-headline calls out specific audience
- [ ] H1 is outcome-focused, under 10 words
- [ ] Sub-headline includes timeframe and ease
- [ ] Single primary CTA with friction reducer
- [ ] Hero shows real product UI
- [ ] No fake trust indicators

#### Problem-Solution
- [ ] Problem uses customer's language
- [ ] Agitation is honest, not fear-mongering
- [ ] Solution focuses on transformation
- [ ] 3-4 benefits with "so what?" outcomes

#### How It Works
- [ ] 3-4 simple steps maximum
- [ ] Visual for each step
- [ ] Feels achievable, not complex

#### Features
- [ ] Only core features included
- [ ] Each has outcome statement
- [ ] Supports main value proposition

#### Trust
- [ ] No fake elements
- [ ] Appropriate for launch stage
- [ ] Screenshots show real UI

#### FAQ
- [ ] Addresses top objections
- [ ] Honest, clear answers
- [ ] Price/effort/risk covered

#### Closer
- [ ] Transformation recap
- [ ] Guarantee restated
- [ ] CTA repeated
- [ ] Friction reducer visible

#### Visual
- [ ] Consistent spacing scale
- [ ] Type hierarchy clear
- [ ] One primary CTA style
- [ ] Mobile-first responsive
- [ ] 90+ Lighthouse score

---

## Appendix: Terminology Reference

| Term | Definition |
|------|------------|
| **Lot** | Discrete work section (e.g., 100m of pavement) |
| **ITP** | Inspection & Test Plan - quality checklist |
| **Hold Point** | Mandatory stop requiring superintendent release |
| **Witness Point** | Inspector may attend but work can proceed |
| **NCR** | Non-Conformance Report - formal defect record |
| **Conformance** | Lot passed all tests and ready to claim |
| **Chainage** | Distance along linear project (e.g., km 4.200) |
| **Docket** | Subcontractor timesheet |
| **Progress Claim** | Monthly invoice with evidence |
| **Spec** | Technical specification (TfNSW, TMR, VicRoads) |

---

*Last updated: 2026-02-04*
*Version: 1.0*
