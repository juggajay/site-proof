# TMR / authority digital-handover recon — what's publicly known (2026-08-06)

Context: CivilPro's founder (Spatial webinar, on record) says their 3D/4D "how-constructed models"
roadmap is driven by **TMR requiring conformance data in handover models**. This recon checks what
is actually public from TMR, TfNSW and the council layer, to calibrate whether/when CIVOS needs an
IFC handover-model story. Method: web search + fetch, 2026-08-06. TMR's website 403s all
non-browser clients (Cloudflare), so the primary guideline PDFs still need a manual pull —
listed at the bottom.

## 1. TMR (QLD) — the claim is directionally real, at major-project tier

- Queensland's State Infrastructure Strategy sets a **"digital by default"** direction with BIM
  progressively implemented on **all major state infrastructure projects** (mandate horizon cited
  as 2032 in secondary sources — verify against the current SIS).
- TMR maintains a Building Information Modelling publications tree: **BIM Guideline**, **BIM for
  ITS Manual**, and a **Revit-to-IFC export pack** (still "tested with Revit 2020" — their tooling
  is dated).
- TMR's own EIT Forum material (digital systems team): **openBIM data structures form contractual
  requirements for TMR BIM deliverables**; client-side **automated BIM data validation**, direct
  asset-management upload and GIS integration; contract documentation aligned with **IFC, IDS and
  IDM** via buildingSMART collaboration. Secondary summaries state an increasing number of projects
  require the contractor to **maintain the model through construction and deliver an As-Built model
  at handover**.
- The QA anchor specs remain **MRTS50** (quality system) and **MRTS56** (construction surveying /
  As-Constructed Survey), plus EP172 (e-signatures on drawings).
- **Not found publicly**: a spec that says verbatim "conformance/QA records must be embedded in the
  handover model". That requirement most likely lives in project-specific Asset Information
  Requirements / EIR annexures (not published) — consistent with the founder's claim but only
  partially verifiable from open sources.

## 2. TfNSW (NSW) — further along than assumed, but scoped to major works

- TfNSW has had a **Digital Engineering Framework since 2018/19**, now v4.x: DMS-ST-202 (Part 1,
  concepts) and **DMS-ST-207 (Part 2, requirements)** — management requirements + technical
  deliverables for **"DE-enabled"** projects.
- Applicability: **Infrastructure & Place Major Works and professional services contracts, where DE
  is specified** — not all projects; the framework was piloted on selected projects and the current
  focus is plan/acquire (design + construction) phases. No public dollar threshold found.
- TfNSW explicitly rejected COBie ("Why not COBie", DMS-SD-138) in favour of an IFC/asset-data
  approach; contractors on DE-enabled projects must run a CDE integrated with TfNSW's.
- Implication: the requirement exists in NSW **today** at the tier-1/major-works level; it reaches
  our market only as flow-down from head contractors, not on the sub-$50M council/subdivision jobs
  our prospect list targets.

## 3. Council layer — ADAC is the near-term reality for our actual customers

- **ADAC XML** (IPWEA-QNT) is the as-constructed data standard for councils/utilities: **24 councils
  subscribed**; in SEQ, compliant ADAC XML is a **regulatory requirement** under the SEQ Water
  Supply and Sewerage Design & Construction Code.
- **ADAC v6.00 is rolling out now**: Sunshine Coast accepts v6.00 (or 5.02 on GDA2020) from
  **1 Mar 2026** and **only v6.00 after 1 Sep 2026**. Other subscribing councils will follow their
  own cutovers.
- Our existing ADAC XML work is aimed at exactly this layer — and it's the layer our Hunter/NSW
  prospect list actually deals with, unlike IFC handover models.

## 4. Calibration for CIVOS

1. **The IFC/4D wave is real but top-tier.** TMR majors (and TfNSW DE-enabled majors) are tier-1
   territory — CivilPro's existing customer base, not our founding users. Their 3D/4D build defends
   their tier-1 install base; it does not threaten our beachhead.
