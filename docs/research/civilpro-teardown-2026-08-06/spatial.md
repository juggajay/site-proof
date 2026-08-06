# CivilPro Spatial & Plans — competitive analysis

Sources: KB bundle `bundles/spatial.md` (14 articles, sections "Plans" [web] and "Plans (D)" [desktop], updated 2026-03 → 2026-07); "CivilPro Spatial — Introductory Webinar" transcript (`UTFlDT1Xd50.txt`, Locky = product manager, Dennis = founder/lead dev); "Importing Geo-Referenced Imagery (Image Layers)" video transcript (`qf9nwqpKHCI.txt`).

Release date: the Spatial module shipped with a database upgrade on **10 March 2026** (webinar recorded the day before — "tomorrow morning"). Shipped simultaneously in CivilPro Web and CivilPro Desktop (two separate clients, near-identical feature set, separate doc trees).

---

## 1. Feature inventory

### 1.1 Coordinate Systems register (`QA Setup > Coordinate Systems`)
- Project-level list of local CRSs. Populated via **"Load from Default"** — a bundled library of "typical Australian coordinate systems" (MGA zones on GDA94 / GDA2020). Webinar: user picks zone 54 once, done.
- Doc "Understanding Plan Projections and Coordinate Systems" is a full primer: MGA/UTM 6° zones, zone-by-state table (WA 50–51, NT 52–53, QLD/NSW/VIC/TAS 55–56), GDA94 vs GDA2020, ~7 cm/yr NE continental drift, WGS84 vs MGA94 discrepancy "up to 1.5 metres", and a worked **WKT** `PROJCS["GDA2020 / MGA zone 56", …]` example.
- Guidance is to read the CRS off the **drawing title block** or "just ask your Surveyor". CivilPro does not infer it.
- Internal transform target: the Image Layers video shows CivilPro consumes/presents imagery in **EPSG:3857 (WGS84 Pseudo-Mercator)**.

### 1.2 Control Lines (`QA Setup > Control Lines`)
- A Control Line = named alignment (e.g. MC02, MC30, MC40) with an ordered list of `chainage → coordinate` vertices. `Has Geometry` checkbox in the register flags whether coordinates exist.
- **Coordinate import** (right-click → Import Coordinates):
  - Coordinate Type: **Project Coordinates** (pick a local CRS from the Coordinate Systems register) or **GPS (WGS84)** (lat/long only).
  - Source: **Import from Clipboard** or **Import from CSV File**. Column headings auto-assign if labelled; otherwise right-click a column header to assign.
  - Expected columns: `Chainage`, `X`, `Y`. **The docs contradict themselves on ordering** — "New vs. previous" says `X (Northings or Lattitude), Y (Eastings or Longitude)`; "Importing and Registering Plans" says `X (Easting / Latitude), Y (Northing / Longitude)`. The webinar says "chainage, easting, and northing".
  - This is the headline improvement over the pre-March product: previously coordinates **had to be pre-transformed to lat/long** outside the app.
- **Getting the data in the first place** — official recommended method (both KB and webinar): screenshot the "Geometric Setout Details" sheet from the PDF drawings, paste into **ChatGPT or Gemini**, prompt `"Convert this table into CSV format"`, then copy to clipboard. Documented as *preferred* over PDF→Excel table export. Locky: "very accurate OCR", "do one table at a time".
- **Curve densification.** Because setout tables only give coordinates at TC/CT/IP/start/finish points, imported control lines render as chords — they "cut the corner" on curves, so chainage-derived lots plot wrong around bends. Fix is manual and post-hoc: register plans first, then Control Line → *View/Edit on Plan* → Select → Edit → drag white/green vertex handles onto the drawn curve; right-click a new point → **Add Chainage** to give it a chainage value (and you must remove the chainage before you can move that point again).
- Control Lines can alternatively be authored directly on a registered plan via **Define Control Line** in the Plan Markup view.

### 1.3 Plans register (`Spatial > Plans`)
- **A "Plan" = a whole multi-sheet drawing set in one file**, not a single sheet. Fields on create: Plan Name, Reference System (CRS), Plan Description (e.g. "IFC Issue 19/08/25"), Plan File (PDF or image).
- **Three registration paths** (`Configure Plan`):
  1. **Registration points by coordinate** — click a known point on the sheet, type X/Y.
  2. **Registration points by Control Line chainage** (documented as *preferred*, "faster") — click the point, choose `From Control Line Chainage`, pick control line + chainage; coordinates auto-populate from the imported control line.
  3. **GeoPDF auto-registration** — no registration points at all.
