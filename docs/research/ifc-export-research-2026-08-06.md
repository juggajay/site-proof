# Server-side IFC 2x3 as-constructed export — research findings

Research date: 2026-08-06. Target: CIVOS/SiteProof v3, Node 20 + Express + Prisma, Docker on Railway.

> **Note on this file.** It previously held the orchestrator's inline notes, compiled on the belief
> that this research agent had stalled. It had not — this is the full report. **The orchestrator's
> findings were not discarded**: its spike at `../ifc-spike/` is load-bearing evidence and is
> incorporated throughout (§2, §4), I re-ran its validation independently rather than trusting the
> stored output (§5.1), and **its recommendation — hand-rolled STEP — survives this research and is
> confirmed** (§4). What changed is the *content* of the file the spike writes: §1.3 shows it emits
> the wrong property sets, and §5.2 shows the validator it passed cannot detect that.

Primary sources read in full: `docs/research/tmr-source-docs/tmr-eir.txt` (TMR Exchange Information
Requirements, May 2026) and `docs/research/tmr-source-docs/tmr-bim-guideline.txt` (BIM for Transport
and Main Roads Guideline, May 2026). External claims carry source URLs. Findings marked **[RAN IT]**
were verified by executing code, not by reading docs.

---

## 1. TMR requirements extract — the acceptance criteria

### 1.1 The contractual driver — EIR §9.1.2 Construction, "As Constructed model submission"

Verbatim, the full bullet list (EIR §9.1.2, p.27):

> In addition to the standard deliverables of As Constructed records outlined in the department's
> MRTS56 *Construction Surveying*, MRTS50 *Specific Quality System Requirements*, and the *Drafting
> and Design Presentation Standards Manual*, the As Constructed records must include the results of
> As Constructed surveys conducted by a qualified surveyor including:
>
> - As Constructed digital models, on the project datum in 12D ASCII format
> - A federated As Constructed 3D attributed model of the constructed works developed from the As
>   Constructed survey suitable for viewing in a model file viewer
> - Asset attributes as outlined in *Building Information Modelling (BIM) for Transport and Main
>   Roads Guideline* and the *Transport and Main Roads object attributes for bridges, ITS, and Road
>   Furniture publications* are to be assigned to the objects in the models
> - **As Constructed survey of completed construction lots in an Industry Foundation Class \*.ifc 2x3
>   open file format**, and
> - Any As Constructed 3D attributed models showing details of the completed works including Public
>   Utility Plant constructed and/or relocated to AS5488 *Classification of Subsurface Utility
>   Information (SUI)* quality level A.

**The surrounding bullets bound the scope favourably.** The IFC 2x3 clause is one of five
deliverables and the only one scoped to *"completed construction lots"*. The federated model and the
12D ASCII deliverable are separate obligations sitting with the surveyor/designer. CIVOS is not being
asked to produce a federated road model — it is being asked to emit a per-lot IFC 2x3 file carrying
as-constructed attributes, which is exactly the data CIVOS already holds.

The general rule this specialises, EIR §9 (p.24):

> Models shall be provided in both native file and an Industry Foundation Class (IFC) format for each
> discipline model and form the basis for the development of a federated model.

### 1.2 Property sets — EIR §8.6 "Transport and Main Roads object property sets"

> Objects within the BIM object models shall be developed to have at least one, or a number of, the
> following property sets:
>
> - Project Level attributes
> - Design attributes
> - **As Constructed attributes**, or
> - Asset management attributes.
>
> The property sets shall be created and displayed as separate tabs in the properties window within a
> model file viewer for selected objects (as shown in Figure 8.6). The property sets are defined in
> the *civil discipline specific object attribute files* or the *TMR object attributes for bridges*,
> published on the departmental website. For objects not listed in the TMR object attributes file,
> the design consultant or Contractor shall prepare and submit attribute schedules for these objects
> to suit the needs of the project as part of their BIM execution plan.

Restated in EIR §9.3 (p.29) with *IFC* made explicit:

> The property sets shall be created and displayed as separate tabs in the properties window within an
> **IFC model file viewer**, for selected objects. […] All required attributes shall be applied to
> the objects in the models and displayed on a dedicated **Project, Design, Construction, or Asset
> Management property sets** as defined in the discipline specific object attribute files.

**This is the single most important design input in either document.** "Separate tabs in the
properties window" is how an IFC viewer renders **distinct `IfcPropertySet` instances**. The
requirement is four named property sets per object, not one flat bag.

The orchestrator's note correctly caught the §8.6 escape hatch — *"For objects not listed in the TMR
object attributes file, the […] Contractor shall prepare and submit attribute schedules […] as part
of their BIM execution plan"* — i.e. a CIVOS-specific pset is admissible **if scheduled in the BEP**.
That remains true. But it is an escape hatch for *objects TMR has not catalogued*, and it does not
license replacing the four named sets for objects TMR **has** catalogued. See 1.3.

### 1.3 The actual pset names and attribute spellings — Guideline §6.4.1

Guideline §6.4.1 Tables 6.4.1(a)–(c) have a literal column headed **"IFC Property Set"**. The values
in that column across every civil object are exactly four: **`Project`**, **`Design`**,
**`Construction`**, **`Asset Management`**. That is authoritative pset naming, and it resolves the
§8.6 ("As Constructed attributes") vs §9.3 ("Construction") drift in favour of **`Construction`**.

The as-constructed-relevant attributes, verbatim from the tables:

| Pset | Attribute | Example value (verbatim) |
|---|---|---|
| `Project` | `District` | `Far North` |
| `Project` | `AssetOwner` | `TMR` |
| `Project` | `RoadSectionID` | `41E` |
| `Project` | `Datum` | `GDA2020` |
| `Project` | `Zone` | `56` |
| `Project` | `ModelCertifiedIssuedForConstructionRPEQ` | `Bob Person – 12346` |
| `Project` | `ModelCertifiedAsConstructedSurveyor` | `Jane Citizen – Reg Surv 3322` |
| `Design` | `UniqueObjectCode` | `IPMWR2D-MC1A0-DR-CU-0001` |
| `Design` | `ControlLine` | `MC1A0` |
| `Design` | `Chainage` / `StartChainage` / `EndChainage` / `StartCHG` / `EndCHG` | `62100`, `61664`, `61695` |
| `Design` | `Tdist` | `7.546 km` |
| **`Construction`** | **`ConstructionLotNumber`** | **`To Contractors QA system`** |
| **`Construction`** | **`ConstructionDate`** | **`DD-MON-YYYY`** |
| `Asset Management` | `UniqueObjectCode` | `IPMWR2D-MC1A0-DR-CU-0001` |
| `Asset Management` | `TdistStart` / `TdistEnd` | `2.235 km` / `10.235 km` |
| `Asset Management` | `Offset` | `8.5 m Left` |