2. **Near-term compliance surface for our customers is ADAC + MRTS/Q6-style QA records**, both of
   which we already address. ADAC v6.00 support should be checked/scheduled against the 2026
   cutover dates — that's a real date-driven task, unlike IFC.
3. **TMR's IDS/machine-validation direction favours us long-term**: authorities want structured,
   validatable data. We hold lot geometry + conformance records natively; emitting a compliant
   deliverable (ADAC now, IFC-with-propertysets later) is an exporter problem, not a re-architecture.
4. **Trigger to build IFC export**: first tender/prospect that names DMS-ST-207, TMR BIM
   deliverables, or handover models. Until then: watch.

## 5. PRIMARY-SOURCE UPDATE (pulled via Jay's browser, same day)

Both key PDFs retrieved and archived in `tmr-source-docs/` (plus extracted `.txt`):
**BIM for TMR Guideline** (54 pp) and **Exchange Information Requirements (EIR), May 2026** (39 pp
— current edition). Verbatim findings from the EIR:

- **The per-lot IFC requirement is real and written**: the As Constructed model submission must
  include *"As Constructed survey of completed construction lots in an Industry Foundation Class
  \*.ifc 2x3 open file format"* (EIR §9.1.2) — alongside 12d ASCII digital models, a federated
  As Constructed 3D attributed model, and TMR object attributes assigned per their published
  attribute files. This confirms the CivilPro founder's driver, from TMR's own contract document.
- Objects carry **property sets** including a dedicated **"As Constructed attributes"** set
  (EIR §8.6), defined in TMR's civil object attribute files; PIM data explicitly feeds
  *"quality assurance records of the As Constructed infrastructure"* (§2).
- As Constructed gate = **LOD 500 field-verified**, all required attributes applied; contractor
  must run **model validation documentation** against a predetermined schedule of objects and
  attributes (§9.2) — machine-checkable deliverables.
- Framing is **ISO 19650**; the EIR is "a key tendering document" applicable **across contract
  types** including Transport Infrastructure Contracts for construction — but BIM itself is
  mandated on **major state infrastructure projects** ("major projects since 2016"; Guideline
  references QTRIP procurement routes). Sub-major works are pulled in only where the contract
  includes BIM.
- EIR timing (May 2026) neatly explains CivilPro's 3D/4D push (webinar March 2026).

Calibration unchanged but sharpened: the deliverable is **per-construction-lot IFC 2x3 with
attributed as-constructed data** — which is almost exactly our data model (lots + geometry +
conformance attributes). When a tender triggers it, our exporter writes IFC 2x3 (older, simpler,
stable spec) per lot with property sets — very buildable.

## 6. Remaining manual follow-ups

- ~~TMR BIM Guideline PDF~~ ✅ pulled 2026-08-06 (`tmr-source-docs/`)
- ~~TMR EIR~~ ✅ pulled 2026-08-06 — the key doc, see §5
- ~~EIT Forum articles~~ ✅ read via browser: "digital by default by 2032" is a state government
  mandate (paper→digital); BIM committed on major projects; goal is BAU across all projects/assets.
  Definitive Network article = road-network dataset/digital-twin strategy, not handover requirements.
- Current **State Infrastructure Strategy** BIM/digital-by-default wording
- **DMS-ST-207 v4.1 PDF** (transport.nsw.gov.au — may fetch directly)
- ADAC v6.00 schema/what's-changed (apeandc.com.au, IPWEA-QNT)
- ~~TMR **civil object attribute files**~~ ✅ **D6 pull complete 2026-08-06** — see §7

## 7. D6 NORMATIVE PULL (2026-08-06, via Jay's browser)

**Headline finding: there is no separate "civil" object-attributes file.** The civil discipline
schedule (drainage, kerbs, gully pits, …) is published **inside the BIM Guideline itself**
(§6.4.1 "Object Attributes Tables – Civil"). The per-discipline XLSX files on the departmental
website cover **bridges, ITS and road furniture** only — and the three use mutually inconsistent
pset names and attribute spellings (details in the 3D/4D spec §2/§4.1). TMR's site search returns
nothing further for "object attributes"; the old Export Pack page URL (§Sources) now 404s — the
BIM publications page is the canonical index.

