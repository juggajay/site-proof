# Browser IFC Viewer Landscape — Primary-Source Research

**For:** SiteProof / CIVOS — React 18 + Vite, strict bundle discipline (viewer must be a lazy-loaded route chunk), mid-range Android/iOS phones on site, client-supplied IFC 2x3 **and** IFC 4/4x, later 4D timeline colouring elements by construction-lot status.

**Date checked: 2026-08-06.** All license/version/date facts below were pulled from the GitHub REST API (`gh api`), the npm registry API, and official docs — not from blog posts or aggregators. Where I measured something myself (file sizes), I say so and give the command.

---

## 1. Comparison table

| | **ThatOpen** (`@thatopen/components` + `web-ifc`) | **xeokit-sdk** | **three.js + web-ifc** (roll your own) | **APS / Forge Viewer** | **Speckle** | **iTwin.js** |
|---|---|---|---|---|---|---|
| **License** (verbatim, checked 2026-08-06) | `web-ifc`: **MPL-2.0** — LICENSE.md line 1: `Mozilla Public License Version 2.0`. `@thatopen/components`: **MIT** — LICENSE.md: `Permission is hereby granted, free of charge…`. `@thatopen/fragments`: **MIT** | **AGPL-3.0** — LICENSE line 1: `GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007`. Converter `xeokit-convert` also **AGPL-3.0**. Recommended converter (Creoox cxConverter) is **binary-only "Testing License"** — see §2.2 | three.js **MIT**, web-ifc **MPL-2.0** | Proprietary SaaS. ToS §7.1 restricts apps whose value is format translation | `@speckle/viewer` **Apache-2.0**; repo is `NOASSERTION` because server `workspaces/` + `gatekeeper/` modules are under a separate Speckle **Enterprise Edition** license | **MIT** |
| **License change history** | **No rug-pull.** `web-ifc` LICENSE.md commits: `2021-02-26 Add MPLv2 license`, `2021-02-27`, `2024-04-10 Update LICENSE.md` — MPL-2.0 since inception. `engine_components` LICENSE.md: created `2022-08-11`, MIT throughout | AGPL since inception; commercial escape hatch added via Creoox | n/a | Repriced **2025-12-08** (see §2.4) | n/a | n/a |
| **Maintenance** (last release) | `@thatopen/components` **3.4.8, 2026-07-24**; `@thatopen/fragments` **3.4.7, 2026-07-23**; `web-ifc` **0.0.77, 2026-03-06**. Cadence ~6–10 wks | **v2.6.112, 2026-06-25**. Cadence ~3–5 wks — the most frequent releaser here | three.js **0.185.1, 2026-07-01** (monthly) | Viewer v7, continuous | `@speckle/viewer` 2.31.14, 2026-06-15 | `@itwin/core-frontend` 5.12.0, 2026-08-03 |
| **Open issues** | web-ifc **83**, components **8** | **190** | n/a | n/a | n/a | n/a |
| **Stars** | 1,006 + 692 | 920 | — | — | — | — |
| **IFC 2x3 support** | **Proven, explicit** — see §2.1 for the shipped schema table | Direct IFC path is **alpha**, and it wraps web-ifc anyway. Production path = external converter | Same as ThatOpen (same engine) | Yes, but **only if you pass `conversionMethod: "v4"`**; default `legacy` is IFC2x3-only Navisworks loader | Via IfcOpenShell in a Python worker | **No IFC connector exists** |
| **Mobile / WebGL** | three.js WebGL2. **No official mobile support statement** — unverified | WebGL2. Reputation for large models; no primary mobile matrix found | WebGL2 | **No mobile section** in official System Requirements; changelog shows repeated iOS/Android fixes | Not verified | Best mobile story — first-party MIT iOS/Android SDKs |
| **Bundle / wasm size** (measured, see §2.1) | `web-ifc.wasm` **1,273 KB raw / 462 KB gzip**; `web-ifc-api.js` **5,765 KB raw / 475 KB gzip**. Parser total ≈ **937 KB gzip** before three.js | npm unpacked **25.00 MB**, 517 files | three.js unpacked 22.10 MB (tree-shakeable) + web-ifc as above | Multi-MB from Autodesk CDN; **cannot be self-hosted or bundled** | Not measured | Not measured |
| **Per-element colour API for 4D** | **Yes** — `highlighter.styles.set(name, {color, opacity, transparent, renderedFaces})` then `await highlighter.highlightByID(name, modelIdMap, false)`; `highlighter.clear(name)` | **Yes** — `Entity.colorize` = *"Sets the Entity's RGB colorize color… Each element of the color is in range [0..1]"*; plus `opacity`, `visible`, `highlighted` | Build it yourself | **Yes** — `setThemingColor(dbId, color, model, recursive)`, `clearThemingColors`, `hide`/`show`/`isolate` | **Yes** — `FilteringExtension.setUserObjectColors([{objectIds, color}])` | Not verified |
| **IFC GUID → element handle** | Via web-ifc express IDs / Fragments IDs | **`Entity.originalSystemId`** — *"When loading an IFC model, this property will hold the IFC product ID of the corresponding IFC element"* | Direct from web-ifc | **Unverified** — docs name Revit/AutoCAD IDs, not IFC. Use `IfcGUID` property search | Speckle object ids | n/a |
| **Server-side conversion required?** | **No.** Client-side wasm parse. Caching `.frag` is an optimisation, not a requirement | **Yes in practice** — production path is an offline converter | **No** | **Yes, mandatory**, in Autodesk's cloud | **Yes** — Speckle server + Postgres + Python IfcOpenShell worker | **Yes** — Bentley desktop/cloud Synchronizer, and no IFC connector |
| **Per-use fees** | None | None for AGPL use; commercial license priced on request | **$4.50 per IFC translation** (1.5 tokens @ $3.00) | None (self-host cost) | Cloud fees for synchronized iModels |