Two are decisive for CIVOS:

1. **`ConstructionLotNumber`'s example value is literally the string "To Contractors QA system".**
   TMR is documenting that this value is sourced from the contractor's QA system. CIVOS *is* that
   system. That is the integration point, stated in TMR's own table.
2. **`ModelCertifiedAsConstructedSurveyor`** ("Jane Citizen – Reg Surv 3322") sits in the `Project`
   pset, so the surveyor's registration number travels inside the file. CIVOS must capture and carry it.

The `Design` pset also carries the pavement block (Guideline Table 6.4.1(b)): `PavementConfiguration`,
`ControlLine`, `StartCHG`, `EndCHG`, `LayerNumber`, `LayerWidth`, `LayerDescription`, `LayerCode`,
`LayerDepth`, `BinderType`, `Additive`, `AdditivePercentage` — examples `MLLE`, `61950`, `62300`,
`7.0 m`, `Stone Mastic Asphalt`, `G3`, `100 mm`, `A5S`.

> **This is the spike's main defect.** `ifc-spike/LOT-042-as-constructed.ifc` emits **one** pset named
> `CIVOS_AsConstructed` carrying CIVOS-invented names (`LotNumber`, `ConformanceStatus`, `ConformedAt`,
> `ITPCompletion`). Verified by grep. TMR asks for **four** psets with **their** spellings —
> `ConstructionLotNumber`, not `LotNumber`. The fix is mapping work, not architecture, but nothing in
> the spike's validation gate can detect it (§5.2). Keep the CIVOS-specific evidence fields
> (`ITPCompletion`, `TestReferences`, `NCRReferences`) — they are genuinely additive and the §8.6
> escape hatch covers them if the BEP schedules them — but carry them **alongside** TMR's four, not
> instead of.

### 1.4 Unique object codes — EIR §8.4 / Guideline §6.4–6.5

EIR §8.4:

> Where possible civil infrastructure components within specific discipline model files should be
> clearly identified by the use of unique object codes […] The unique object codes should be included
> as one of the attributes assigned to the modelled object.

Structure (EIR Figure 8.4 / Guideline Figure 6.4), verbatim:

> Project ID = Ipswich Motorway Rocklea 2 Darra (IPMWR2D)
> Control Line = MC1A0
> Discipline = Pavements (PA)
> Object Code = ML1A (Pavement configuration label)
> Unique Number = 0001

Guideline §6.4 adds the *why*, which matters for our validation story:

> The use of the unique object codes as an attribute can be used to enable an effective process for
> **automating and validating the object attributes** which can have impacts to downstream BIM
> workflows, such as estimating and validation of model object information.

Guideline §6.5 publishes the full civil code table: `PA` pavements; `DR-CU` culvert, `DR-DG` pipe
network, `DR-GP` gully pit, `DR-FI` field inlet, `DR-AC` access chamber, `DR-KB01`–`KB28`
kerb/channel; `RF-FN*` fences, `RF-SB*` safety barriers, `RF-SIGN*` signage, `RF-NB` noise barrier;
`PE-*`/`PN-*` PUP existing/new; `LI-*` lighting; `TS-*` traffic signals; `IT-*` ITS&E. `Line Marking
(RF LM)` is listed as **"To be defined"**.

### 1.5 Coordinate system — EIR §8.2, Guideline §6.2

EIR §8.2 *Survey control*, in full:

> The Horizontal coordinate datum for all new Transport and Main Roads surveys shall be the
> **Geocentric Datum of Australia 2020 (GDA2020)** and implemented in the relevant zone of the **Map
> Grid of Australia** (for example, GDA2020 / MGA Zone 56).
>
> All survey heights shall be based on the **Australian Height Datum**.

EIR §3 defines MGA: *"A coordinate system based on the Universal Transverse Mercator projection and
the Geocentric Datum of Australia. **The unit of measure is the metre.**"*

**Metres, not millimetres.** A live footgun: IfcOpenShell's `unit.assign_unit()` with no arguments
defaults to **millimetres** (**[RAN IT]** — emits `IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)`).
Building-world defaults are wrong for this deliverable. *The spike gets this right* — verified
`IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`.

MGA Zone 56 eastings are ~500,000 and northings ~6,900,000 (confirmed by the Guideline's own
`PitCentreX 535763.782`, `PitCentreY 6894618.016`). Writing those as raw `IfcCartesianPoint`
coordinates costs float precision and breaks viewers assuming near-origin geometry. Use a local
origin with the MGA offset on the site placement — *which the spike already does*, recording
`site origin = E 502140.000 N 6961420.000 (CH 1200)` in the site description.

**IFC2x3 has no `IfcMapConversion`** (that arrived in IFC4), so georeference must ride on
`IfcSite.RefLatitude`/`RefLongitude`/`RefElevation` plus the `Project` pset's `Datum` and `Zone`.
That is precisely why TMR put `Datum`/`Zone` in a pset: **the pset is the georeference mechanism in
2x3.** The spike currently carries it as free text in the site description and a `CoordinateSystem`
property — moving `Datum`/`Zone` into the `Project` pset makes it machine-readable.

### 1.6 Level of information need — EIR §9.4 Table 9.4

For the **As Constructed Submission** gate, verbatim:

> **Submission Gate Deliverables:** 3D object models of all discipline models, field verified As
> Constructed.
>
> **LOD (Geometric Model): LOD 500** — Field verified representation from the As Constructed survey,
> accurate quantities, size, shape, location and orientation.
>
> **LOI (Attribute data):** All required attributes have been applied to the objects in the models and
> displayed on a dedicated property set for either Project, Design, Asset Management, or Construction
> attributes.

EIR §9.4 defines both terms — LOD is *"level of geometric model detail"*, LOI is *"level of attribute
data information"*. EIR §9.4 also warns that *"the MPDT should be the governing guidance for model
production and the EIR should act to inform the MPDT"*, so a per-project Model Production Delivery
Table can override this table. EIR §9.3 adds that the information must *"provide geometric
information that clearly defines the model object's location in real world coordinates"* and
*"provide sufficient inventory information, i.e. property sets, to identify the object for inclusion
in the department's asset classification systems."*