- Registration point count: **desktop doc says minimum 3**; **web doc (July revision) says minimum 2**; webinar says "three points is desirable", two-point registration was in flight ("if you've got a straight line and you put in three points, CivilPro will automatically take two of those"). Constraints: spread points across the sheet, **points cannot be co-linear**, zoom in hard before clicking (accuracy is a direct function of click precision — no RMS/residual feedback is described anywhere).
- **Set Perimeter** — per sheet, a hand-drawn polygon defining where annotations may be shown; used to keep lots off the title block and notes, and to trace along **join lines** so adjacent sheets don't overlap. **Required even for GeoPDFs.** Backspace removes last point; mid-point clicks add vertices; Select → Delete Selected to redo. Save per sheet, then Save and Close.
- Claimed manual registration cost: **"~30 seconds per sheet"** ("Requesting Geo-Referenced PDFs from your Designer").
- **Rasterise setting on import** exists as a performance option (mentioned in the GeoPDF article).
- Client-side caching: "the first time it downloads the drawing, it caches it locally and then going forward it should be faster" (webinar).

### 1.4 GeoPDF support
- Recognised encodings: **ISO 32000** and **OGC (OGC_BP)**.
- Design-software support matrix (their own article):

| Software | GeoPDF export | Mechanism |
|---|---|---|
| Bentley MicroStation / OpenRoads Designer | Yes | Attach GCS to model, set PDF print driver `Enable Georeferencing = On` |
| ArcGIS Pro | Yes | Tick "Export georeference information" on layout export |
| QGIS | Yes | Print layout PDFs geo-referenced by default; "Create Geospatial PDF" option |
| AutoCAD / Civil 3D / Map 3D | **No** | Must republish through QGIS/ArcGIS Pro or batch-convert with FME |
| 12d Model | Not documented | "Ask your 12d administrator" |

- They ship a **copy-paste email template** for requesting geo-referenced output from the Designer, plus two gotchas: **one plan view per sheet** (multi-viewport/detail-inset sheets may not position correctly), and **never flatten/re-print a GeoPDF** (strips the spatial data).
- Explicit positioning: "Treat geo-referenced PDFs as an optimisation worth asking for, not a requirement."
- Documented failure mode: sheet imports but sits in the wrong place → almost always a datum/zone mismatch (GDA94 export vs GDA2020 project).

### 1.5 Image Layers (geo-referenced raster imagery)
- Separate from Plans. Purpose: drone/aerial imagery, or construction drawings as raster, underlaid in the map viewer.
- Workflow is **entirely external** (the whole `qf9nwqpKHCI` video): snip/crop each drawing to PNG/JPEG → **QGIS** → Layer → Georeferencer → place ≥3 points typing eastings/northings from the setout table → set source CRS (e.g. GDA94 / MGA 54) → Transformation settings: type **Helmert**, target CRS **EPSG:3857 WGS84 Pseudo-Mercator**, output **"World file only"** → run → zip the image + world file together → CivilPro `Image Layers > Add Georeferenced Image`, drag the zip in.
- Per-layer **opacity** control (enable editing → edit icon); presenter recommends ~60% so drawings read well under lot markup.
- Presenter explicitly flags this as interim: "in the very near future, CivilPro will be doing a lot of the functionality that we've done in QGIS directly inside the platform" — which is what Plan registration became. Drone imagery still appears to need the QGIS route.
- Also acknowledged: "I can't guarantee that within your organization your IT will allow you to download and install this."

### 1.6 Lot spatial definition (Lot → **Spatial** tab, formerly "Chainage"/"Geometry" tab)
Two expandable sections:
- **Chainage Definitions** → `ADD CHAINAGE`: filter *Mapped Control Lines* vs *All Control Lines*; pick Control Line; **Shape** = Polygon / Line (Polyline) / Point; enter start chainage, finish chainage, and left/right offsets; optional custom Name; **Do Not Project / Do Not Map** checkbox. CivilPro then **auto-generates a 2D geometry** from the chainage definition.
  - Graceful degradation: if the selected control line has no coordinates, CivilPro auto-ticks *All Control Lines* + *Do Not Map/Project* so it doesn't attempt to place an unmappable lot. Pre-existing chainage-only workflows keep working unchanged.