---

## 2. Per-candidate notes

### 2.1 ThatOpen (formerly IFC.js) — `@thatopen/components` + `web-ifc`

**Licensing is split, and the split matters.**
- `web-ifc` (the wasm parser) is **MPL-2.0**, not MIT. Verified: `gh api repos/ThatOpen/engine_web-ifc --jq '.license'` → `{"spdx_id":"MPL-2.0"}`, and npm `web-ifc@0.0.77` declares `"license":"MPL-2.0"`. LICENSE.md line 1 reads verbatim `Mozilla Public License Version 2.0`.
  - Source: https://github.com/ThatOpen/engine_web-ifc · https://www.npmjs.com/package/web-ifc
  - **Practical effect: fine for us.** MPL-2.0 is *file-level* copyleft. You must publish modifications *to web-ifc's own files*; it does not reach into your application code that merely imports it. Consuming it unmodified from npm imposes no obligation on SiteProof's source. This is materially weaker copyleft than AGPL.
- `@thatopen/components` is **MIT** — `gh api repos/ThatOpen/engine_components --jq '.license'` → `{"spdx_id":"MIT"}`; npm 3.4.8 declares `"license":"MIT"`.
- `@thatopen/fragments` is **MIT** — npm 3.4.7 declares `"license":"MIT"`. The Fragments *converter is open source*, in `ThatOpen/engine_fragment` (MIT, pushed 2026-07-23).

**No license rug-pull in the history** (you asked specifically). Commit history on the license files:
```
web-ifc LICENSE.md:            2021-02-26 "Add MPLv2 license" → 2021-02-27 → 2024-04-10 "Update LICENSE.md"
engine_components LICENSE.md:  2022-08-11 "Create LICENSE.md" → ... → 2024-04-10 "Update LICENSE.md"
```
Verified via `gh api "repos/ThatOpen/engine_web-ifc/commits?path=LICENSE.md"`. Both have carried the same license since creation. What *did* change is the org name (IFC.js → ThatOpen) and the deprecation of `web-ifc-viewer` → `components`.

**Their paid arm exists but is separate.** `ThatOpen/platform_services` (pushed 2026-08-05) carries **no license file** (`license: NONE`) — that's the commercial/cloud offering. The engine packages you'd actually use (`engine_components`, `engine_fragment`, `engine_ui-components`, all MIT; `engine_web-ifc`, MPL-2.0) are unaffected. Source: `gh api "orgs/ThatOpen/repos?sort=pushed"`.

