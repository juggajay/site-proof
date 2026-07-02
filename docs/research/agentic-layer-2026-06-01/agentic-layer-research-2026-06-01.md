# AI Agentic Layer — Research Reference

Last updated: 2026-06-01

This is a **reference document**, not a build plan. It consolidates two research
passes into the idea of adding an AI agentic/conversational layer to SiteProof
(letting users complete tasks by asking the AI — e.g. "raise an NCR for cracked
concrete on Lot 3" — on top of the existing UI, not replacing it).

It exists so the human and the AI dev share the same evidence base before any AI
work starts. **No AI features should be built yet** — the engineering-health work
in `docs/engineering-health-roadmap.md` comes first. See that file for the build
sequencing; this file is the "why" and the "what we learned."

**Source-quality caveat:** findings below mix tiers. Architecture, security,
provider-privacy, and compliance findings come from primary sources (vendor docs,
OWASP, standards bodies, statute). Competitive and strategy findings lean on
vendor announcements and VC/operator blogs — strong for direction, but
"hours-saved / % adoption" figures are self-reported and should be treated as
directional, not proven. Verified items from the first (adversarial) pass are
marked ✅ where they survived a 3-vote check.

---

## TL;DR — the five things that matter

1. **The opportunity is real and specifically ours.** Agentic, action-taking AI
   built on a genuine QA/compliance data model (ITPs, hold points, NCRs), for
   small-to-mid **civil** contractors, is essentially uncontested. The big
   agentic platforms (Procore, Autodesk) aim their agents at RFIs / submittals /
   daily logs and skip quality; the QA specialists (e.g. Visibuild) own the data
   model but their "AI" is shallow (a template/checklist builder). Both skew to
   large GCs.
2. **Execute it as embedded narrow agents on our existing system-of-record — do
   NOT rebrand as "AI-native."** "AI-native" is not a moat (the LLM is a
   commodity). What defends us is the workflow we own + the proprietary
   compliance data it generates + being the system of record + trust. Add agents
   inside that; don't pivot the company around AI.
3. **Trust / auditability is the wedge.** 57% of contractors cite AI accuracy as
   their #1 adoption blocker. An agentic tool whose every action is logged,
   reversible, and tied to the audit trail directly answers that — something the
   summarization tools can't claim.
4. **The architecture is settled and we're well-positioned for it:** a tool-calling
   loop over our *existing authenticated endpoints*, read-only first,
   human-confirms every write, editable draft cards, voice push-to-talk, offline
   capture. Our clean Zod-validated, `requireAuth`-protected endpoints are the
   ideal substrate.
5. **Sequence safely.** One narrow agent (read-only "ask your project", or
   NCR-draft) → measure adoption + accuracy → expand. Reliability is the central
   risk; do not bet the brand before a real user refuses to go back.

---

## 1. Technical architecture

- ✅ **Model the agent as a tool-calling loop:** *gather context → take action →
  verify → repeat*, where existing endpoints become the agent's "tools." (Anthropic
  engineering guides.)
- ✅ **Don't wrap every REST/tRPC route 1-to-1.** Design tools around how users
  think about tasks (`raise-NCR`, `list-open-hold-points`), consolidating
  frequently-chained steps into single tools.
- ✅ **For large tool sets, two mechanisms cut cost/latency materially:**
  Anthropic's *Tool Search* (load tool defs on-demand, ~85% token reduction) and
  *Programmatic Tool Calling* (~37% reduction). **Caveat:** only worth it once
  there are *many* tools — irrelevant for the first handful.
- ⚠️ **MCP (Model Context Protocol) is NOT a slam-dunk for us.** The claim that
  "MCP automatically handles authentication, removing the need to build custom
  OAuth" was **refuted** in verification, as were claims about auto-generating MCP
  servers from an API spec. Verdict: treat MCP as *unresolved*, not recommended.
  We'd still own the auth/permission work either way — don't pick MCP expecting
  it to solve security for free.
- **Frameworks worth knowing (TS/Node + React shop):** Vercel AI SDK,
  LangChain/LangGraph, Mastra, OpenAI Agents SDK, Anthropic tool use / Claude
  Agent SDK. (Comparison sources fetched; no single winner verified — evaluate
  against our stack when we get there.)

**What this means for our build:** the agent calls our *existing* Express/tRPC
endpoints. Each becomes a tool, with its Zod schema as the tool schema. Start with
a few task-shaped tools, not a mechanical export of the whole API.

---

## 2. Security & permissions (the dominant constraint)