**Honest read of "LOD 500":** it is a *survey-verification* claim about accuracy, not a demand for
polygon count. A chainage-bounded footprint prism carrying surveyed coordinates and the surveyor's
registration satisfies "field verified representation … accurate size, shape, location and
orientation" better than a detailed-but-unverified mesh. Defensible, but an interpretation — see §6.

### 1.7 Model validation for exchange — EIR §9.2

> The lead appointed party must have in place suitable procedures for model data validation for both
> issuing and receiving building information modelling data.
>
> Procedures for model data validation […] must include:
>
> - model transmittal documentation that provides an audit trail of the sharing of models between parties
> - a model file register of each of the discipline models delivered at each submission
> - **model validation documentation that demonstrates the validation of the contents of the model
>   against a pre-determined schedule of model objects and attributes**, and
> - records that demonstrate usage of the procedures.
>
> The lead appointed party shall ensure the integrity of any file transfer prior to the final
> delivery. **Objects within the models must be tagged and adequately attributed to comply with the
> appropriate level of development.**

Plus EIR §9 (p.24): *"At each submission the lead appointed party must provide a **model file
register** that outlines the names of the models delivered, complying with the Transport and Main
Roads file naming convention, and the model objects that they contain."* EIR §8.7 requires governance
over model identification, formats, and "model segregation and validation for exchange".

**This is a product feature, not just a CI concern** — the orchestrator's note flagged this and it is
right. TMR requires *documentation demonstrating validation against a pre-determined schedule of
objects and attributes*. An export that emits the IFC **plus** a machine-generated validation report
and model file register satisfies a contractual clause most contractors satisfy by hand. §5.2 names
the standard that is literally shaped like that clause.

### 1.8 File naming convention — EIR §8.3 Table 8.3 (identical to Guideline §6.3)

Ten fields, in order:

| Field | Chars | Description (verbatim, abridged) |
|---|---|---|
| Project ID | 7–11 | "The project identifier the information container relates to, e.g. IPMWR2D, CN19520." |
| Originator | 3 | "The party responsible for producing the information container […] e.g. TMR, DJV, CJV." |
| Location | 2 | "The spatial aspect of the project the information container relates to." |
| Area | 2 | "Additional spatial aspect […] **default 00**." |
| Discipline | 2 | "The (technical) branch of the industry […] civil engineer, structural engineer, drainage engineer, surveying." |
| Category | 2 | "The functional aspect of the project […]" |
| Type | 3 | "The type of information contained […] model, drawing, general correspondence, report." |
| Sub-Type | 2 | "The sub-type of information […] pavement model, site plan, technical note." |
| Sequential Number | 4 | "A sequential / grouped number to make the ID unique […]" |
| Revision Number | 2–5 | "e.g. PO1.1, PO2 (pre-contractual revision) in WIP or Shared state, **CO1, CO2 (contractual revision) in Published state**." |

EIR §8.3 grants explicit flexibility:

> The structure of the file naming convention published on the Transport and Main Roads website must
> be adhered to, however, due to the complexity of the many different project types, **flexibility may
> be applied to the field codes** under each heading to suit project-specific requirements.
> Proponents may use the codes provided but may also **add additional codes** where necessary.

**The separator character and the published code lists are not in either document** — they live in the
separate *TMR BIM File Naming Convention* publication (EIR §4) and in Figure 8.3, an image the text
extract does not carry. Make field values configurable per project; do not hardcode. The spike's
`LOT-042-as-constructed.ifc` is a placeholder name, not a compliant one.

### 1.9 Everything the EIR requires that is NOT the IFC file

Bounds scope, and shows where CIVOS should *not* build:

- **CDE is InEight, mandated.** EIR §9.4(a)(ii): *"The Transport and Main Roads CDE, InEight, shall be
  used for any formal transmittal of contract documentation, including digital models, to the
  department at defined submission gates."* CIVOS produces the file; InEight transmits it. Do not
  build a transmittal portal.
- **BEP, MPDT, MIDP, TIDP, Model Object Attributes Matrix, BIM Risk Register, Capability Statement**
  (EIR §5) — documents by the lead appointed party.
- **Clash detection report** (EIR §9) — a federated-model activity, not per-lot.
- **12D ASCII as-constructed models** (§9.1.2) — surveyor deliverable.
- **Native file format alongside IFC** (EIR §9) — applies to discipline models from authoring tools.
  A per-lot as-constructed export arguably has no "native" format; CIVOS *is* the authoring tool.
  Worth a BEP note.

### 1.10 What the sources do NOT say

- **Neither document names a single `Ifc*` entity class.** Zero occurrences of
  `IfcBuildingElementProxy`, `IfcSite`, `IfcProject` or any other entity name. TMR governs civil road
  objects **by property set and unique object code, not by IFC class.**
- Neither mentions an MVD, Coordination View, IDS, or a named validator.
- Neither specifies file size limits, one-lot-per-file vs many-lots-per-file, or a geometry
  representation type.
- `Line Marking (RF LM)` is explicitly **"To be defined"** by TMR.

---

## 2. Options

### 2.1 Comparison