**IFC 2x3 support — this is the strongest evidence in the whole report.** I downloaded the published npm tarball and grepped the shipped bundle. The runtime schema table is, verbatim:
```js
SchemaNames[1] = ["IFC2X3", "IFC2X_FINAL"]
SchemaNames[2] = ["IFC4"]
SchemaNames[3] = ["IFC4X3", "IFC4X1", "IFC4X2", "IFC4X3_RC3", "IFC4X3_RC4",
                  "IFC4X3_RC1", "IFC4X3_RC2", "IFC4X3_ADD2", "IFC4X3_ADD1"]
```
The bundle contains 4,655 `IFC2X3` symbol references. The repo ships the official EXPRESS schema file `src/schema-generator/IFC2X3.exp`, and `src/schema-generator/schema_aliases.ts` states verbatim:
> `// We cannot support all the IFC schema version - especially deprecated and RC releases - doing so would massive increase the bundle size.`
> `// So instead we alias them to the "best effort" parser`

So: **IFC2X3 and IFC4 each get a real dedicated parser; IFC4X1/4X2/4X3-RC variants are aliased onto the IFC4X3 parser on a best-effort basis.** That covers both schemas civil design models arrive in.
- Sources: https://github.com/ThatOpen/engine_web-ifc/blob/main/src/schema-generator/schema_aliases.ts · https://github.com/ThatOpen/engine_web-ifc/tree/main/src/schema-generator (contains `IFC2X3.exp`)
- Reproduce: `curl -sSL https://registry.npmjs.org/web-ifc/-/web-ifc-0.0.77.tgz | tar -xz && grep -oE 'SchemaNames\[[0-9]+\] = \[[^]]*\]' package/web-ifc-api.js`

**Sizes — measured, not estimated.** From the published tarball (`gzip -9 -c`):

| File | Raw | Gzip |
|---|---|---|
| `web-ifc.wasm` | 1,273 KB | **462 KB** |
| `web-ifc-mt.wasm` (multithreaded) | 1,283 KB | 472 KB |
| `web-ifc-api.js` | 5,765 KB | **475 KB** |

The 22.88 MB npm "unpacked size" is misleading — it counts three wasm builds (browser, mt, node), three JS builds (esm, iife, node), and a 2 MB `ifc-schema.d.ts` that is types-only and never ships. **Realistic over-the-wire cost of the parser is ~937 KB gzip**, plus three.js and components. That is a genuinely large lazy chunk but entirely viable as a route-level `React.lazy` import; it is nowhere near the main bundle.

**No server-side conversion required.** The docs are explicit that conversion runs in-browser: `ifcLoader.setup({autoSetWasm: false, wasm: {path: "https://unpkg.com/web-ifc@0.0.77/", absolute: true}})` then `ifcLoader.load(buffer)` on an `ArrayBuffer`. The docs *recommend* caching the resulting `.frag`: *"Loading IFC models at runtime is too slow for production"* and *"The time-consuming part is the conversion process, not the actual loading of the model into the scene."* That's an optimisation you can adopt (convert once on upload, persist `.frag` to Supabase Storage), not a hard dependency, and critically **the converter is open-source MIT** — no vendor in the loop.
- Source: https://docs.thatopen.com/Tutorials/Components/Core/IfcLoader

**Per-element colour for 4D — verified in docs.** Arbitrary colours on arbitrary ID sets, decoupled from click events:
```js
highlighter.styles.set(name, { color: new THREE.Color("red"), opacity: 1, transparent: false, renderedFaces: 0 });
await highlighter.highlightByID(name, modelIdMap, false);
await highlighter.clear(name);
```
Documented caveat: *"The select highlighter takes precedence over custom highlighters"* while items are selected.
- Source: https://docs.thatopen.com/Tutorials/Components/Front/Highlighter

---

### 2.2 xeokit-sdk — fast, but the licensing is a trap for us

**License: AGPL-3.0, verified verbatim.** `gh api repos/xeokit/xeokit-sdk --jq '.license'` → `{"spdx_id":"AGPL-3.0"}`. LICENSE file line 1: `GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007`. npm `@xeokit/xeokit-sdk@2.6.112` declares `"license":"AGPL-3.0"`.
- Source: https://github.com/xeokit/xeokit-sdk

**AGPL §13 is the problem.** SiteProof is a hosted SaaS. AGPL's network clause means serving the viewer to users over a network triggers the obligation to offer *corresponding source of the whole work*. That is not a theoretical risk for a commercial construction SaaS — it's the exact scenario AGPL was written for. Their own wiki confirms the escape hatch is commercial:
> *"The xeokit SDK is licensed under the Affero GPL V3 license."*
> *"Custom licenses are also available for enterprises that wish to avoid the copy-left restrictions of the AGPL3."*
- Source: https://github.com/xeokit/xeokit-sdk/wiki/License