Files pulled (all archived in `tmr-source-docs/`, base URL `https://www.tmr.qld.gov.au`):

| File | Source path |
|---|---|
| `tmr-object-attributes-for-bridges-v6-4.xlsx` (+33 CSV sheets) | `/_/media/busind/commercial-services/software/main-roads-revit-to-ifc-export-pack/tmr-object-attributes-for-bridges-v6-4.xlsx` |
| `tmr-object-attributes-for-its.xlsx` (+13 CSV sheets) | `/_/media/busind/techstdpubs/road-planning-and-design/building-information-modelling/tmr-object-attributes-for-its.xlsx` |
| `tmr-object-attributes-for-road-furniture.xlsx` (+9 CSV sheets) | `/_/media/busind/techstdpubs/road-planning-and-design/building-information-modelling/tmr-object-attributes-for-road-furniture.xlsx` |
| `tmr-bim-file-naming-convention.xlsx` (+CSV) | `/_/media/busind/techstdpubs/road-planning-and-design/building-information-modelling/tmr-bim-file-naming-convention.xlsx` |
| `tmr-bep-template.docx` (+txt) | `/_/media/busind/techstdpubs/road-planning-and-design/building-information-modelling/tmr-bep-template.docx` |
| `bim-for-bridges-manual.pdf` (+txt) | `/_/media/busind/techstdpubs/road-planning-and-design/building-information-modelling/bim-for-bridges-manual.pdf` |
| `bim-for-its-manual.pdf` (+txt) | `/_/media/busind/techstdpubs/road-planning-and-design/building-information-modelling/bim-for-its-manual.pdf` |
| `bim-for-road-furniture.pdf` (+txt) | `/_/media/busind/techstdpubs/road-planning-and-design/building-information-modelling/bim-for-road-furniture.pdf` |
| `tmr-revit-to-ifc-export-pack-v6-4.zip` (+ extracted pset definition txt) | `/_/media/busind/commercial-services/software/main-roads-revit-to-ifc-export-pack/tmr-revit-to-ifc-export-pack-v6-4.zip` |

Export Pack note: **V6.4 (Oct 2025)** replaces V6.0; it no longer ships the Revit-category → IFC
mapping file and is bridges-focused (Revit .rte template + shared parameters + a user-defined pset
file whose element lists use IFC4x3 class names, e.g. `IfcBearing`). The BIM page also confirmed
the complete publications set — nothing else on the Digital Engineering pages names IFC or object
attributes beyond what is archived here.

### Sources
- https://www.tmr.qld.gov.au/business-industry/Technical-standards-publications/Building-Information-Modelling
- https://www.tmr.qld.gov.au/business-industry/road-systems-and-engineering/software/transport-and-main-roads-revit-to-ifc-export-pack
- https://eitforum.tmr.qld.gov.au/moving-towards-digital-by-default-through-more-effective-digital-engineering/
- https://eitforum.tmr.qld.gov.au/tmrs-definitive-network-towards-a-digital-twin/
- https://www.tmr.qld.gov.au/-/media/busind/techstdpubs/Specifications-and-drawings/Specifications/1-Overarching-Specifications/MRTS56.pdf
- https://www.transport.nsw.gov.au/digital-engineering/digital-engineering-framework
- https://www.transport.nsw.gov.au/system/files/media/documents/2022/Digital-Engineering-Standard-Part-2-requirements-v4.1.pdf
- https://www.transport.nsw.gov.au/system/files/media/documents/2023/Why-not-COBie-DMS-SD-138.pdf
- https://www.transport.nsw.gov.au/digital-engineering/digital-engineering-faqs
- https://www.logan.qld.gov.au/ADAC-information
- https://www.sunshinecoast.qld.gov.au/development/development-tools-and-guidelines/infrastructure-guidelines-and-standards/as-constructed-data-standards-and-guidelines
- https://apeandc.com.au/f/adac-version-600
- https://www.ipwea-qnt.com/Web/Web/Resources/Asset-Design-As-Constructed-ADAC.aspx