All items here survived adversarial verification (✅).

- ✅ **User-uploaded documents are a textbook indirect prompt-injection vector.**
  Malicious instructions hidden inside a doc/photo/cert we ingest can be misread
  by the LLM as commands. OWASP ranks prompt injection the #1 LLM risk. **Directly
  relevant** — we ingest certificates, drawings, photos, documents.
- ✅ **For tool-calling agents this enables real privilege escalation** — injected
  text telling the agent to call tools it shouldn't. Demonstrated in real
  CVE-class exploits (Microsoft Copilot).
- ✅ **The agent must ENFORCE, never bypass, the user's existing
  auth/role/tenant permissions.** Concretely:
  - Call our auth-protected endpoints **under the user's own identity and role —
    never a superuser/service token.**
  - Least-privilege, **per-tool scoping** (read-only vs write).
  - **Separate decision from execution:** a policy layer validates each call
    before it runs; the LLM does not decide what's allowed.
  - Isolate untrusted content (uploaded docs) from privileged operations.
- ✅ **Require explicit human approval for every write/destructive action**
  (raising an NCR, closing a hold point). This is the consensus mitigation for
  *both* injection risk *and* unreliability.

**What this means for our build:** we're unusually well-positioned — our routes
already enforce `requireAuth` + role/tenant checks. The rule is simply: the agent
goes *through* those same endpoints as the logged-in user. That structurally kills
the "AI did something it shouldn't" class of bugs.

---

## 3. Reliability & evaluation (the central technical risk)

- ✅ **Benchmarks are sobering.** State-of-the-art function-calling agents solved
  **<50%** of realistic "tool + agent + user" tasks (τ-bench, Sierra Research), and
  were **inconsistent** — succeeding on all 8 repeated attempts <25% of the time.
  **Caveat:** that's a mid-2024 model (gpt-4o); newer models score higher. The
  *lesson* holds regardless: **measure consistency, not a single lucky demo.**
- **Implication:** evals + confirmation gates are core, not polish. In a
  compliance domain, "right 7 times out of 8" is not "done." This is the strongest
  argument for read-only-first and human-confirm-every-write.

**Trust reality from the field:** 57% of contractors cite AI output
reliability/accuracy as their top adoption blocker (RICS / Construction Dive /
ASCE 2025 surveys); ~46% of developers distrust AI accuracy. Hallucinations in a
regulated vertical are compliance incidents, not UX glitches.

---

## 4. Cost & latency (manageable at our scale)

- **Modest at small scale** — likely tens of dollars/month per active user before
  optimization. Cost scales with **steps per request**, not headcount. An agentic
  request can cost 3×–100× a single chat call because full context is re-sent each
  step (re-sent context ≈ 62% of agentic spend).
- **Rough 2026 frontier prices:** Claude Opus ≈ $5 in / $25 out per M tokens;
  Sonnet ≈ $3 / $15; GPT-class ≈ $2–3 in / $8–15 out. (Verify at build time —
  prices move.)
- **Two biggest levers:**
  1. **Prompt caching** the static system + tool-definitions block → ~90% off
     repeated context. Keep tool definitions stable to preserve cache hits.
  2. **Model routing** — send cheap structured steps (extract lot number, classify
     severity, format a diary entry) to a small/cheap model; reserve a frontier
     model for judgment-heavy drafting (NCR narrative, claim justification). Can
     cut cost to ~12% of all-frontier.
- **Latency:** compounds across the loop. Cache the prefix, stream output, run
  independent fetches in parallel, prune tool results, and **cap steps per
  request** to prevent runaway loops.

---

## 5. UX patterns (where our field users make it hard)

- **Inline, context-aware entry point — not a floating chatbot.** Put the AI on the
  record screen (e.g. the Lot screen) so it already knows the context; the user
  just says "raise an NCR for cracked concrete." Show 3–4 **suggested prompts** per
  screen to solve the blank-box problem — field users won't know what to ask.
- **Every write → an editable, pre-filled draft card, not a yes/no.** Show parsed
  fields (lot, defect, location, photos) so the human glances at *content* before
  committing. Confirm only irreversible actions; over-confirming is what makes
  HITL annoying. Force a content glance, not a bare "Confirm".
- **Voice = push-to-talk, not wake-word** (wake words misfire on noisy sites).
  **Reality:** jobsite noise drops speech recognition from ~95% to 85–92% (as low
  as 65–70%), so the editable draft is mandatory, not optional. Feed construction
  jargon (NCR, ITP, lot, materials) into the recogniser or accuracy collapses.
  Show the live transcript.