**The whole toolchain is AGPL or worse.** `xeokit/xeokit-convert` is also **AGPL-3.0** (`gh api repos/xeokit/xeokit-convert`). And their *own README steers you away from it*, verbatim:
> *"CAUTION: Direct IFC conversion is an alpha status feature, since it depends on web-ifc, a 3rd-party library, which is also alpha at this time. As such, some IFC models may not convert properly and not property sets are supported. This is why, please consider using our standard conversion setup using the cxConverter…"*

**The recommended converter is binary-only and forbids production use.** `Creoox/creoox-ifc2gltfcxconverter` ships only `FAQ.md`, `LICENSE`, `README.md`, `specification` — **no source**; releases are prebuilt binaries (`cxconverter-linux-amd64.tar.gz`, `cxconverter-windows-amd64.zip`, latest 5.11.13, 2026-07-24). Its LICENSE reads verbatim:
> *"Ifc2gltfCxConverter **Testing License**"*
> *"Redistribution and use in binary form, without modification, are permitted provided that the following conditions are met: 1. Redistributions must be used **solely for the purpose of testing and evaluation** of the software."*
> *"Need a commercial license? If your company requires cxConverter … for proprietary or closed-source applications, we offer flexible commercial licensing options. Contact us at contact@creoox.com"*

So the xeokit production IFC path is: **AGPL viewer + a proprietary converter you may not legally use in production without buying a license.** Their hosted pipeline (`xeoServices`) likewise requires *"Request your access token now at contact@creoox.com"*.
- Sources: https://github.com/xeokit/xeokit-convert (README + license) · https://github.com/Creoox/creoox-ifc2gltfcxconverter/blob/main/LICENSE

**Pricing: not public.** `xeokit.io/pricing.html` returns 404; the wiki points to `xeokit.io/index.html#pricing`. I could not verify any dollar figure from a primary source — it is quote-based via Creoox.

**Credit where due:** xeokit has the best per-element ID story for 4D. `Entity.originalSystemId` is documented verbatim as *"ID of the corresponding object within the originating system… When loading an IFC model, this property will hold the IFC product ID of the corresponding IFC element."* Combined with `colorize` (*"Sets the Entity's RGB colorize color… range [0..1]"*), `opacity`, `visible`, `highlighted`, it is a clean 4D API. It also has the tightest release cadence (~monthly). The licensing, not the engineering, is what rules it out.
- Source: https://xeokit.github.io/xeokit-sdk/docs/class/src/viewer/scene/Entity.js~Entity.html

---

### 2.3 three.js + web-ifc (roll your own)

three.js is **MIT**, 0.185.1 published 2026-07-01 (npm registry). web-ifc gives you geometry directly: it returns meshes and express IDs from the wasm, and you build `BufferGeometry` + `InstancedMesh` yourself.

**Feasible, but this is precisely what ThatOpen already is.** `@thatopen/components` ≈ web-ifc + three.js scene tooling + the Fragments memory format, and it's MIT with only 3 small dependencies (`jszip`, `three-mesh-bvh`, `fast-xml-parser` — from npm metadata). Rolling your own means re-implementing instanced-mesh batching, spatial-tree traversal, BVH raycasting for picking, and per-element colour override plumbing — all of which are the hard parts, and all of which Fragments exists to solve (it's a Flatbuffers binary format specifically for not blowing up memory on large models).

The one legitimate reason to do it: if you only ever need *dumb geometry display* with no picking, no property panel, and no 4D, you could skip components and cut maybe 300–400 KB gzip. Given 4D per-element recolouring is explicitly on the roadmap, that reason doesn't apply. **Don't roll your own.** The lazy path and the correct path agree here.

Note `web-ifc-three` (the old three.js `IFCLoader`) is MIT but **stale — last push 2024-04-17**, and `ThatOpen/web-ifc-viewer` is explicitly dead: its README reads `THIS LIBRARY IS DEPRECATED. USE COMPONENTS INSTEAD` (last push 2023-09-29). Any tutorial you find referencing either is out of date.
- Sources: https://github.com/ThatOpen/web-ifc-viewer · https://github.com/ThatOpen/web-ifc-three

