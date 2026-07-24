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
export const HELP_TOPICS: readonly HelpTopic[] = [
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
      'Read coverage, photos, and history. Use Coverage to find chainage gaps, Find by area to list lots in a box, Photos to pin GPS-tagged site photos, and History to scrub lot status by date.',
      'Tips:',
      '- Overlay registered plan sheets on the imagery and blend the paper away so only the linework shows.',
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
      'Tips:',
      '- Blockers stop the action. Warnings do not stop the action but should be reviewed.',
      '- Hold points are claim evidence blockers, not conformance blockers.',
      '- Force Conform is an admin override and requires an audit reason.',
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
      '- Seeded jurisdictional templates are global and can be copied into a project.',
      '- Assigned the wrong ITP? It can be unassigned from the lot until work is recorded against it.',
      '- Test results count toward conformance once linked to their ITP checklist item and verified.',
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