- **Offline-first capture with deferred sync** — let a foreman dictate an NCR with
  no signal and queue it; never block the action on connectivity. Auto-retry
  transient (connectivity) failures; ask the human on permanent (misunderstanding)
  failures.
- **One-tap undo/void on every AI-created record;** fall back to the pre-filled
  form when parsing fails. The AI is an accelerator over the existing UI, never the
  only path.
- **Closest analogues to study:** OpenSpace AI Voice Notes, Raken voice daily logs,
  Hardline (jobsite calls → logs/RFIs/tasks), aiOla (field voice capture).
  **Cautionary tale:** McDonald's killed its drive-thru voice AI (2024) —
  noisy-environment voice is genuinely hard.

---

## 6. Competitive landscape (2025–2026)

**Headline: the big platforms went agentic but aimed away from quality; the QA
specialists own the data model but have only shallow AI. The intersection is open.**

- **Procore** — most aggressive. **Agent Builder** (open beta, Oct 2025) with
  *Actions* (agents update records / generate docs) + *Triggers* (auto-fire on
  events); pre-built **RFI** and **Daily Log** agents; **Procore Assist** (GA, now
  with photo intelligence, multilingual, mobile voice). **No mention of quality /
  inspections / ITPs / NCRs.** Their Inspections "conditional logic" is rules, not
  AI.
- **Autodesk Construction Cloud** — **Assistant**: MCP-orchestrated multi-agent;
  quick RFI create, drawing extraction. Design/GC-centric. Not QA.
- **HammerTech Intelligence** (July 2025) — toolbox-talk transcription, observation
  photo recognition, SDS autofill. **Safety admin only**, extraction not agentic.
- **Document Crunch** — contract/spec compliance AI; **being acquired by Trimble**
  (expected Q2 2026). Document layer, not field QA.
- **Fieldwire** — AI photo auto-tagging, voice → task/report. Light AI.
- **Buildertrend** (residential), **Raken** (field-report summaries, photo tagging),
  **Doxel / OpenSpace** (visual/progress capture, OpenSpace has strong AI voice
  notes). None QA-structured or agentic.
- **Visibuild** (AU/NZ) — closest **data-model** competitor: ITPs, hold/witness
  points, NCRs, defects, audit trails, $10B+ projects. **AI footprint is thin: an
  "AI checklist builder" to draft ITP templates. No agentic layer.**

**Adoption reality (opportunity signal):** ~45% of firms report no AI
implementation; 87% expect AI to matter but only ~19% have changed workflows; top
barriers are reliability (57%) and data security (54%). Hype is running ahead of
field usage — i.e. the space is early and uncrowded. *(Figures from RICS /
Construction Dive / ASCE 2025; vendor "hours saved" stats are self-reported.)*

**White space:** *agentic-first quality/compliance for small-to-mid civil
contractors* — combining a QA data model the agentic majors lack with action-taking
agents the QA specialists lack, anchored on auditability to beat the trust barrier.
Civil/infrastructure contractors (roads, drainage, structures) carry heavy
state-spec-driven ITP burdens and have weaker tooling than the large-GC market the
incumbents chase. **Window caveat:** Procore's Trigger/Action architecture could
extend into inspections later; move while the niche is open.

---

## 7. Strategy, moat & pricing

- **"AI-native" is not a durable moat.** a16z, Bessemer, Menlo converge: the LLM is
  a commodity ingredient. Durable defensibility = owning the workflow end-to-end +
  the proprietary data the product *causes to exist* + being the system of record +
  trust earned over time. We already have these.
- **"Workflow vs data" moat debate:** sources disagree on emphasis but reconcile to
  *both* — workflow ownership is what makes the data proprietary and switching costs
  real. For a QA product, **the workflow IS the data-generation engine.** Strong
  position.
- **Incumbent AI playbook (mirror Procore at solo scale):** ship 1–2 narrow,
  named, *grounded*, human-in-the-loop agents tied to the highest-pain steps; keep
  them inside the existing UI; use a model-abstraction layer so providers can be
  swapped as prices fall; treat prompts as version-controlled IP.