---

### 2.4 Autodesk Platform Services (APS / Forge) Viewer

**Cost: $3.00/token**, verified on https://www.autodesk.com/buying/flex — *"Minimum $99 / 33 tokens"* and *"Popular $1,500 / 500 tokens"* (both exactly $3.00/token); *"Tokens expire 1 year from date of purchase."* IFC is explicitly a **Complex** job (https://aps.autodesk.com/blog/forge-pricing-changes-are-here: *"Processing an IFC model using the Model Derivative API will now be classified as a Complex job"*), and the rate sheet prices complex jobs at *"3 tokens or $9 for 2 complex jobs"*. **→ ~$4.50 per IFC translation**, with 20 free complex jobs/month. Repriced 2025-12-08 (https://aps.autodesk.com/blog/aps-business-model-evolution).

**Your customers do NOT need Autodesk accounts** — this was the one pleasant surprise. APS ToS §20 defines *"'End User' … means Your customers and/or other users who will be using Your Applications"*, the account obligation in §3 falls only on you and *"Your individual employees, consultants, contractors and agents"*, and §7.2 explicitly contemplates *"establishing pricing for Your End Users."* Two-legged client-credentials auth means your server holds the keys.
- Source: https://www.autodesk.com/company/legal-notices-trademarks/terms-of-service-autodesk360-web-services/forge-platform-web-services-api-terms-of-service

**But three things kill it for us:**
1. **The viewer JS cannot be self-hosted or bundled.** Docs, verbatim in a Note box: **"The Autodesk Viewer SDK JavaScript must be delivered from an Autodesk hosted URL."** It's a global `<script>` from `developer.api.autodesk.com`, not an npm ES module (`@autodesk/viewer`, `aps-viewer` → 404 on npm; `forge-viewer` was unpublished 2020-06-10). It also *"has a hard dependency on three.js R71"* — a 2015 build that will not coexist with a modern three.js. This is flatly incompatible with "lazy-loaded Vite route chunk" and with any offline/PWA story.
2. **ToS §7.1 "Additional Value":** *"Your Application must add significant functionality… may not use any part of Developer Offerings … where a substantial portion of the value of Your Application is to provide translation from one file format to another."* Fine while viewing is incidental to ITP/lot QA; a constraint to keep in mind if the 4D model view ever becomes the headline feature.
3. **Cloud translation is mandatory** — *"before you can display a model with the Viewer, you must translate the model to SVF2 … or SVF."* SVF2 derivatives *"cannot be downloaded for offline viewing."*

**IFC versions:** supported, but you must opt in. `advanced.conversionMethod` defaults to `legacy` (*"based on the Navisworks IFC loader"*, IFC2x3 only). `v4` is *"(Recommended) … a native solution … does not depend on Navisworks or Revit"* and per Autodesk's blog covers *"IFC2x3, IFC4 and official IFC4.3 support"*. Anyone posting a job without setting this silently gets the worst loader.
- Sources: https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/overview/ · https://aps.autodesk.com/en/docs/model-derivative/v2/reference/http/job-POST/ · https://aps.autodesk.com/blog/model-derivative-api-ifc-svf2-translation-method-v4-and-migration-tips

**Mobile:** the official System Requirements page has a **Desktop section only** — no mention of mobile/iOS/Android/tablet anywhere in its text. Mobile works in practice (the changelog is full of iOS/Android fixes) but Autodesk publishes no mobile commitment. Documented hard limit: *"BoxSelection does not work on touch devices (e.g. mobile)."*
- Source: https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/requirements/

**4D API is good** (`setThemingColor(dbId, color, model, recursive)`, `hide`/`show`/`isolate`, `getExternalIdMapping`), with one trap: *"Object IDs should never be used for anything except 'per-job' operations… if you require persistent IDs, use externalId."*

---

### 2.5 Speckle

`@speckle/viewer` is **Apache-2.0** (npm, v2.31.14, 2026-06-15). The GitHub repo reads `NOASSERTION` because the LICENSE is split: Apache-2.0 *except* `packages/server/modules/workspaces/` and `packages/server/modules/gatekeeper/`, which are under a separate **Speckle Enterprise Edition** license.