- **Plan/Map Definitions** → `VIEW ON PLAN` (opens Lot Markup on a chosen registered Plan) or `VIEW ON MAP` (Google Maps viewer): Add → Polygon / Line / Point, click to trace, Backspace undoes last point, double-click or click the start point to close. Prompts for a geometry name (defaults to Lot Number).
- **Multiple named geometries per Lot** ("entity") — webinar example: three light posts + the conduit as separate geometries on one lot. Areas are **summed live** and shown bottom-right during markup.
- Edit by click → Edit → drag vertices; delete via Select → click → Delete Selected Shape.
- **Per-geometry Export button** in the markup window ("export geometries in various filetypes"); Dennis notes bulk export "may be more advantageous… from an API level".

### 1.7 Find (spatial search)
- In the Plan Markup / Snapshot view: **Find by Plan** (sketch a search area, close the loop) or **Find on Current Page** / Find by Page(s).
- Filters by entity type and attributes — demonstrated: all Subbase lots on this page; "find all of the subgrade lots that Thomas did"; find Photos in an area.
- Found entities land in the **Entities Register** panel; select entities → their geometries list in the **Geometries Register**.
- **Snapping** toggle: snap cursor to existing points, so a new lot can be drawn hard against an adjacent lot's boundary.
- Clean-up: select all → "remove selected entities from list".
- **Spatially searchable entity types today: Lots, Test Requests, Photos.** (Dennis, Q&A: "Right now you've got test requests, lots and photos.")