- **Pricing:** don't flip to pure usage billing (78% of IT buyers report surprise
  bills; creates renewal anxiety). Recommended early structure: **hybrid —
  existing subscription + metered credits tied to something contractors value**
  (NCRs drafted, ITP reviews completed), with usage caps. AI gross margins ~50–60%
  vs 80%+ classic SaaS — price with inference cost in mind ("if the math doesn't
  work at 10 customers, it won't at 1,000").
- **Failure base-rate (respect it):** MIT (Aug 2025) — ~95% of enterprise GenAI
  pilots fail to move profitability; AI-wrapper margins 25–35%. Dominant failure is
  distraction, low adoption, trust erosion — not model quality. *(Some figures are
  blog/secondary — directional.)*
- **Solo-founder warning:** burnout/distraction is the #1 killer; a repositioning
  that forces a rewrite is the classic trap. Use AI to accelerate *building*; add it
  to the product as a contained feature, not a pivot. Validate the real problem
  first — no runway for three pivots.

---

## 8. Risk & compliance (AU + general)

- **Probably NOT "high-risk" under the EU AI Act** (construction QA isn't in the
  high-risk Annex III list; narrow-procedural-task exemption likely applies). **Two
  caveats:** features touching subcontractor/worker management could brush the
  "employment" category; transparency expectations still apply. Main high-risk
  obligations start 2 Aug 2026.
- **Australia chose NO mandatory AI law** (Dec 2025 National AI Plan → voluntary
  NAIC "AI6" guidance; no single AI regulator). So no AI-specific statutory gate
  today — obligations flow from existing law: WHS duties, contract/QA obligations,
  ISO 9001, general liability.
- **The binding constraints are ISO 9001 + liability:**
  - "**Signature is liability**" — once a human signs an AI-drafted hold-point
    release / inspection sign-off, they own its content, including AI errors.
    Rubber-stamping ("automation bias") can itself be negligence. The UX must force
    genuine review.
  - A record's defining property is that it is **not altered after the fact**.
    AI that *modifies* a signed record is higher-risk than AI that drafts a new one
    — modifications must be **versioned/append-only, never silent overwrite**.
- **Audit-trail spec (concrete, build this into the agent from day one):** for
  every AI-touched record, persist —
  - the AI draft **as generated** (unaltered),
  - **every human edit** (the diff),
  - the **approver + role + timestamp**,
  - the **model + prompt version**,
  - the **signing/attestation event**,
  - and **clearly label AI-authored vs human-approved** content.
  For the highest-stakes records (signed releases, progress claims), consider a
  **hashed (e.g. SHA-256), append-only, exportable** copy — internal app logs alone
  are weaker evidence because the app can edit them. We already have strong audit
  logging; this is an extension of it — *and it's also our trust differentiator.*
- **Framing:** AI proposes a draft; a named, authorized, role-appropriate human
  reviews, edits, and signs; the human remains the legal author. Role-gate approval
  of legally-significant records; block one-click bulk-approval of safety/hold-point
  items.

---

## How this connects to the build

- The engineering-health work in `docs/engineering-health-roadmap.md` is the
  prerequisite: clean, consistent, authenticated, well-tested endpoints are exactly
  the substrate this research says an agent needs. **AI-readiness is the tiebreaker**
  on cleanup priorities — it is not a separate project.
- **First AI step, when ready (a separate future phase):** a read-only "ask your
  project" prototype for dogfood users, built strictly on existing authenticated
  endpoints, no writes. Watch how people phrase requests — that tells us which
  write-agents to build first. Then add one write-agent (NCR draft is the strongest
  candidate: language-heavy, currently manual, high-pain) behind an editable draft
  card + explicit confirmation + the audit-trail spec above.
- **Hard rules carried from the research into any future AI work:**
  1. Agent acts through existing endpoints, as the logged-in user, never a
     superuser token.
  2. Read-only first; explicit human confirmation on every write.
  3. Editable draft cards that force a content glance; one-tap undo.
  4. Treat uploaded-document content as untrusted (prompt-injection surface);
     isolate it from privileged actions.
  5. Full AI-authorship audit trail on every AI-touched record.
  6. Evals + a per-request step cap; measure consistency, not demos.
  7. Voice = push-to-talk + jargon vocabulary + offline capture.
  8. It's an accelerator layered over the UI, never the only path.

---

## Sources

### Architecture & security (primary)
- https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk
- https://www.anthropic.com/engineering/writing-tools-for-agents
- https://www.anthropic.com/engineering/advanced-tool-use
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool
- https://genai.owasp.org/llmrisk/llm01-prompt-injection/
- https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html
- https://www.microsoft.com/en-us/msrc/blog/2025/07/how-microsoft-defends-against-indirect-prompt-injection-attacks
- https://arxiv.org/html/2503.15547v2  (Prompt Flow Integrity)
- https://arxiv.org/pdf/2406.12045  (τ-bench reliability)
- https://platform.claude.com/docs/en/build-with-claude/api-and-data-retention
- https://openai.com/enterprise-privacy/

### Cost, latency & routing
- https://leanopstech.com/blog/agentic-ai-cost-runaway-token-budget-2026/
- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://www.anthropic.com/news/prompt-caching
- https://tianpan.co/blog/2025-10-19-llm-routing-production
- https://acuvate.com/blog/choosing-right-ai-model-llm-slm-fm/
- https://futureagi.com/glossary/time-to-first-token-ttft/

### UX
- https://www.shapeof.ai/
- https://jakobnielsenphd.substack.com/p/prompt-augmentation
- https://aws.amazon.com/blogs/machine-learning/implement-human-in-the-loop-confirmation-with-amazon-bedrock-agents/
- https://developers.cloudflare.com/agents/concepts/human-in-the-loop/
- https://mastra.ai/blog/human-in-the-loop-when-to-use-agent-approval
- https://deepgram.com/learn/speech-recognition-accuracy-production-metrics
- https://deepgram.com/learn/noise-robust-speech-recognition-methods-best-practices
- https://www.openspace.ai/products/field/field-notes/
- https://aiola.ai/
- https://www.aiuxdesign.guide/patterns/error-recovery
- https://www.mindstudio.ai/blog/ai-agent-failure-pattern-recognition

### Competitive landscape
- https://www.procore.com/press/procore-advances-the-future-of-construction-with-new-ai-innovations
- https://www.procore.com/press/procore-launches-procore-ai-with-new-agents-to-boost-construction-management-efficiency
- https://highways.today/2026/05/22/procore-agentic-ai/
- https://www.autodesk.com/solutions/autodesk-ai/autodesk-assistant
- https://www.prnewswire.com/news-releases/construction-safety-leader-hammertech-debuts-first-wave-of-ai-powered-capabilities-to-automate-site-safety-admin--reduce-risk-302499368.html
- https://www.documentcrunch.com/news/crunch-ai-for-specifications
- https://www.fieldwire.com/blog/product-updates-2025-ai-photo-tagging/
- https://www.openspace.ai/press-releases/visual-intelligence-platform/
- https://visibuild.com/product/construction-itp-software/
- https://www.constructiondive.com/news/builders-ai-survey-adoption-gap-construction/761632/
- https://www.rics.org/news-insights/artificial-intelligence-in-construction-report

### Strategy, moat & pricing
- https://a16z.com/context-is-king/
- https://www.a16z.news/p/in-defense-of-vertical-software
- https://www.bvp.com/atlas/part-iv-ten-principles-for-building-strong-vertical-ai-businesses
- https://www.bvp.com/atlas/the-ai-pricing-and-monetization-playbook
- https://menlovc.com/perspective/software-finally-gets-to-work-the-opportunity-in-vertical-ai/
- https://www.vendep.com/post/forget-the-data-moat-the-workflow-is-your-fortress-in-vertical-saas
- https://www.tidemarkcap.com/post/tidemark-ai-playbook
- https://www.chargebee.com/blog/pricing-ai-agents-playbook/
- https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/

### Risk & compliance
- https://artificialintelligenceact.eu/article/6/
- https://artificialintelligenceact.eu/annex/3/
- https://www.whitecase.com/insight-alert/australia-launches-new-ai-guidance
- https://consult.industry.gov.au/ai-mandatory-guardrails
- https://digital.nemko.com/insights/iso-9001-and-ai-auditing-the-future-of-quality-management
- https://www.bprhub.com/blogs/iso-9001-quality-record-retention-procedure
- https://www.kiteworks.com/regulatory-compliance/human-in-the-loop-ai-compliance/
- https://www.trytwofold.com/blog/do-ai-clinical-notes-hold-up-in-court
- https://www.cxtoday.com/security-privacy-compliance/ai-audit-trail-regulatory-scrutiny/
- https://www.certifywebcontent.com/service/ai-act-article-12-logs-not-legal-evidence/

### Refuted in verification (do NOT rely on these)
- MCP "automatically handles authentication, removing the need for custom OAuth" — **refuted 0-3**.
- AutoMCP auto-generating MCP servers from OpenAPI at ~76–99% success — **refuted 1-2**.
- "Nearly all automation failures originate in the OpenAPI spec, not the runtime" — **refuted 1-2**.