**Rejected on architecture, not licensing.** The viewer physically cannot open a `.ifc`. Its loader directory contains exactly two loaders — `OBJ/` and `Speckle/` — and its dependency list has no IFC parser. IFC ingestion is a **Python microservice** (`packages/ifc-import-service`, depending on `specklepy[speckleifc]` → `ifcopenshell>=0.8.2`) that polls a Postgres `backgroundjob` table. Running it means Speckle server + Postgres + Redis + MinIO + a Python worker as mandatory infrastructure, just to see a model.

*(Correction to a common belief: the Rust/wasm IFC parser is not Speckle's — an `org:specklesystems` search for `rust` returns zero repos. That's `ifc-lite`, unrelated. See §2.7.)*

Its 4D API is genuinely the nicest of the bunch — `FilteringExtension.setUserObjectColors([{objectIds, color}])`, documented as *"much more performant than applying multiple materials per color"* — but not worth the infrastructure.
- Sources: https://github.com/specklesystems/speckle-server/tree/main/packages/ifc-import-service · https://github.com/specklesystems/speckleifc · https://docs.speckle.systems/developers/viewer/extensions/filtering-extension-api

---

### 2.6 Bentley iTwin.js, VIM, IfcOpenShell wasm

- **iTwin.js** — **MIT**, very active (`@itwin/core-frontend` 5.12.0, 2026-08-03), and works offline via "snapshot" iModels (*"When you create a Snapshot iModel, you implicitly opt-out of enforcement of any user or application authentication"*). Best mobile story of anyone — first-party MIT iOS/Android SDKs. **But there is no IFC connector.** The supported connector list is *"MicroStation (.dgn), AutoCAD (.dwg), Revit (.rvt), OpenBridge Designer, OpenBuilding Designer"*. Bentley offers IFC *export* from an iModel — the wrong direction. You'd be running a Windows desktop Bentley Synchronizer per uploaded file. Dead on arrival for a web upload flow.
  - Sources: https://www.itwinjs.org/learning/backend/accessingimodels/ · https://www.itwinjs.org/learning/imodel-connectors/
- **VIM** — `vim-webgl-viewer` is MIT but **archived (`"archived": true`, last push 2024-12-09)**. Successor `vim-web` is npm `1.0.0-beta.2` (2026-04-15). Conversion is mandatory, Windows-only, and **paid**: *"Before you can use the VIM IFC converter, you must install a VIM license file."* Rejected twice over.
  - Sources: https://github.com/vimaec/vim-webgl-viewer · https://docs.vimaec.com/docs/vim-for-developers/command-line-tools/vim-ifc-converter
- **IfcOpenShell wasm** — **LGPL-3.0**, very healthy repo, but the official wasm distribution is **Pyodide wheels** (`IfcOpenShell/wasm-wheels`), i.e. shipping a full Python interpreter to the browser. `wasm-preview` is archived (2023-04-01). It's a geometry/API engine, not a renderer: no camera, no scene, no per-element colour. Wrong tool.
  - Sources: https://github.com/IfcOpenShell/IfcOpenShell · https://github.com/IfcOpenShell/wasm-wheels

### 2.7 Worth a bookmark, not a bet: `ifc-lite`

`LTplus-AG/ifc-lite` — **MPL-2.0**, a genuine Rust→wasm IFC parser with a WebGPU renderer. Extremely active (v4.3.0, 2026-08-03). Claims IFC2X3/IFC4/IFC4X3/IFC5 and ~260 KB gzipped — which would be a 4x improvement on web-ifc's payload if true. **Risks:** repo created 2026-01-10 (seven months old), effectively a single contributor, viewer package still `0.2.11` pre-1.0, and a WebGPU dependency that is a real question mark on the mid-range Android devices we care about. Revisit in 2027.
- Sources: https://github.com/LTplus-AG/ifc-lite · https://www.npmjs.com/package/@ifc-lite/wasm

---

## 3. Recommendation

### 1. **ThatOpen — `@thatopen/components` (MIT) + `web-ifc` (MPL-2.0) + `@thatopen/fragments` (MIT)**

