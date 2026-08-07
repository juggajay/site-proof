// Clancy's product knowledge: a backend mirror of the in-app documentation in
// frontend/src/pages/docs/documentationContent.ts, flattened to retrievable
// { slug, title, body } topics. Backend vitest cannot import frontend TS, so
// this is a hand-kept copy — the title/slug list is pinned on BOTH sides
// (productKnowledge.test.ts here and documentationContent.test.ts in the
// frontend) and the two pins must be updated together, on purpose. See the
// activityTaxonomy pinned-equality convention.

export interface HelpTopic {
  slug: string;
  title: string;
  body: string;
}

// One topic per documentationSection. `slug` === the section id, `title` ===
// the section title, `body` === the section's summary, steps, and tips verbatim.
//
// Wave C1: the test-frequency sentences in `readiness`, `itp-holdpoints-tests`,
// and `admin` landed here first (the sufficiency engine shipped without doc copy
// and Clancy answered "why does this lot need 6 tests?" with nothing) and the
// frontend sections now carry the same prose — the mirror is whole again. Every
// claim is grounded in the shipped engine
// (backend/src/lib/readiness/sufficiency/) and pinned below in
// productKnowledge.test.ts, and again in the frontend's
// documentationContent.test.ts — do not soften one without rechecking the code
// and changing both sides together.
//
// Wave C3 (exit item 12) adds the map's Testing overlay and the sample point to
// `site-map` and `itp-holdpoints-tests`, on the same terms: every sentence is
// grounded in shipped code (routes/projectTestCoverage.ts,
// frontend testCoverageData.ts, frontend lib/samplePoint.ts) and pinned below.
//
// Wave E (exit item 13) adds the automatic chase to `itp-holdpoints-tests` on
// the same terms. The gap it closes is sharper than a missing paragraph: Clancy
// knew the MANUAL hold-point flow well and had no idea an automatic one now
// exists, so "does CIVOS chase the superintendent for us?" answered as if E1/E2
// had never shipped. Every sentence is grounded — the cadence and caps in
// notificationAutomation/holdPointChaseAutomation.ts, the awaiting status in
// readiness/predicates.ts, the reissuance terminators in chaseCore.ts, the
// alert in notificationAutomation/systemAutomation.ts, and the public-link
// disclosure limits in holdpoints/publicReleasePayload.ts + publicBatchRoutes.ts
// after E.0a — and pinned below. The canary sentence is load-bearing: the
// automation is inert until a project is named, so copy that promised it
// unconditionally would be false on every project today.
export const HELP_TOPICS: readonly HelpTopic[] = [
  {
    slug: 'getting-started',
    title: 'Getting started: your first project',
    body: [
      'The whole path from a new account to a finished job — set up, inspect, claim, and hand over.',
      "Create the project. Add the project workspace with its number, client and state, then put your team on it from the project's Users page — field crew as foremen, office staff as project or quality managers. Someone who has never used CIVOS is invited to the company first, under Company Settings, Team Members.",
      "Bring in the survey. Import the surveyor's alignment (LandXML or DXF) under Control Lines, and register the drawings under Plan Sheets — a GeoPDF registers itself; any other PDF is placed by matching control points to their grid coordinates.",
      'Create lots. Use Bulk Create Lots to generate lots along a control line from chainage and offsets, assigning an ITP template to every lot in the same pass. Switch the register to Map to see the job on satellite.',
      'Run the quality loop. Complete ITP checks with photo evidence, request hold point releases — the superintendent releases from a secure email link — and upload lab certificates, which CIVOS reads into test results for your review.',
      'Keep the daily record. The diary captures weather, crew, plant and work, with deliveries logged from the phone. The foreman shell is phone-first, and field capture keeps working offline.',
      'Bring subbies on. Invite subcontractor companies from the Subcontractors page. They work in their own portal, and their dockets flow to your Docket Approvals queue.',
      'Claim and hand over. Conform finished lots, build progress claims from them and generate an evidence package to send with each one, then finish with per-lot evidence folios and the project handover export.',
      'Tips:',
      '- Lot budgets must be set before a lot can be claimed — add them early.',
      '- Subcontractor portal accounts are free — inviting a subbie never costs them or you anything.',
      '- The Evidence Readiness panel on every lot lists what still blocks conformance or claiming. When in doubt, start there.',
      "- Once work starts moving, the map's Past view replays the job as it was on any date.",
      '- Ask Clancy at any step — it can explain any module and take you to the right page.',
    ].join('\n'),
  },
  {
    slug: 'projects-lots',
    title: 'Projects and lots',
    body: [
      'Create the project workspace and structure work into claimable, inspectable lots.',
      'Create or open a project. Use Projects to create the workspace, set the project number, client details, status, and navigation module shortcuts.',
      'Create lots from the Lots register. Add lot number, area, chainage, layer, activity, budget amount, and subcontractor assignment where relevant.',
      'Use lot status as the workflow signal. Not started, in progress, ready for inspection, conformed, and claimed statuses drive dashboards, reports, and claim eligibility.',
      'Tips:',
      '- Use lot numbers that match site records and progress claim schedules.',
      '- Add budgets before conformance if the lot will be claimed.',
      '- Assign subcontractors at lot level when they need portal work or docket access.',
      '- Bulk Create Lots can assign an ITP template to every lot and draw its map footprint from a control line and chainage in one pass.',
    ].join('\n'),
  },
  {
    slug: 'site-map',
    title: 'Site map and lot geometry',
    body: [
      'See lots on a satellite map, place them from control lines or plan sheets, and check coverage.',
      'Open the map view. Switch the Lot Register to Map to see each lot as a shape on satellite imagery, coloured by status, with control lines and a status legend.',
      'Place lots on the map. Generate lot footprints from a control line and chainage, import an alignment from LandXML or DXF, trace a lot off a plan sheet, or draw one by hand.',
      'Read imagery, coverage, testing, photos, and history. Use Layers to show up to two ready drone orthophotos with separate opacity controls, Testing to recolour drawn lots by test frequency, Test pins to show where samples were taken, Coverage to find chainage gaps, Find by area to list lots in a box, Photos to pin GPS-tagged site photos, and Past view to scrub lot status by date.',
      'Tips:',
      '- The Testing layer recolours drawn lots with the same three-valued test frequency verdict the lot page shows: green for Testing satisfied, amber for Fewer tests than required, and grey for No rule. Lots that are not drawn are counted, not coloured, and the panel says how many. Testing is an internal layer that subcontractors never see, and it is unavailable in Past view because a live verdict has no meaning against a past date.',
      '- The Test pins layer shows a pin only where someone captured a sample point on a test. Nothing is derived, so a test recorded with a chainage description and no captured coordinate is counted toward the frequency but never drawn. The pin gives the coordinate and how it was captured, such as GPS plus or minus 6 m, or Picked on map.',
      '- Overlay registered plan sheets on the imagery and blend the paper away so only the linework shows.',
      '- Drone orthophotos appear in Layers after background tiling finishes. Up to two can be shown together, each with its own opacity; Past view does not automatically switch imagery by flight date.',
      '- Tiles, plan sheets, and map data you have already viewed stay available offline; there is no bulk pre-download.',
      '- Snapshot the map to save it into project Documents, ready to attach to a conformance pack or claim.',
      '- Subcontractors see only the lots assigned to their company on the map.',
      '- The satellite lot map is also available in the foreman mobile shell.',
    ].join('\n'),
  },
  {
    slug: 'readiness',
    title: 'Evidence Readiness',
    body: [
      'See the exact blockers, warnings, and supporting evidence for conformance and claims.',
      'Open a lot readiness panel. The lot page shows action blockers, warnings, and support items. Blockers explain what must be fixed before the next action.',
      'Follow the action links. Readiness actions scroll to the relevant lot tab, such as ITP, tests, hold points, documents, or commercial fields.',
      'Review claim readiness before selection. The Create Claim modal disables only lots with true action blockers and explains why each lot can or cannot be selected.',
      'Check the test frequency count. Where the project state and specification set resolve a governing specification — VicRoads Section 204 for Victorian earthworks, TfNSW Q6 for NSW earthworks and pavements — readiness shows how many compaction tests the lot requires against how many verified passing tests it has.',
      'Tips:',
      '- Blockers stop the action. Warnings do not stop the action but should be reviewed.',
      '- Hold points are claim evidence blockers, not conformance blockers.',
      '- Force Conform is an admin override and requires an audit reason.',
      '- The required test count comes from the lot activity and its testing scale, which NSW projects call Specified relative compaction. In NSW the count also varies with the lot area, taken from the lot quantity in square metres or from its drawn geometry. Victorian earthworks lots need 6 compaction tests on Compaction Scale A or B and 3 on Scale C, and Scale A applies where the specification does not state one.',
      '- Test frequency checking is advisory on every project today. It can be set to block per project, which stops a lot short of its required count being conformed.',
      '- "Test frequency cannot be checked" means an input is missing. Set the lot activity, testing scale, and quantity, or draw the lot geometry, on the lot edit page.',
      '- After three consecutive conforming lots a VicRoads lot can become eligible to request a reduced frequency from the Superintendent. CIVOS reports the eligibility only and never reduces the count itself.',
    ].join('\n'),
  },
  {
    slug: 'itp-holdpoints-tests',
    title: 'ITPs, hold points, and test results',
    body: [
      'Attach inspection plans, complete checks, release hold points, and verify test evidence.',
      'Assign an ITP template. Use the lot ITP action to select a seeded template or project template matching the activity and specification set.',
      'Complete and verify quality items. Record checklist outcomes, upload supporting evidence, and verify test results before relying on them for claim evidence.',
      'Request and release hold points. Request release from the lot, then record release in-app or through the secure public hold point link.',
      'Tips:',
      '- A hold point waiting on the superintendent sits at Notified until it is released. That is the only status CIVOS treats as awaiting release.',
      '- CIVOS can chase the superintendent for you, but only on projects that have been switched on for it by name. Everywhere else nothing is sent automatically and you chase manually as before.',
      '- Where it is switched on, the first reminder goes out one working day before the scheduled release date and then every two working days while it stays overdue, up to three reminders per release request. Requesting release again starts a fresh request with a fresh three.',
      '- A reminder is one email per recipient per project per day, listing every hold point of yours they owe a decision on, each with its own live release link. They never get a second message that day, however many hold points fall due.',
      '- Each reminder mints a fresh link because the original one expires. Releasing the hold point, re-requesting it, closing the project, or removing that address from the notification list all stop the reminders.',
      '- Every automated reminder is written to the audit log, including the ones deliberately not sent.',
      '- A secure hold point link covers that one hold point only, and it shows the holder the lot, the hold point, the schedule, and the evidence package. It does not show them the other addresses the request went to, and it never shows the email address of the person who requested release — the release record and its PDF name that person or say Site Team.',
      '- Replies to a hold point email reach the person who requested the release. If that account is gone or inactive it goes to company support, and the email says so rather than putting their name on it.',
      '- On those same switched-on projects, a hold point still Notified more than a day past its scheduled date raises an internal Hold Point stale alert to the project team, at high severity and critical once it is two days past.',
      '- Superintendents work entirely from the emailed links. There is no CIVOS inbox or queue for them to sign into and no list of everything they owe you across projects.',
      '- Seeded jurisdictional templates are global and can be copied into a project.',
      '- Assigned the wrong ITP? It can be unassigned from the lot until work is recorded against it.',
      '- Test results count toward conformance once linked to their ITP checklist item and verified.',
      '- Where a governing specification sets a test frequency, only verified passing tests whose type is recognised for that rule count toward it. Density Ratio, AS 1289.5.4.1, and RC 316.00 all count as compaction; laboratory reference tests such as MDD never count toward the field test number. A "Verified tests not counted" warning means the test type is not recognised, not that the test is unlinked.',
      '- Recording where a sample was taken is optional and blocks nothing. On the test forms you can pick the point on a map or use your current GPS fix; a GPS fix coarser than 30 m is refused with its own accuracy shown rather than saved, and a map pick carries no accuracy figure. CIVOS never derives a sample location — no capture means no location, not a pin in the middle of the lot.',
      '- Send to lab records that a sample went to a laboratory, and the register then shows how long it has been waiting. Setting an expected result date is optional and marks the row overdue once that date passes; CIVOS never assumes a turnaround, so a blank date shows elapsed days only and is never flagged late.',
      '- Verified ITP and test records are protected from unsafe edits.',
      '- Failing an ITP checklist item online requires a photo of the issue first, and still raises an NCR automatically.',
      '- Hold point release and request events are written to the audit log.',
      '- The lot ITP checklist and lot edit form keep working offline and sync when you are back in coverage.',
    ].join('\n'),
  },
  {
    slug: 'subbie-dockets',
    title: 'Subcontractor portal and dockets',
    body: [
      'Invite subcontractors, assign lots, collect dockets, query them, and approve them.',
      'Invite and approve the subcontractor. Use the project Subcontractors page to invite the company, approve the row, and confirm portal access toggles.',
      'Assign work at lot level. Open the lot Assigned Subcontractors control and link the subcontractor company to the specific lot.',
      'Submit, query, respond, and approve dockets. The subcontractor submits labour and plant hours. The head contractor can query, approve, or reject from Docket Approvals.',
      'Tips:',
      '- Portal users should use separate accounts from head-contractor company users.',
      '- Fresh subbie work visibility depends on lot-stage assignment, not just project invite acceptance.',
      '- Approved dockets contribute to cost and reporting views.',
    ].join('\n'),
  },
  {
    slug: 'documents-drawings',
    title: 'Documents, drawings, and photos',
    body: [
      'Store project files, photos, drawings, and evidence where the work was performed.',
      'Upload supported files. Upload PDF, Word, Excel, Outlook email, image files, and other supported project document types through the Documents page.',
      'Attach evidence to work records. Use comments, test result certificates (printed as the Material Conformance Record), drawings, and document references to keep evidence close to the relevant lot or workflow.',
      'Use clear document types. Choose the document type that best matches the record so reports and handover packs are easy to filter later.',
      'Tips:',
      '- Unsupported file types return a specific rejection reason.',
      '- Production storage uses Supabase Storage through backend-controlled uploads.',
      '- Avoid uploading credentials, private keys, or unrelated personal data.',
      '- Photo capture and the daily diary pre-select the lot you are standing in from GPS — you can still change it.',
      '- GPS-tagged photos appear as pins on the site map when the Photos layer is on.',
      '- Documents filed under a commercial category are never visible in the subcontractor portal, even on work a subcontractor can otherwise see.',
    ].join('\n'),
  },
  {
    slug: 'ncr-diary',
    title: 'NCRs and daily diary',
    body: [
      'Track quality non-conformance and keep a daily record of work, weather, people, plant, and issues.',
      'Raise NCRs with evidence. Create NCRs from the project NCR page, add evidence, rectify the issue, send for review, and close only after verification.',
      'Submit daily diaries. Record work areas, labour, plant, weather, delays, and addendums from the Daily Diary module.',
      'Use addendums for late information. After submission, addendums preserve the historical diary while still recording later clarifications.',
      'Tips:',
      '- NCR state changes and evidence events are audited.',
      '- Diary submission locks the main record and uses addendums for later notes.',
      '- Docket approval can feed diary labour and plant where configured.',
      '- Tap the mic on diary and docket note fields to dictate instead of type (Australian English).',
    ].join('\n'),
  },
  {
    slug: 'deliveries',
    title: 'Deliveries and materials',
    body: [
      'Track every material delivery from the daily diary to the lot, with the supplier docket attached as evidence.',
      'Log deliveries in the daily diary. The foreman records a delivery with a photo of the supplier docket — or adds the photo later; the delivery saves either way. Dictation and offline capture work the same as the rest of the diary.',
      'Review the delivery register. Deliveries shows every delivery across the project with its lot link, batch or mix reference, and whether the supplier docket is on file. Supplier, lot-linked, docket-filed, and date filters all run on the server, so the counts are the truth.',
      'Attach evidence after the diary locks. The supplier docket, batch reference, and lot link can be attached to a delivery after the diary has locked — only those three evidence fields, and every change is written to the audit log.',
      'Tips:',
      '- "Docket filed" means the actual supplier docket document is attached. A typed docket number alone does not count.',
      '- The unlinked-delivery and missing-docket counters are project-wide totals that filters never shrink — they are the numbers to drive to zero before handover.',
      '- An unlinked delivery raises a support-level readiness prompt. It never blocks conformance or a claim.',
      '- An NCR can name the delivery that supplied the bad material — pick the delivery on the NCR create form and the link shows on the NCR and its PDF. The link is set at creation only.',
      '- The register sorts by the diary date the delivery was recorded against, so a late back-entry files where it happened, not at the top.',
      '- Deliveries are internal. Subcontractors never see the register.',
    ].join('\n'),
  },
  {
    slug: 'claims-reports',
    title: 'Claims, variations, costs, and reports',
    body: [
      'Turn conformed work and approved variations into progress claims, and use reports to prove the story behind the numbers.',
      'Create claims from ready lots. Only conformed, budgeted lots with remaining percentage can be selected. Readiness explains every disabled lot in the modal.',
      'Track variations from proposal to claim. Raise changed or extra work in the Variations register with evidence and a client reference. Once approved with a final amount, a variation can be added to a progress claim as its own line.',
      'Move through the claim lifecycle. Draft, submit, certify, dispute if contested, and record payment. Submitting records the date — download the evidence package PDF and send it to your client yourself.',
      'Use reports for review and handover. Reports bring together lot status, evidence, dockets, NCRs, claims, and project progress in one place.',
      'Tips:',
      '- Budget amount is required before a conformed lot can be claimed.',
      '- The evidence package PDF compiles ITPs, hold points, tests, NCRs, photos, and claimed variations per claim.',
      '- The Xero export produces a draft-invoice CSV with a line per lot and per variation.',
      '- The Costs page tracks labour and plant spend from approved dockets against lot budgets, broken down by subcontractor and by lot.',
      '- Reports can be scheduled to arrive by email on a recurring basis on Professional and Enterprise plans.',
      '- Reports are strongest when field teams maintain lots, dockets, tests, and diaries daily.',
    ].join('\n'),
  },
  {
    slug: 'handover',
    title: 'Handover and the evidence folio',
    body: [
      'Issue per-lot evidence folios and export the whole project as a verified handover package.',
      'Issue a lot evidence folio. From the lot page, issue a versioned folio PDF that brings together the lot tests, hold points, ITP completions, NCRs, deliveries, and a listing of the documents and photos held, with its SHA-256 hash shown in the app.',
      'Request the project handover export. Handover Exports assembles the whole project into one download — the snapshot is sized up front and refused if it is too large, then frozen in a single transaction, and the ZIP is hash-verified.',
      'Check closeout readiness first. The export page nudges when lots lack an evidence folio, but it never blocks the export.',
      'Tips:',
      '- Re-issuing a folio mints a new version. Version numbers are never reused and old versions are never overwritten.',
      '- A folio prints what is expected, present, and missing — and above 5,000 evidence rows it refuses to issue rather than silently omit records.',
      '- Requesting an export and issuing folios is owner, admin, project manager, and quality manager. Downloading a handover export is owner, admin, and project manager — plus the person who requested that export.',
      '- A handover export expires on its stated date and can no longer be downloaded after that — unless a legal hold has been placed on it, which keeps it downloadable.',
      '- Reports are the day-to-day review surface; the handover export is the end-of-job evidence package for the principal.',
    ].join('\n'),
  },
  {
    slug: 'admin',
    title: 'Admin, audit, and settings',
    body: [
      'Manage users, company settings, project settings, notifications, support, and the audit trail.',
      'Set company and project controls. Owners and admins manage company profile, project users, areas, navigation module shortcuts, specification sets, and commercial access.',
      'Review audit activity. Audit Log records critical workflow events, including lot changes, dockets, hold points, claims, portal access, and auth events.',
      'Use support when the workflow is blocked. The Support page submits tickets with configured contact details and provides direct support contact options.',
      'Tips:',
      '- Audit log search covers actions, entities, users, projects, and detail text.',
      '- Subcontractor portal access is separate from head-contractor company membership.',
      '- Use Notifications for pending approvals, queries, and workflow items that need attention.',
      '- Test Frequency Checking in the project General settings decides whether a lot short of its required test count is only warned about or cannot be conformed. It can be off, warn, or block, and is set per project.',
      '- Foremen and subcontractors use simplified mobile shells (foreman /m, subbie portal /p) rather than these office pages.',
    ].join('\n'),
  },
  {
    slug: 'ai-copilot',
    title: 'AI in CIVOS: setup copilot and Clancy',
    body: [
      'AI reads your drawings and answers questions — and every AI-prepared change goes to a human review queue before it touches the project.',
      'Run the setup copilot on a new project. From the project Copilot page, four stages read your drawings for you: project facts from the title block, control line from a setout sheet, plan sheet registration, and lot breakdown along the alignment. Each stage produces proposals you review and apply — nothing is written to the project until you approve it.',
      'Ask Clancy anything. Clancy is the chat copilot in the header (or press Ctrl+J / Cmd+J). He answers from live project data and this documentation — lot status, hold point and NCR counts, module summaries, ITP suggestions, and how-to help — and he can take you to the right page. He is available to owners, admins, and project managers, and he never changes records.',
      'Let AI lift data from paperwork. Test certificate uploads can extract results automatically, setout sheets can be imported as control lines, and lot ITP photo uploads are classified automatically. Voice dictation (Australian English) is available on diary and docket notes.',
      'Tips:',
      '- Every AI extraction lands in a review queue with an audit trail — approve, edit, or discard before anything is applied.',
      '- AI stages need the server AI to be configured; the lot breakdown stage is deterministic and works without it.',
      '- Clancy says plainly when he does not know or cannot do something — he never guesses project data.',
    ].join('\n'),
  },
  {
    slug: 'integrations',
    title: 'Integrations: API keys and webhooks',
    body: [
      'Connect your own systems: API keys pull data from the CIVOS REST API, webhooks push lot, hold point, and NCR events to your endpoint.',
      'Create an API key. From Company Settings, API keys. A key acts as the user who created it, with the same project access. Scopes limit what it can do: read allows viewing data only, write also allows creating and updating, admin allows everything. The full key is shown once at creation — store it somewhere safe.',
      'Call the REST API with the key. Send the key in an x-api-key header. It works against the same REST API the app uses, so anything you can see in the app — lots, tests, NCRs, dockets, claims — can be pulled into your own reports, dashboards, or spreadsheets.',
      'Add a webhook to hear about events. From Company Settings, Webhooks. Paste your endpoint URL; it subscribes to all supported lot, hold point, and NCR events, and CIVOS notifies that URL the moment each event happens. Every delivery is signed with HMAC-SHA256 using the signing secret shown at creation, so your system can verify the notification really came from CIVOS.',
      'Tips:',
      '- Supported webhook events: lot created, updated, and deleted; hold point release requested and released; NCR created and closed.',
      '- A read-scope key cannot change anything even if it leaks — prefer read unless you need more.',
      '- Keys support expiry dates and instant revocation, and creation and revocation are audit-logged.',
      '- An API key can never be used to create or manage other API keys.',
      '- Regenerate a webhook signing secret at any time from the webhook row.',
    ].join('\n'),
  },
] as const;

export const HELP_TOPIC_SLUGS = HELP_TOPICS.map((t) => t.slug);

const HELP_BY_SLUG = new Map(HELP_TOPICS.map((t) => [t.slug, t]));

export function getHelpTopic(slug: string): HelpTopic | undefined {
  return HELP_BY_SLUG.get(slug);
}