### 1.8 Plan Snapshots ("Lot Maps")
- A Snapshot is a **saved view**: the set of chosen entities + their styling + the underlying Plan (or Map) layer + the view extent at capture time, plus a **baked raster image** of the view window.
- Created from Lot Markup via **Save As New Snapshot** / Save Snapshot; named by the user.
- Per-entity checkboxes: **Is Visible** (drawn in the snapshot) and **Is Linked** (snapshot appears in that entity's **Related Items**). These are independent — you can show context lots without spamming their Related Items.
- Editing (`Show in Plan Editor` / `Show on Plan`): **Lock Snapshot** (prevents modification until unlocked), **Update Snapshot Image** (re-bakes the report raster), **Include Lot / Test Request / Photo / Control Line** (add specific records), **Properties** (colour, opacity, line thickness, font size) scoped **by geometry / by snapshot / by plan** — plan-scoped styling propagates everywhere that plan is opened.
- **Set as Report Default** → the snapshot becomes the Lot Map embedded in the **Lot Summary / Conformance report**.
- Deletion only via `Show in Snapshot Register` → delete; removes it from all linked entities. A snapshot link **blocks deletion of its Plan** until the user chooses transfer-or-delete.
- `Show on Map` re-renders the same snapshot over Google Maps.

### 1.9 Test Requests
- TR **Spatial** tab inherits the linked Lot's geometry automatically; can be refined in place (webinar: nudge the polygon to a single soft spot, or replace the geometry with a Point).
- On finalising a TR, a new prompt offers: **No Snapshot** / **Snapshot on Plan** / **Snapshot on Map** → the framed Lot Map is embedded in the **Test Request report sent to the testing subcontractor**, giving them the location context. Then the usual "notify the tester" prompt.
- `View on Plan` / `View on Map` available from the TR spatial tab.

### 1.10 Maps viewer (Google Maps)
- Shows the same lot geometries as a layer over Google Maps, because geometry is stored in world coordinates independent of any plan.
- Layer toggles: registered **Plans** on/off with brightness/darkness (opacity) control, **Image Layers** (aerials/drone) on/off, base map on/off.
- Registered sheets render as a continuous "long plot" along the alignment.
- Official guidance: **use Maps as a viewer, define lots on the Plans** ("we do encourage you to use the Google Maps interface as more of a viewer for accuracy").

### 1.11 Plan revisions ("Revising a Plan / Adding a New Revision")
- Old Plans are **never deleted or hidden** — traceability by design.
- Process: `Download Plan` → substitute updated sheets **offline in a PDF editor** → `Configure Plan > Plan Actions > Replace Image` → drag in the new file.
- **Hard requirements on the replacement:** *exactly the same number of sheets*, and *each sheet must match the location and scale of the sheet it replaces*. Registrations are then transferred automatically.
- Snapshot link policy chosen at replace time: **Do not modify snapshots** (stay on old plan) / **Copy snapshot links** (duplicate, new one points at the new plan) / **Move snapshot links** (transfer). Rationale given: if the alignment materially changed, you *want* old snapshots pinned to the plan the lots were defined against.

### 1.12 Photos
- Positioned from **EXIF** data. Dennis: "we've been storing EXIF data from photos for about 6 months" — i.e. only photos from ~Sept 2025 onward are locatable. No in-app map-pin capture described.

### 1.13 "Feature" entity
- An entity type visible in the UI but **not implemented**. Intent: ad-hoc named positions / landmark annotations in space.

### 1.14 Role permissions (four new permissions, auto-migrated 10 Mar 2026)
| Permission | View | Add | Edit | Admin/Delete | Migration default |
|---|---|---|---|---|---|
| **Plan** | select/view a Plan (Lot Register, Lot Spatial tab, Plan Register) | add a Plan | configure a Plan (coordinates/perimeter) | delete a Plan | View only, matched to existing Lot View |
| **PlanSnapshot** | open a snapshot on Plan/Map | create snapshots **and mark out a new Lot geometry** | update snapshot properties/image, save Chainage Grid changes | delete | matched to existing Lot View/Add/Edit/Admin |
| **Coordinates** | see Coordinates Register + CRS in Lot Spatial tab | add/edit project CRS | — | — | — |
| **Control Line** | see Control Line Register + control lines on plans/Spatial tab | | | | **View for all roles** (otherwise the Spatial tab errors) |

Three published scenarios: **Site Engineer** (Plan View, PlanSnapshot View+Add, Coordinates View, Control Line View — no plan registration rights), **Quality Manager / Project Admin** (full on all four), **Client / Testing Subcontractor** (View on all four, no Add/Edit).

### 1.15 3D / 4D roadmap ("how constructed model") — alpha, not shipped
Presented by the founder at 29:26 of the webinar.
- Motivation: clients (named: **QLD TMR**) increasingly require conformance data inside handover models. Current industry practice is to hand-subdivide as-constructed model objects to match lot extents; Dennis: as-con models don't carry pavement-layer entities at all, a median barrier is "35–40 different lots", and "TMR's got some clunky Excel upload thing they do… it's quite a mess."
- Their approach: **procedurally generate** a separate QA model from the 2D lot geometry + lot dates. Because lots carry start / finish / conformed dates, it is **4D**, not just 3D. Pitch: a "QA model" as a first-class member of the federated model set, alongside design and as-constructed.
- New objects in the 3D build: **Models**, **Element Sets**, **Profiles**, **Styles**. Per lot you assign an element set, then generate.
- **Four procedural generation methods:**
  1. **From an existing model item** — import an IFC, strip UIDs + descriptions into the DB, keep the file on a server; reference element(s) by UID, then re-emit them with all conformance metadata appended.
  2. **Surface extrusion / cookie-cutter** — drop the 2D lot shape through a **TIN** (drone flyover, as-con surface, or survey pickup) with a height and an offset from the finished surface. Worked example: subbase = 140 mm thick, offset 165 mm below finished surface. One TIN can generate every pavement layer.
  3. **Extrude a shape along a polyline** — pipes, defined as a ring with a wall thickness, anchored at the bottom.
  4. **Drop a shape at a point** — pits, vertical extrusion (1.1 m) with optional rotation.
- Output: **IFC only** — "no proprietary formats or anything so you can import it into whatever you want". Block models chosen deliberately for small storage and metadata-findability over survey fidelity: "you're not necessarily interested in all the minutiae… what you're trying to track down is where is all the metadata behind it."
- Timeline given (Mar 2026): alpha "by mid-April", general availability "early in the second half of the year".

---

## 2. UX flows (as they describe them)

**A. Cold-start setup (the full ladder — everything before you can draw one lot)**
1. Read the CRS off the drawing title block (or ask the surveyor). `QA Setup > Coordinate Systems > Load from Default` → pick e.g. GDA2020 MGA Zone 55 → Save.
2. Find the "Geometric Setout Details" sheet. Screenshot each control-line table → paste into ChatGPT/Gemini → "Convert this table into CSV format" → leave the window open.
3. `QA Setup > Control Lines > New Control Line` → name + description → right-click → Import Coordinates → Coordinate Type = Project Coordinates → pick Import Reference System → Import from Clipboard → verify auto-assigned column headings → Import. `Has Geometry` ticks. Repeat per control line.
4. Prepare PDFs: strip unused sheets, flatten via "Microsoft Print to PDF" opened in Chrome/Edge, keep under 20 MB.
5. `Spatial > Plans > New Plan` → name, Reference System, description, file → Save.
6. Right-click → Configure Plan. Per sheet: zoom to ~300%, Configure → Add Registration Point(s) → click a chainage tick on a control line → `From Control Line Chainage` → pick line + chainage (coordinates auto-fill). Repeat ≥2–3 times, spread across the sheet, non-colinear.
7. Per sheet: Configure → Add Perimeter → trace around the drawing content along join lines, excluding notes/title block → close on the first point → Save.
8. Repeat 6–7 for every sheet. Save and Close.
9. Go back to Control Lines → View/Edit on Plan → Select the line → Edit → drag vertices onto the drawn curves to smooth the chords → Done.

**B. Define a lot by chainage** — New Lot → Spatial tab → Add Chainage → pick control line → Shape = Polygon → from 65400 to 65458, offsets left/right (13 m road) → Save. CivilPro generates the 2D geometry. → View on Plan → pick which drawing set to display it on → optionally click the polygon → Edit → drag points → optionally Add → Polygon to add a second named geometry ("additional offset subbase") → both areas sum in the Geometries panel → Update and Close.

**C. Define a lot by drawing** (for clear-and-grub or anything not following an alignment) — Spatial tab → View on Plan → choose Plan → Add → Polygon → trace → close → name it or accept the Lot Number → Save & Close.

**D. Draw a lot against its neighbours** — in Lot Markup: Find → Find on Current Page → filter entity=Lot, "Subbase" → Search → adjacent lots appear → turn on Snapping → trace the new lot snapped to their edges → select all → "remove selected entities from list" to declutter → Update and Close.

**E. Test Request with a lot map for the subbie** — right-click lot → New Test Request → recipient → Next → Spatial tab (geometry inherited; optionally nudge or swap to a Point for a soft spot) → Next → Add Test (they cross-sell "add test from ITP" here, which auto-populates samples from the ITP checklist item) → Next → on finalise choose **Snapshot on Plan** → Create Snapshot → Save → the framed map is embedded in the TR report → "notify the tester?".

**F. Lot map into the conformance report** — from the lot: View on Plan → frame the view → Create Snapshot → name → Save → right-click the snapshot → Set as Report Default → generate Lot Summary / Conformance report; the map is embedded.

**G. Multi-entity snapshot** — from Lot Register select lot(s) → View on Plan → Find by Plan (sketch area) → filter to Subbase lots + TRs + Photos → Search → set Properties (colour/opacity/line weight) to highlight the subject lot → set Is Visible / Is Linked per entity → zoom to frame → Save Snapshot → name → Save → it appears in Related Items of every Is-Linked entity.

**H. Plan revision** — Spatial > Plans → right-click → Download Plan → swap sheets offline → Configure Plan → Plan Actions → Replace Image → drag new file → choose snapshot behaviour (do not modify / copy links / move links) → OK.

**I. Drone/aerial image layer** — snip the drawing at max resolution inside the join lines → QGIS Layer > Georeferencer → open image → click ≥3 known points, type easting/northing, set source CRS → Transformation settings: Helmert, target EPSG:3857, "World file only" → Start Georeferencing → select image + world file → right-click → Send to compressed (zip) → CivilPro Image Layers → Add Georeferenced Image → drop the zip → Enable Editing → set opacity ≈ 60%.

---

## 3. Terminology & data model

| Their noun | Meaning |
|---|---|
| **Spatial** | The module, and the renamed tab on Lots and Test Requests (was "Chainage" on desktop, "Geometry" on web) |
| **Plan** | A whole multi-sheet drawing set uploaded as one file + one CRS. *Not* a document-register object |
| **Sheet** | A page within a Plan. Registration and Perimeter are per sheet |
| **Registration / Registration Point** | A (pixel position on sheet) ↔ (real-world coordinate) pair. ≥2–3 per sheet, non-colinear, spread out. Yields rotation + scale + position |
| **Perimeter** | Per-sheet clipping polygon defining where annotations may render |
| **Coordinate System** | Project-scoped CRS entry (MGA zone + GDA datum), from a bundled default library |
| **Control Line** | Named alignment with ordered chainage→coordinate vertices. `Has Geometry` = coordinates present. "Mapped" vs "un-mapped" |
| **Chainage Definition** | Lot-level record: control line + start ch + finish ch + offsets + shape type. Generates a Geometry |
| **Geometry** | A polygon / polyline / point in world coordinates, optionally named, belonging to an Entity. Many per entity |
| **Entity** | Any spatially-locatable record: **Lot**, **Test Request**, **Photo** (+ **Feature**, unimplemented; NCR referenced once in the revision article) |
| **Plan Snapshot** ("Lot Map") | Saved view = entity set + per-entity styling + underlying Plan/Map layer + view extent + baked raster image. Lockable, linkable, settable as report default |
| **Is Visible / Is Linked** | Per-entity flags on a snapshot: drawn in it, vs. surfaced in that entity's Related Items |
| **Related Items** | Generic cross-reference panel where snapshots appear on Lots / TRs |
| **Image Layer** | Geo-referenced raster (drone/aerial), imported as image + world file zip, with opacity |
| **Model / Element Set / Profile / Style** | 3D-module (alpha) objects: a Model contains generated elements; an Element Set describes how a lot's geometry is turned into a solid |
| **How-constructed model** | Their name for the procedurally generated 4D QA model, distinct from the as-constructed model |

**Relationship spine (the architectural keystone):**
`Coordinate System → Control Line → (registration) → Plan/Sheet` positions drawings in world space. Independently, `Lot → 0..n Geometry` and `Test Request → geometry (inherited from Lot, overridable)` and `Photo → EXIF point` are stored **in world coordinates, not in sheet coordinates**. Therefore any entity renders on *any* registered plan, on Google Maps, or over drone imagery — plans are interchangeable backdrops. Snapshots are the only place a specific plan gets pinned to a specific view, and even then only for presentation. Dennis: *"it really doesn't matter where you define it. It's completely agnostic."*

---

## 4. Strengths worth stealing

1. **Geometry in world coordinates, plans as swappable backdrops.** The single best decision in the whole module. New IFC issue lands → register it → every existing lot appears correctly on top. Discipline sets (earthworks GA, drainage line plot, structures detail) all show the same lots. If SiteProof pins geometry to a specific PDF page, we inherit their old problem; make world-coordinate storage the invariant and the drawing a render target.
2. **Chainage definition auto-generating a real polygon.** `control line + start ch + end ch + L/R offsets + shape` is exactly how a civil engineer already thinks, and it produces true geometry with zero drawing. Massive setup-cost reduction vs. tracing every lot. Then let them edit the generated vertices. Copy this verbatim.
3. **"Do Not Project" graceful degradation.** If the control line has no coordinates, auto-detect and silently fall back to chainage-only text. Nobody is blocked, and the spatial layer is opt-in per lot. This is why their migration was non-disruptive.
4. **Register a sheet by clicking a chainage, not typing coordinates.** Removes transcription errors and the need to have setout tables open. The 30-second-per-sheet claim only holds because of this.
5. **Sheet Perimeter as an annotation clipping mask.** Cheap to build, and it kills the ugliest failure mode (lots drawn over the title block, overlapping join lines between sheets).
6. **The lot map attached to the Test Request that goes to the testing subcontractor.** Highest value-per-line-of-code idea in the module: the third party who has never been on site gets a framed map of where to test. Directly analogous for us: NCR to subbie, hold-point notice to the superintendent, ITP inspection request.
7. **Snapshot = saved view, bidirectionally linked, with Is Visible / Is Linked split.** Not a screenshot — a re-openable, re-searchable object that lives in the Related Items of every entity it depicts, with the "show context without polluting their record" escape hatch. And `Set as Report Default` makes report embedding a one-click decision rather than a report-template problem.
8. **Find-in-area + snapping.** Search a drawn region by entity type and attribute, then snap the next lot to the found boundaries. This is how you get gap-free, overlap-free lot coverage across a project — and it makes "what haven't I lotted yet?" answerable visually.
9. **Property scoping by geometry / snapshot / plan.** Styling inheritance at three levels; plan-level styling propagates everywhere that plan is opened.
10. **Revision as a new Plan with transferred registrations + an explicit snapshot-link policy.** They correctly identified that an old lot map must keep pointing at the drawing it was drawn against. The three-way choice (don't modify / copy / move) is the right UX for a genuinely ambiguous decision.
11. **Permission split: Plan (registration) vs PlanSnapshot (markup) vs Coordinates vs Control Line.** Registration is a trust boundary — one bad registration silently corrupts every lot on that sheet. Gate it separately from "draw a lot".
12. **The "Requesting Geo-Referenced PDFs from your Designer" article.** A copy-pasteable email + a per-software support matrix + "export one test sheet first". Pure onboarding-friction removal as a content asset; costs nothing and makes the hard path feel handled.
13. **Lot dates as model dimensions (4D).** Start / finish / conformed already exist in any QA system — treating them as a native spatial dimension rather than a report column is the cheap unlock.
14. **IFC-only output, no proprietary format.** Removes the "will it work with our BIM stack" objection entirely.

---

## 5. Weaknesses / gaps we can exploit

1. **The cold-start ladder is nine steps long and every rung is manual.** CRS lookup → OCR the setout tables through a third-party chatbot → clipboard import → per-sheet registration clicks → per-sheet perimeter tracing → post-hoc curve smoothing by dragging vertices. Nothing is inferred, nothing is automated, and it must be redone (partly) on each drawing revision. **This is so painful CivilPro sells "we'll import your drawings for you" as a quoted professional service.** A setup path that ingests the drawing set and derives control lines + registration automatically is a direct, demonstrable wedge.
2. **Their official recommended data-extraction method is "paste it into ChatGPT".** The KB says LLM OCR is *preferred* over PDF→Excel. That is a vendor telling customers to leave the product, hand construction drawings to an external AI, and copy the result back through the clipboard. We already run AI server-side — extracting setout tables natively (and validating chainage monotonicity / coordinate plausibility on import) is both an obvious feature and a security/governance talking point.
3. **AutoCAD and Civil 3D cannot produce GeoPDFs — by their own matrix — and 12d is "not documented".** In AU civil that is the majority of design output. So the frictionless path is unavailable to most customers, and manual registration is the real workflow, not the exception.
4. **Perimeter must be hand-traced per sheet even when the PDF is geo-referenced.** The "no registration required" promise still leaves per-sheet manual work.
5. **No accuracy feedback.** Registration quality is "zoom in and click carefully"; no residual/RMS error, no warning when points are nearly colinear or clustered, no way to see how far off a sheet sits. The docs handle it with folklore ("I implore you to zoom in more than I have"). Show a fit error and let people fix it.
6. **Plans are explicitly *not* the document register.** "Do Not: use the Plans functionality as your Controlled Documents source… it was not designed to be efficiently used for this purpose." So drawings live in two places with two revision models, and the spatial copy is a hand-curated, sheet-count-locked subset. Revising it requires downloading the set, editing it in an external PDF editor, and re-uploading with *exactly* the same sheet count and identical per-sheet location/scale. One integrated drawing register that is simultaneously the spatial backdrop and the controlled document is a clean differentiator.
7. **Performance is a known soft spot, managed by user discipline.** Keep under 20 MB; flatten via "Microsoft Print to PDF"; minimise linework; delete unused pages; prefer larger sheets with less detail; a rasterise-on-import toggle. And the flatten advice **directly contradicts** the GeoPDF advice (flattening strips georeferencing) — an unresolved trap in their own docs.
8. **Zero field/mobile story.** Nothing in any source describes a phone workflow, GPS "you are here" on the plan, offline plan caching, or capturing a photo/test/NCR at your current position. Everything is a desk activity performed after the fact. Photos are located by **EXIF only, with roughly six months of history** and no in-app map pin. Our GPS lot detection, photo pins and offline stage-1 work sit squarely in this hole.
9. **Snapshots bake a static raster that goes stale silently.** "Update Snapshot Image" is a manual command. A report default captured in March still shows March's lots and March's underlying drawing revision unless someone remembers. Live-rendered report maps (or at least a staleness indicator) is an easy win.
10. **Only three entity types are spatial: Lots, TRs, Photos.** No hold points, no ITP items, no NCRs (referenced once in the revision doc but absent from the founder's own Q&A list), no defects, no diary entries, no dockets. "Where are my open hold points?" and "show me every NCR on this chainage band" are unanswerable in their product.
11. **The "Feature" entity type is visible in the UI but not implemented** — no ad-hoc annotations, landmarks, or free markup in space.
12. **No association between work type / discipline and drawing set.** Raised directly by a customer (Farad) who wants all drainage lots marked up on the drainage set for coverage checking; answer was "not at the moment… conceptually yes we can". So there is no governance over which plan a team marks up on, and no per-discipline coverage view. Auto-selecting the plan by lot work type is a small feature that answers a live, unmet customer request.
13. **Drone/aerial imagery still requires QGIS**, a Helmert transform, a world file, and a zip — plus a stated risk that corporate IT blocks the install. In-app raster georeferencing (we already have geo-referenced overlays) makes this a two-click job.
14. **PlanSnapshot permission conflates "create a saved view" with "draw a lot geometry".** Add on PlanSnapshot is required to mark out a new lot geometry. Conceptually wrong and hard to explain; the docs need three worked scenario examples plus a warning that Control Line View must stay on for every role "to avoid an error code" — i.e. the permission model already leaks errors into the UI.
15. **No spatial validation.** Nothing checks for overlapping lots, gaps in coverage, lots outside the perimeter, or geometry that contradicts its chainage definition. Snapping helps you avoid it by hand; nothing catches it.
16. **Doc churn suggests instability.** X/Y is documented as Northing-first in one article and Easting-first in another; minimum registration points is 3 in the desktop doc and 2 in the web doc; the desktop and web trees have diverged ("Plans (D)" vs "Plans") with different button names for the same actions.
17. **A live demo bug in their own launch webinar**: refining a Test Request geometry broke TR creation. Recovered by redoing it without the edit and telling the audience "just continue as you were".
18. **3D is vapour until at least H2 2026** — alpha targeted mid-April 2026, "with luck" GA early in the second half. Anyone buying today buys 2D only.

---

## 6. Surprises

- **They sell drawing import and training as quoted professional services** ("if you'd like us to import your drawings so you don't have to worry about doing that, we can also quote that up"). Setup friction has been productised as a revenue line rather than engineered away.
- **The KB officially recommends ChatGPT/Gemini OCR** as the *preferred* route for getting setout tables into the product.
- **No pricing or SKU gate on Spatial.** It arrived as a database upgrade on 10 March 2026 with permissions auto-migrated for existing roles. Nothing in any source describes it as a paid add-on module — only the services around it are chargeable.
- **QGIS is a documented prerequisite** for drone/aerial imagery, including an acknowledgement that customers' IT may forbid installing it.
- **The whole spatial push is a stepping stone to 3D/4D, not the destination.** The founder was explicit: 2D lot geometry exists so that a "how-constructed model" can be procedurally generated. IFC in, IFC out, block models chosen for metadata retrieval rather than survey fidelity.
- **QLD TMR is named as the forcing function**, with their current conformance-into-model process described as "some clunky Excel upload thing… quite a mess". A named agency requirement is driving the roadmap — worth checking which AU state authorities are imposing equivalent handover-model requirements on our target customers.
- **They intend to make IFC element references a first-class object** — import an IFC, strip UIDs and descriptions into the database, keep the file server-side, link lots to elements by UID, then re-emit those elements with conformance metadata attached. They note customers already hack this today with custom registers holding model UIDs.
- **Bulk geometry export is positioned as an API-level concern**, not a UI feature — implies a public/partner API exists or is planned for spatial data.
- **Registration is moving from 3 points to 2** (webinar, and the July web doc already says minimum 2) — presumably an affine-vs-similarity transform change.
- **Snapshots block plan deletion**, forcing an explicit transfer-or-delete decision. Small, but it's a maturity signal: they thought about referential integrity for report artefacts.
- **"CivilPro Desktop" is still a first-class client** shipping the same module in parallel with the web app, with its own separate documentation tree.