It is the only candidate that satisfies every hard constraint simultaneously: permissive licensing with no network-copyleft, no mandatory cloud, no per-use fees, an open-source converter, client-side IFC parse, proven IFC2X3 **and** IFC4 parsers in the shipped bundle, and a documented per-element colour API that does exactly what the 4D timeline needs. Ship it as a `React.lazy` route chunk. Convert IFC → `.frag` once on upload (client-side), persist the `.frag` to the existing Supabase `documents` bucket via the backend-mediated upload path, and load `.frag` on every subsequent view — that follows their own production guidance and turns a slow one-time parse into a fast repeat load, without introducing a server-side converter or a vendor.

### 2. **three.js + web-ifc directly**

The fallback if `@thatopen/components` proves too heavy or too opinionated on mobile. Same engine, same licenses, ~300–400 KB gzip lighter, but you inherit instanced-mesh batching, BVH picking, and colour-override plumbing. Only worth it if a real-device test shows components specifically is the bottleneck.

### 3. **APS Viewer**

Only if client models turn out to be predominantly Revit/Navisworks rather than IFC, where Autodesk's translation fidelity is genuinely better and worth $4.50/model. Accept in exchange: an un-bundleable CDN script, three.js R71, no offline story, and ToS §7.1 hanging over how prominently you feature it.

**Honest trade-offs.** The recommendation is not free of risk, and the risk is concentrated in one place: **mobile**. ThatOpen publishes no mobile support statement, and ~937 KB gzip of parser plus the memory cost of parsing a real civil IFC on a mid-range Android is exactly the kind of thing that works fine on a desktop dev machine and then OOMs mobile Safari on site. Nobody in this comparison has a verified mobile IFC story except iTwin.js, which can't read IFC. That means the *first* thing to build is not the viewer — it's a throwaway spike that loads a representative client IFC on a real mid-range phone and watches memory. If that fails, the answer is almost certainly server-side `.frag` conversion (the converter is MIT, so this stays vendor-free) with the phone only ever loading pre-converted fragments — which is a change of *where* conversion runs, not a change of library. That's the honest reason to prefer ThatOpen over xeokit even setting licensing aside: it's the only option where "move the conversion to the server" is a deployment decision rather than a procurement one. The second trade-off is smaller: web-ifc is MPL-2.0, so if we ever patch web-ifc itself (not just use it), those patches must be published. Consuming it unmodified from npm carries no such obligation.

---

## 4. Claims I could NOT verify from primary sources

Being explicit, as asked:

1. **Mobile support for ThatOpen, xeokit, and Speckle.** No primary-source mobile statement exists for any of them. All are WebGL2 so they *should* run, but wasm memory ceilings on mobile Safari are the real risk. **This is the single biggest unverified item and it's load-bearing for our use case.** Needs a real-device test.
2. **Memory behaviour on large models** for every candidate. I found no primary benchmark for any of them. All "handles huge models" claims are vendor marketing. Not measured by me.
3. **xeokit commercial license pricing.** `xeokit.io/pricing.html` 404s; the wiki points at an anchor on their homepage. Quote-based via `contact@creoox.com`. No dollar figure verified.
4. **web-ifc's per-entity coverage within IFC2X3/IFC4.** I proved both schemas have dedicated parsers via the shipped `SchemaNames` table, but no primary source publishes an entity-level coverage matrix — "supports IFC2x3" does not mean "renders every IFC2x3 entity correctly."
5. **APS: IFC GlobalId ↔ externalId equivalence.** Docs name only Revit UniqueId and AutoCAD Handle. The IFC GUID is reachable as a *property* (`GLOBALID` on legacy, `IfcGUID` on modern/v3) but the v4 loader's property name is undocumented. Would need a spike before designing a 4D data model on it.
6. **Whether APS SVF/SVF2 geometry streaming is metered.** The billable "Basic Interactions" list excludes it, but no primary statement says streaming is free. The "viewed any number of times at no additional cost" quote is from 2020 and predates the Dec-2025 repricing.
7. **`ifc-lite`'s performance claims** (5× faster, 260 KB gzip, IFC5 support) — from the project's own marketing, not independently benchmarked.
8. **iTwin.js per-element colour API** — not located; I stopped once the IFC-connector blocker made it moot.
9. **Actual gzip transfer size of `@thatopen/components` and `@thatopen/fragments`** — I measured web-ifc's real payload from its tarball, but did not build a representative Vite bundle to measure post-tree-shaking size of components + three.js. The ~937 KB figure is the *parser only*; total route-chunk size will be larger and should be measured against our own bundle budget before committing.