| Option | License | IFC2x3 **write** maturity | Deploy footprint | Risk |
|---|---|---|---|---|
| **Hand-rolled STEP writer** *(the spike)* | ours | **Proven here.** 170 LOC → 54-line valid file; **[RAN IT]** independently re-verified: `simple_spf` → `Valid` exit 0, `validate --rules` → `No validation issues found.` exit 0 | **0 bytes, 0 deps** | Every future entity type is manual attribute-order work. Four silent-failure modes (§3.6) — **all four already handled in the spike**. Schema-valid ≠ CV2.0-conformant (§5.2) |
| **web-ifc** (ThatOpen) | **MPL-2.0** ([LICENSE.md](https://github.com/ThatOpen/engine_web-ifc/blob/main/LICENSE.md), npm agrees) — file-level copyleft, safe for closed-source SaaS | **Real and CI-covered upstream.** IFC2X3 is a separately generated entity set (schema index 1), not an IFC4 alias; the maintainers' Jest suite creates IFC2X3 from scratch. **[RAN IT]** — authored a valid IFC2X3 file with psets + relationships + auto GUIDs first attempt | **~24 MB**, 14 files, **zero runtime deps**, no new language runtime | 0.0.x; write path thinly documented (no authoring example in `examples/`); historical type-marshalling bugs that fail **silently**, historically worse in 2x3 than IFC4; emits descending expressID order; **does no validation whatsoever** |
| **IfcOpenShell** (Python sidecar) | **LGPL-3.0-or-later** (`COPYING.LESSER`; PyPI classifier confirms). Bundled OCCT is LGPL-2.1 + linking exception. Separate-process invocation avoids forming a Combined Work | **Best in class**, and the only option that also validates. IFC2X3 is a first-class target with explicit branches in ~40 API files | **~240 MB** site-packages + Python runtime; wheel 41.7 MB → 174 MB unpacked (the `.so` is 148 MB — OCCT statically linked). ~+300 MB on the image | Two runtimes. **`manylinux_2_31` = glibc ≥ 2.31 → no musl wheel, will not install on Alpine.** Open PR [#9166](https://github.com/IfcOpenShell/IfcOpenShell/pull/9166): **125 divergent (entity, attribute) pairs across 82 entities** where the API writes schema-invalid IFC2X3, only 10 fixed — none in our entity set |
| `@ifc-lite/export` | MPL-2.0 | Genuine 2x3 downgrade via `exportToStep(store,{schema:'IFC2X3'})` | small | Single-vendor (LTplus-AG), sub-1.0, ~2,061 weekly downloads vs web-ifc's 131,963. **Sibling `@ifc-lite/create`'s IFC2X3 mode is a header relabel only — the body stays IFC4.** Avoid that trap |
| xBIM Toolkit (.NET sidecar) | **CDDL** ([docs.xbim.net/license](https://docs.xbim.net/license/license.html)) — permits closed-source commercial use | Reads *and writes* full IFC2x3 | .NET runtime image, heaviest | You would write the CLI yourself. No reason to prefer it in a Node shop |
| IfcPlusPlus | MIT | C++ reader/writer | n/a | **Maintainers say the repo is "more or less archived" and recommend web-ifc instead** ([OSArch](https://wiki.osarch.org/index.php?title=IfcPlusPlus)). Dead |
| Everything else on npm | — | — | — | **`ifcjs` on npm is name-squatted by an Infinite Flight simulator client.** `stpifc`/`stpstp` are **AGPL-3.0** (hard blocker). `@step-nc/p21-writer` has 0 downloads, no repo. `stepts` writes AP203 for PCBs, not IFC. `web-ifc-three` abandoned since Jan 2024. `@thatopen/components` had `saveToIfc()` in v2, **deleted in v3** |

### 2.2 web-ifc — the failure modes that matter (if it is ever adopted)

From the closed-issue history; every one fails *silently*:

1. **Never pass raw JS primitives.** Wrap in `IfcLabel`/`IfcReal`/`IfcLengthMeasure`/`IfcIdentifier`.
   Raw values emit `*` or `[object Object]`. Historically worse in IFC2X3 —
   [#462](https://github.com/ThatOpen/engine_web-ifc/issues/462) produced `IFCDIRECTION((*,*,*,*))`
   in IFC2X3 while *"IFC4 and 4X3 work fine"*. Also [#388](https://github.com/ThatOpen/engine_web-ifc/issues/388),
   [#528](https://github.com/ThatOpen/engine_web-ifc/issues/528).
2. **Relationships take entity instances or `Handle`, never expressID numbers** —
   [#1227](https://github.com/ThatOpen/engine_web-ifc/issues/1227) emitted
   `IFCRELAGGREGATES(...,1.,(2.))` instead of `...,#1,(#2)`; hierarchy invisible in every viewer.
3. **Never reuse a mutable array/object across entities** —
   [#503](https://github.com/ThatOpen/engine_web-ifc/issues/503); `WriteLine` mutates in place.
4. **Always `CloseModel`** in loops or you hit a WASM abort —
   [#1474](https://github.com/ThatOpen/engine_web-ifc/issues/1474).
5. **Values containing `'` do not survive a write-read-write round trip** —
   [#636](https://github.com/ThatOpen/engine_web-ifc/issues/636), closed as effectively wontfix.
   Relevant: `O'Brien Road`.

Of 83 open issues, **zero** concern the write path. Cadence was ~monthly to 0.0.77 (2026-03-06), then
a 5-month npm gap; 0.0.78 is blocked on [#2019](https://github.com/ThatOpen/engine_web-ifc/issues/2019).
Repo alive (`pushed_at` 2026-08-03). Pin the version.

---

## 3. Minimal IFC 2x3 entity list for a per-lot export

~19 entity types. Attribute orders read from `IFC2X3_TC1.exp` (official TC1 longform schema, "Issue
date: July 10, 2007"). This matches the spike's 18 plus `IfcBuilding`/`IfcBuildingStorey` (§3.2).

### 3.1 Header (3 lines, not entities)

| Line | Purpose |
|---|---|
| `FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1')` | Declares the MVD. Machine-checked — §3.6 / §5.2. |
| `FILE_NAME(name, ISO-8601 ts, (author), (org), preproc, orig_system, authorization)` | Provenance. `originating_system` is regex-checked as `Company - Application - Version`. |
| `FILE_SCHEMA(('IFC2X3'))` | The schema declaration. |

### 3.2 Project skeleton (~14 lines, once per file)

| Entity | Purpose |
|---|---|
| `IfcPerson` | Who; `WR1` requires FamilyName **or** GivenName. |
| `IfcOrganization` | Originator org; `Name` required. |
| `IfcPersonAndOrganization` | Binds the two for OwnerHistory. |
| `IfcApplication` | Identifies CIVOS as producer; 4 required attributes, 2 UNIQUE rules. |
| `IfcOwnerHistory` | **Mandatory in 2x3.** Emit one, reference from every `IfcRoot`. `CreationDate` is Unix epoch **integer**. |
| `IfcProject` | Single root; global rule `IfcSingleProjectInstance` caps it at one. `WR31` makes `Name` required despite `IfcRoot` marking it optional. |
| `IfcUnitAssignment` | Required in 2x3 (optional from IFC4). |
| `IfcSIUnit` ×3 | LENGTH/AREA/VOLUME — **`.METRE.` with `$` prefix** per EIR §8.2. `Dimensions` is DERIVE → `*`. |
| `IfcSIUnit` (PLANEANGLEUNIT `.RADIAN.`) | Angle base unit. Skip the degree `IfcConversionBasedUnit` unless asked. |
| `IfcGeometricRepresentationContext` | 3D world context. **`ContextType` must be `'Model'`** — §3.6. |
| `IfcGeometricRepresentationSubContext` | `('Body','Model',*,*,*,*,#ctx,$,.MODEL_VIEW.,$)`. Four inherited attributes are DERIVE → all `*`. Optional in 2x3; every real exporter emits it. |
| `IfcSite` | Project site; carries `RefLatitude`/`RefLongitude`/`RefElevation` as the 2x3 georeference. |
| **`IfcBuilding`** | **Required by Coordination View agreement #CV-2x3-142**, not by the schema. **Missing from the spike** — §5.2. |
| **`IfcBuildingStorey`** | Not required by any agreement, but Revit's importer may need it and every storey-keyed model tree does. 1 line. |
| `IfcRelAggregates` ×3 | Project→Site, Site→Building, Building→Storey. **Not optional** — `IfcSpatialStructureElement.WR41` makes a dangling `IfcSite` a schema *error*. |

### 3.3 Per lot object (~7 lines + geometry)

| Entity | Purpose |
|---|---|
| `IfcBuildingElementProxy` | The lot object; `Name` = lot number. IFC2x3 has no civil entities; proxy is the documented fallback and **is what TMR's own Revit pack emits** (§3.5.1). |
| `IfcLocalPlacement` | Positions the object; chains to the storey's placement. |
| `IfcAxis2Placement3D` + `IfcCartesianPoint` | Placement origin. `Axis`/`RefDirection` are all-or-nothing (`WR5`). |
| `IfcRelContainedInSpatialStructure` | Puts the proxy in the storey. `IfcElement.ContainedInStructure` is `SET[0:1]` — exactly one container. |
| `IfcProductDefinitionShape` | Wraps the representation. `INVERSE ShapeOfProduct : SET[1:1]` — **cannot be shared between two proxies**; one per object. |
| `IfcShapeRepresentation` | `(#subctx,'Body','SweptSolid',(#solid))`. `WR23` makes `RepresentationType` mandatory; `WR24` type-checks the items. |

### 3.4 Geometry — chainage-bounded footprint prism (~10 lines)

| Entity | Purpose |
|---|---|
| `IfcExtrudedAreaSolid` | `(SweptArea, Position, ExtrudedDirection, Depth)`. `Depth` > 0; `WR31` — extrusion must not be perpendicular to local Z. |
| `IfcArbitraryClosedProfileDef` | `(.AREA., $, #polyline)`. `ProfileType` must be `.AREA.` (`IfcSweptAreaSolid.WR22`). |
| `IfcPolyline` | The footprint. **Close by repeating the first `IfcCartesianPoint` instance by reference** — §3.6. |
| `IfcCartesianPoint` ×n | 2D profile points. `WR1: HIINDEX >= 2` — 2D or 3D only. |
| `IfcAxis2Placement3D` + `IfcCartesianPoint` | Extrusion position. |
| `IfcDirection` | `((0.,0.,1.))` extrusion vector. |

### 3.5 Property sets — 4 per object (~4 + n lines)

| Entity | Purpose |
|---|---|
| `IfcPropertySet` ×4 | Named exactly **`Project`**, **`Design`**, **`Construction`**, **`Asset Management`** per Guideline §6.4.1. This is what renders as EIR §8.6's "separate tabs". |
| `IfcPropertySingleValue` ×n | One per attribute. `NominalValue` is an `IfcValue` SELECT → **typed parameter**: `IFCLABEL('LOT-042')`, `IFCTEXT('...')`, `IFCREAL(0.15)`, `IFCINTEGER(3)`, `IFCIDENTIFIER('...')` — uppercase keyword, value in parens (ISO 10303-21 cl. 12.1.8). |
| `IfcRelDefinesByProperties` ×4 | Attaches each pset. **IFC2x3 attribute order: `RelatedObjects` (a SET) then `RelatingPropertyDefinition`.** |

### 3.5.1 Why `IfcBuildingElementProxy` is right — and it is TMR's own answer

The biggest open design question, settled by a TMR primary source. The **TMR Revit-to-IFC Export Pack
V6.0** was retrieved
([landing page](https://www.tmr.qld.gov.au/business-industry/road-systems-and-engineering/software/transport-and-main-roads-revit-to-ifc-export-pack);
Cloudflare-blocked to automation, retrieved via Wayback; zip + how-to PDF are in this session's
scratchpad). Its `TMR IFC Export Layers.txt` (478 lines) maps, verbatim:

```
Roads          →  IfcBuildingElementProxy
Topography     →  IfcBuildingElementProxy
Parking        →  IfcBuildingElementProxy
Generic Models →  IfcBuildingElementProxy / IfcBuildingElementProxyType
Site           →  IfcSite
```

`IfcBuildingElementProxy` is the **second most frequent class in TMR's own mapping file** (64
occurrences). The *BIM for Bridges Manual* (Sept 2025) publishes the explicit IFC4.3→2x3 downgrade
table, with Miscellaneous → `IfcBuildingElementProxy`.

Corroborating: Civil 3D requires conversion to 3D solids before IFC export, after which objects land
under `IfcBuildingElementProxy`
([Autodesk help](https://help.autodesk.com/cloudhelp/2027/ENG/Civil3D-UserGuide/files/GUID-C5C9DEEE-2C46-4094-B350-05829C1ED5DC.htm));
Revit's exporter treats proxy as the *unresolved* state in `GetExportTypeImpl`
([revit-ifc source](https://github.com/Autodesk/revit-ifc/blob/master/Source/Revit.IFC.Export/Utility/ExporterUtil.cs)).
IFC2x3's own spec says the proxy *"should be used to exchange special types of building elements for
which the current IFC Release does not yet provide a semantic definition"*.

**So proxy + property sets is not a compromise — it is the published Queensland convention**, and the
spike's choice of `IfcBuildingElementProxy` is confirmed correct. Scope limit: the TMR pack is
bridges/structures-only and Revit-specific; **there is no TMR-published IFC class mapping for road,
pavement, earthwork or drainage objects** — consistent with §1.10.

### 3.6 The four sharp edges — ranked by how silently they fail

All four are **already handled correctly in the spike** (verified); documented so they survive a rewrite.

1. **GUID encoding.** `IfcGloballyUniqueId = STRING(22) FIXED`. Alphabet is
   `0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$`
   ([buildingSMART IFC-GUID.md](https://github.com/buildingSMART/technical.buildingsmart.org/blob/main/IFC-GUID.md))
   — **digits first**, last two `_$`, not `+/`. Stock base64 produces a plausible-looking, wrong GUID.
   Chunking: byte 0 → 2 digits, then 5 groups of 3 bytes → 4 digits each; **the first character is
   therefore always `0`–`3`** (the validation service's PJS003 checks exactly this). Reference:
   [IfcOpenShell `guid.py`](https://github.com/IfcOpenShell/IfcOpenShell/blob/master/src/ifcopenshell-python/ifcopenshell/guid.py#L56).
   **[RAN IT]** — cross-checked classic chunking against IfcOpenShell over 20,000 random UUIDs, and
   round-tripped buildingSMART's six real Hello-Wall GUIDs (`scratchpad/guidcheck.py`).
2. **`*` vs `$`.** ISO 10303-21 cl. 12.2.6: an attribute redeclared DERIVE in a subtype is written
   `*`, not `$`. Bites `IfcSIUnit` (`Dimensions`) and `IfcGeometricRepresentationSubContext` (all four
   inherited geometric attributes). `IFCSIUNIT($,.LENGTHUNIT.,$,.METRE.)` is a schema error.
3. **`ContextType` must be `'Model'`.** IfcOpenShell's `addRepresentationsFromDefaultContexts()`
   accepts only `model`/`design`/`model view`/`detail view` — **anything else and geometry is silently
   skipped with no error.** Gherkin GEM051 enforces the same.
4. **`IfcOwnerHistory` is non-optional in IFC2X3.** `IfcRoot.OwnerHistory : IfcOwnerHistory`, no
   `OPTIONAL`; it became optional only in IFC4. `$` in slot 2 is a schema error. The single biggest
   2x3-vs-IFC4 divergence, and it bites every sample copied from IFC4 tutorials. **[RAN IT]** — the
   official IfcOpenShell "simple model from scratch" doc example, run verbatim against IFC2X3, dies
   with `Exception: Please create a user to continue.`

Three lesser ones:
- **`IfcProject.RepresentationContexts` must reference the parent context only, never a subcontext**
  (`WR32`) — and is **mandatory in 2x3** even for a geometry-free model. **[RAN IT]** — identical code
  produces a valid IFC4 file and an *invalid* IFC2X3 file without it.
- **Close polylines by reference, not by coordinates.** Gherkin GEM111 (implementer agreement applying
  to IFC2X3): first and last point *"must be identical by reference (referencing the same instance),
  not just having the same coordinates."* buildingSMART's own Hello Wall example emits
  duplicate-coordinate points and **would now fail this rule** — do not copy it.
- **STEP string escaping.** Escape `\` → `\\` **first**, then `'` → `''` (reversing the order
  double-escapes). Non-ASCII → `\X2\<UTF-16BE hex>\X0\`. Reals need a decimal point (`2.` valid, `1`
  not). Matters for `O'Brien Road` and Windows paths in `FILE_NAME`.

---

## 4. Recommendation

### Keep the hand-rolled STEP writer. Fix its content, not its architecture.

The orchestrator's call was right, and this research strengthens rather than overturns it. I went into
this expecting to recommend web-ifc; the spike changed my mind, and here is the honest reasoning.

**What the spike proves.** 170 LOC of dependency-free Node produces a 54-line IFC2X3 file that passes
`ifcopenshell.validate --rules` with **zero issues** — independently re-run by me (**[RAN IT]**, §5.1),
not taken on trust. All four §3.6 sharp edges are handled: correct GUID alphabet, `*` in the
`IfcSIUnit` derived slot, mandatory `IfcOwnerHistory`, metre units per EIR §8.2. That is the entire
risk premium a library was going to buy us, already paid, in 170 lines.

**The honest buy-vs-build split.** The work is roughly 20% emitting syntactically correct STEP, 20%
knowing which entities to emit, **50% the TMR domain mapping** (which CIVOS field becomes which
attribute in which of four psets, chainage → footprint geometry, unique object codes), and 10% proving
validity. **No library touches the 50%.** web-ifc buys exactly the first 20% — and the spike
demonstrates that 20% costs 170 lines we have already written and validated. Adding 24 MB of WASM and
a 0.0.x dependency to re-buy something already working, whose known failure mode is *silent* value
corruption in IFC2X3 specifically (§2.2), is a bad trade.

**Where a library would win, and why it does not here.** web-ifc derives attribute order for 100+
entity types from the `.exp` schema — real insurance if the entity set grows a lot. But our set is
~19 and closed (§3), and growth is toward *more property sets on the same proxy*, which is the part
hand-rolling handles most easily. If the set ever genuinely explodes — real drainage networks,
multiple geometry representations — revisit. That is a re-evaluation trigger, not a reason to
pre-pay now.

**IfcOpenShell stays in CI only.** +300 MB and a second language runtime on Railway to emit a few
hundred STEP lines is unjustifiable, and the 148 MB `.so` is statically-linked OpenCASCADE — a full
B-rep kernel we would use for nothing. It is the best authoring library in the world at *hard*
geometry; our geometry is a prism. As a validator it is superb and free, and it belongs on GitHub
Actions where the wheels install in 15–30 s.

### The three corrections the spike needs — all content, none architectural

1. **Emit TMR's four property sets, not one** (§1.3). Replace the single `CIVOS_AsConstructed` with
   `Project`, `Design`, `Construction`, `Asset Management`, using TMR's attribute spellings —
   `ConstructionLotNumber` not `LotNumber`, `ConstructionDate`, `UniqueObjectCode`, `ControlLine`,
   `StartCHG`/`EndCHG`, `Datum`, `Zone`, `ModelCertifiedAsConstructedSurveyor`. Keep the CIVOS
   evidence fields (`ITPCompletion`, `TestReferences`, `NCRReferences`) in a fifth CIVOS-named set —
   genuinely additive, and EIR §8.6's escape hatch covers them **if the BEP schedules them**. This is
   the difference between a file that validates and a file that *complies*.
2. **Add `IfcBuilding` + `IfcBuildingStorey`** with their two `IfcRelAggregates` (§3.2). The spike has
   neither (verified by grep). The file declares `ViewDefinition [CoordinationView_V2.0]` in its
   header, which activates implementer agreement **#CV-2x3-142** requiring at least one `IfcBuilding`
   — and there is no way out: declaring a different MVD fails the header allowlist instead (§5.2).
   Four lines.
3. **Move georeference into the `Project` pset** (§1.5). `Datum` = `GDA2020` and `Zone` = `56` as
   properties, not free text in the site description. IFC2x3 has no `IfcMapConversion`; the pset *is*
   the georeference mechanism, which is why TMR put them there.

Then make the file name configurable against EIR §8.3's ten fields (§1.8) rather than
`LOT-042-as-constructed.ifc`.

### The product finding that outranks the technical one

TMR governs civil road objects **by property set, not by IFC class** (§1.10); the four pset names are
published (§1.3); and `ConstructionLotNumber`'s documented source value is verbatim *"To Contractors
QA system"* — which is CIVOS. Match TMR's four pset names and spellings exactly and CIVOS
interoperates with the Queensland state standard for free. Combined with EIR §9.2's demand for *model
validation documentation* — which most contractors satisfy by hand — the export plus an
auto-generated validation report and model file register is a contractual-clause-shaped feature that
falls out of the same data structure that writes the file.

---

## 5. Validation strategy

### 5.1 The gate

```bash
pip install ifcopenshell ifctester pytest
python -m ifcopenshell.simple_spf  fixtures/export.ifc                 # STEP syntax
python -m ifcopenshell.validate    fixtures/export.ifc --rules --json  # schema + EXPRESS WHERE rules
```

Both exit non-zero on failure — no wrapper needed. **[RAN IT]**, against the spike's own output:

```
$ python -m ifcopenshell.simple_spf  ifc-spike/LOT-042-as-constructed.ifc
Valid
simple_spf exit=0
$ python -m ifcopenshell.validate    ifc-spike/LOT-042-as-constructed.ifc --rules
No validation issues found.
validate --rules exit=0
```

1.4 s on a small file, fully offline, free, no account. `validate` checks header validity,
non-abstract entities, attribute types, inverse cardinality, GlobalId uniqueness **and base64
format**, `IfcApplication` uniqueness, plus EXPRESS WHERE rules with `--rules`
([docs](https://docs.ifcopenshell.org/ifcopenshell-python/validation.html)). IFC2X3 WHERE rules are
implemented (`express/rules/IFC2X3.py`) and **[RAN IT]** confirmed `IfcAxis2Placement3D.WR5` fires on
a 2x3 file. It also caught a genuine hand-writing mistake in a separate test file — an
`IfcAxis2Placement3D` placed directly in `IfcSite.ObjectPlacement` instead of wrapped in
`IfcLocalPlacement` — exactly the bug class this gate exists to catch.

**Three gotchas, all found by running it, none documented:**

1. **`--rules` silently requires `pytest`.** `rule_executor.py` does `from _pytest import assertion`,
   but pytest is **not a declared dependency**. Without it you get
   `Unhandled exception: No module named '_pytest'` and a **non-1 exit code** that reads as a crash,
   not a validation failure. Install it explicitly.
2. **`ifctester`'s CLI ALWAYS exits 0, even on FAIL.** **[RAN IT]** — a failing spec printed
   `[FAIL] (0/1)` and returned `EXIT=0`; `ifctester/__main__.py` contains **no `sys.exit` call at
   all**. A naive `python -m ifctester ...` CI step is a **silently-passing no-op gate**. Use the
   Python API and inspect `specs.specifications[*].status`, or emit `-r Json` and check it yourself.
3. **`validate` does not catch syntax errors** — duplicate numeric identifiers, invalid entity names.
   That is `simple_spf`'s job, which is why it runs first.

### 5.2 The gap this gate cannot see — and why it matters right now

**`ifcopenshell.validate` checks the schema and its EXPRESS WHERE rules. It does not check
Coordination View implementer agreements.** That is why the spike passes with zero issues while
missing the `IfcBuilding` that #CV-2x3-142 requires.

The trap is specific and inescapable. The buildingSMART validation service's Gherkin rule **SPS001**
is gated on the MVD string:

```gherkin
Background:
    Given A file with Model View Definition 'CoordinationView_V2.0'
    Given A file with Schema 'IFC2X3'
Scenario: Agreement142(1) — Then There must be at least 1 instance(s) of .IfcBuilding.
```

Declaring `CoordinationView_V2.0` — which the spike's header does, and which is **the only IFC2X3
value on the service's header allowlist**
([valid_descriptions.yaml](https://raw.githubusercontent.com/buildingSMART/validate/main/backend/apps/ifc_validation/checks/header_policy/valid_descriptions.yaml))
— activates SPS001, which then errors on the missing `IfcBuilding`. Declaring a different MVD fails
the header check instead. **Schema-valid is not the same as conformant**, and the two-command gate in
§5.1 cannot tell you the difference. Fix per §4 correction 2; then consider running
[ifc-gherkin-rules](https://github.com/buildingSMART/ifc-gherkin-rules) (MIT, Python + `behave`,
has `__main__.py`) locally to cover implementer agreements offline.

### 5.3 IDS — where TMR's "pre-determined schedule of model objects and attributes" lands

EIR §9.2 requires *"model validation documentation that demonstrates the validation of the contents of
the model against a pre-determined schedule of model objects and attributes."* **IDS is literally that
document, machine-checkable.** IDS v1.0 was approved as a Final Standard on 2024-06-04
([announcement](https://www.buildingsmart.org/information-delivery-specification-ids-v1-0-is-approved-as-a-final-standard/)),
and `ifcVersion` is a required attribute enumerating exactly `IFC2X3`/`IFC4`/`IFC4X3_ADD2` — verified
in the bundled XSD **[RAN IT]**, along with an IFC2X3 IDS validating an IFC2X3 file to `[PASS] (1/1)`.

Write a CIVOS IDS asserting: every `IfcBuildingElementProxy` carries psets `Project`, `Design`,
`Construction`, `Asset Management`; `Construction` carries `ConstructionLotNumber` and
`ConstructionDate`; `Project` carries `Datum` = `GDA2020` and `ModelCertifiedAsConstructedSurveyor`.
**That IDS would have caught the §4 correction 1 defect immediately** — it is the machine-checkable
form of §1.3. Ship it *with* the deliverable and EIR §9.2 is satisfied by an artifact rather than a
narrative. Mind gotcha 2 above when gating CI on it.

### 5.4 buildingSMART Validation Service — manual/nightly, not a blocking gate

**IFC2X3 is supported** — the user guide lists exactly three schemas: `IFC2X3`, `IFC4`, `IFC4X3_ADD2`
([user guide](https://buildingsmart.github.io/validate/user/index.html)). It checks STEP syntax, IFC
schema, Normative Checks (Implementer Agreements + Informal Propositions as Gherkin — i.e. the §5.2
gap), and Industry Practices; bSDD checks are *"temporarily disabled as of v0.6.6"*. A public API
exists (`POST /validationrequest`, Swagger at `/api/v1/swagger-ui`); **[RAN IT]** — production
`https://validate.buildingsmart.org/api/v1/validationrequest` returns HTTP 401, so it is live and
auth-gated. Tokens come *by emailing validate@buildingsmart.org*.

Unsuitable as a blocking gate: human-mediated token acquisition, network dependency, async job model,
third-party availability. Use it as a **manual conformance check before first client delivery** — and
read the ToS first (§6). The service is MIT and self-hostable
([buildingSMART/validate](https://github.com/buildingSMART/validate)) if it becomes load-bearing.

### 5.5 The runnable check to leave behind

The spike already has one — `verify-web-ifc.mjs` re-opens the generated file and asserts schema, proxy
count, name, mesh count and every pset value. Keep that pattern and extend the assertions to the four
TMR pset names once §4 correction 1 lands. **[RAN IT]** — it passes (`meshes: 1 | vertices: 34`).

**The critical caveat, proven by execution:** fed a file that IfcOpenShell rejects, web-ifc parsed it
happily and returned `CompositionType: {"type":3,"value":"NOTAREALENUM"}`. **web-ifc performs no
schema validation whatsoever.** A round-trip proves *"my writer emitted what I intended and it is
parseable"*. It does **not** prove *"this is valid IFC2X3."* Round-trip for semantic intent,
IfcOpenShell for schema conformance, gherkin rules for conformance to the declared MVD. All three, or
each alone tells you less than it appears to.

---

## 6. Unverified — read before acting

**TMR sources**
1. **The file naming separator and published field code lists.** EIR §8.3 / Guideline §6.3 give field
   names, lengths and descriptions, but the separator and code tables live in Figure 8.3 (an image
   absent from the text extract) and the separate *TMR BIM File Naming Convention* publication. Make
   field values configurable; do not hardcode.
2. **The `civil discipline specific object attribute files`** referenced by EIR §8.6 and §9.3 as the
   *normative* definition of the property sets. We have the Guideline §6.4.1 tables, which the
   Guideline itself calls *"not considered to be a comprehensive list at this stage"*. The
   authoritative per-discipline files on the TMR website have not been retrieved. **This is the top
   follow-up** — it is the source of truth for §4 correction 1.
3. **Figures 8.5 and 8.6** (key file formats; example TMR attribute property sets) are images; only
   captions survive in the extract. Figure 8.6 would confirm the pset tab rendering directly.
4. **"LOD 500 is satisfied by a chainage-bounded footprint prism"** is my interpretation of EIR §9.4,
   not a TMR statement. Defensible — LOD 500 is a survey-verification claim, not a polygon-count claim
   — but it is the one interpretation here a TMR BIM Reviewer could reasonably contest. Confirm in a
   BEP before building.
5. **Current version of the TMR Revit-to-IFC Export Pack.** We have V6.0 from a 2022 Wayback snapshot;
   tmr.qld.gov.au blocks automation. Worth opening the landing page in real Chrome to check for V7+.
6. **`Line Marking (RF LM)` is "To be defined"** by TMR itself — not our gap.
7. **Whether TMR expects one lot per file or many.** §9.1.2 says "completed construction lots"
   (plural); packaging is unstated. A BEP-level decision.

**Technical**
8. **No generated file has been through a real validator service or viewer.** Not buildingSMART's
   service, not Solibri, not Revit, not Navisworks. IfcOpenShell schema validation is genuinely
   passed (§5.1) but that is a strictly weaker claim than conformance (§5.2).
9. **The spike ran on Windows + Node 22**, not Linux/Docker. It is dependency-free so the risk is low,
   but confirm on Railway.
10. **Profile winding direction (CW vs CCW).** No normative rule found anywhere in the IFC2X3 schema
    or docs. CCW is convention only.
11. **Revit's import behaviour with non-storey containment.** OSArch's 2021 test (*"mandatory for
    Revit … else an empty file will be created"*) and the current `revit-ifc` source flatly
    contradict each other. Mitigated by emitting the storey anyway (§4 correction 2).
12. **Navisworks, BIMcollab ZOOM, usBIM.viewer+** — no published evidence either way on
    site-contained elements. Mitigated the same way.
13. **buildingSMART Validation Service Terms of Service full text** — the ToS page 404s/403s. The
    256 MB limit and 90/180-day retention are documented; **whether automated/CI submission is
    permitted is not.** Read it before wiring the API into anything automated.
14. **IfcCheckingTool** (KIT Karlsruhe) exists and covers *"IFC schema versions from IFC2X3 onwards"*
    ([KIT page](https://www.iai.kit.edu/english/1266_2991.php)), but license, cost, platform, CLI
    availability and version are stated nowhere. Reads as GUI. Not CI-viable without more work.
15. **Solibri / Navisworks / BIMcollab headless or CLI automation** — no primary vendor documentation
    found; only third-party comparison articles. Treat as desktop-only.
16. **Docker image size delta for the IfcOpenShell option (~+300 MB)** is derived, not measured — the
    Docker daemon was unavailable. Site-packages (~240 MB) and wheel sizes (41.7 MB) *were* measured.
17. **Autodesk's stock Revit `exportlayers-ifc-IAI.txt`** ships inside the installer and is not
    published; the lines quoted in §3.5.1 are from **TMR's edited copy**, which is what matters here.
18. **The Autodesk Civil-3D-proxy support article** URL 403s/404s; wording is from a search extract —
    near-verbatim, not certified. The Autodesk help page on 3D-solid conversion is directly verified.
19. **web-ifc emits lines in descending expressID order.** Spec-legal (STEP mandates no ordering) but
    unlike every other exporter. No evidence either way on third-party parser tolerance. Moot unless
    web-ifc is adopted for writing.
20. **`ifcopenshell.api` writes schema-invalid IFC2X3 for 125 (entity, attribute) pairs across 82
    entities** per open PR [#9166](https://github.com/IfcOpenShell/IfcOpenShell/pull/9166) (10 fixed,
    still open). None are in our entity set — affected classes are cost/schedule/structural/stair/
    ramp/space. Only relevant if IfcOpenShell is ever promoted from CI to production.
