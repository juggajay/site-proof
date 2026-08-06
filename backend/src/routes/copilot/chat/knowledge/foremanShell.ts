import type { PageKnowledge } from './types.js';

const FOREMAN_ROLES =
  'Internal project users using the phone-first foreman shell; project permissions still apply.';
const CHROME = `Shared shell controls: the top-left CIVOS mark returns home where it is a link; the sun/moon control switches theme; the sync chip opens queued/failed offline work and offers Retry; inner-screen **Back** always returns to the named parent screen. Home also has **Sign out**, which warns before leaving when unsynced work exists.`;

export const FOREMAN_SHELL_KNOWLEDGE = [
  {
    route: 'm',
    title: 'Foreman Home',
    keywords: [
      'photos banner foreman',
      'amber photos banner',
      'take a photo',
      'daily diary hero',
      'unfiled photos',
      'field hub',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Foreman Home is the phone-first site hub. ${CHROME}

The Daily Diary hero opens today's guided diary and shows its current step/submitted state. **Lots**, **Dockets**, **Issues** and **Drawings & Docs** tiles open those work areas; their chips show live work such as checks due, dockets to approve or issues open. **Take a photo** opens capture and can file the photo to a lot.

The amber photos banner means one or more captured project photos are not linked to a lot yet. Tapping it opens Photos on the Unfiled view so the foreman can file them; it disappears when the last one is filed. It is a housekeeping warning, not a quality hold or failed upload. A separate upload-failure state appears in Photos/Sync. If no project is assigned, **View Projects** replaces the dead hub.`,
  },
  {
    route: 'm/diary',
    title: 'Foreman Diary Path',
    keywords: [
      'diary steps',
      'record weather',
      'log crew plant',
      'add today work',
      'review submit',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `The Diary Path is the four-step field checklist for today's diary. ${CHROME}

Weather, Crew & Plant, Work and Review nodes open their screens and show complete/in-progress/not-started state. The bottom action always opens the next owed step: **Record weather**, **Log crew & plant**, **Add today's work** or **Review & submit**. Once submitted the path is read-only and labels the diary SUBMITTED.`,
  },
  {
    route: 'm/diary/weather',
    title: 'Foreman Diary Weather',
    keywords: ['save weather', 'weather conditions', 'temperature', 'rainfall', 'fetch weather'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Weather records site conditions for the selected diary day. ${CHROME}

Condition tiles choose the weather description. Temperature, rainfall and notes inputs capture manual observations; fetch/refresh weather fills available observed data without submitting the diary. **Save weather** stores the step and returns to the diary path. Submitted diaries disable editing.`,
  },
  {
    route: 'm/diary/crew',
    title: 'Foreman Diary Crew and Plant',
    keywords: [
      'add person plant',
      'copy yesterday crew',
      'copy yesterday plant',
      'crew entry',
      'plant entry',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Crew & Plant records who and what worked that day. ${CHROME}

**Add person or plant** opens the entry sheet. **Copy yesterday's crew** and **Copy yesterday's plant** bring prior rows forward separately. Tapping a row edits it while the diary is open; its remove control deletes it after confirmation where required. Submitted diaries make rows read-only.`,
  },
  {
    route: 'm/diary/work',
    title: 'Foreman Diary Work',
    keywords: ['add activity', 'add delay', 'add delivery', 'add event', 'delete work entry'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Diary Work collects the day's Activities, Delays, Deliveries and Events. ${CHROME}

The four add tiles open the matching form. Tapping an existing entry edits it when the diary is open. Delete is two-step: the first tap arms the action and the second confirms, reducing accidental glove taps. The bottom **Review diary** action appears after work is ready and opens Review. Submitted entries are read-only.`,
  },
  {
    route: 'm/diary/work/activity',
    title: 'Foreman Activity Form',
    keywords: ['save activity', 'activity description', 'lot allocation', 'hours', 'show more'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Activity records a work activity against today's diary. ${CHROME}

Description is the main required field. **More details** reveals activity type, lot, hours/progress and notes fields. **Save activity** creates or updates the entry and returns to Work; it is disabled while invalid/saving or after submission.`,
  },
  {
    route: 'm/diary/work/delay',
    title: 'Foreman Delay Form',
    keywords: ['save delay', 'delay type', 'hours lost', 'impact', 'show more'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Delay records time lost and its cause in today's diary. ${CHROME}

Cause tiles choose the delay type and Description explains what happened. **More details** reveals duration/start time, lot and impact. **Save delay** creates or updates the entry and returns to Work; submitted diaries cannot be changed here.`,
  },
  {
    route: 'm/diary/work/delivery',
    title: 'Foreman Delivery Form',
    keywords: ['save delivery', 'supplier', 'docket number', 'batch reference', 'delivery lot'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Delivery records a load received on site. ${CHROME}

The description/supplier fields capture the delivery. **More details** reveals supplier docket number, batch reference, quantity, lot and notes. **Save delivery** returns to Work. Typing a docket number is not the same as attaching the supplier docket document; that evidence can be fixed from the office Delivery Register.`,
  },
  {
    route: 'm/diary/work/event',
    title: 'Foreman Event Form',
    keywords: ['save event', 'site event', 'inspection event', 'visitor', 'show more'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Event records a notable site occurrence that is not an activity, delay or delivery. ${CHROME}

Event-type tiles classify it and Description records what occurred. **More details** reveals extra notes and lot/category fields. **Save event** creates or updates the row and returns to Work.`,
  },
  {
    route: 'm/diary/review',
    title: 'Foreman Diary Review',
    keywords: [
      'slide to submit diary',
      'submit diary',
      'start today diary',
      'offline queued',
      'diary review',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Diary Review is the final read-through before the day's record locks. ${CHROME}

Summary cards open Weather, Crew or Work for correction. If no diary exists, **Start today's diary** opens Weather. **Slide to submit the diary** is the deliberate primary gesture; keyboard/accessibility users have **Submit diary**. Online submission locks the record. Offline submission queues it, opens Done with a queued message and leaves Sync responsible for delivery.`,
  },
  {
    route: 'm/diary/done',
    title: 'Foreman Diary Submitted',
    keywords: [
      'diary done',
      'submitted confirmation',
      'queued offline',
      'back to home',
      'sync status',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Done confirms that the diary was submitted or safely queued offline. ${CHROME}

The message distinguishes server-confirmed submission from queued work. **Done/Back to home** replaces the diary flow with Foreman Home so a refresh does not resubmit it. The Sync chip remains the place to monitor an offline queue.`,
  },
  {
    route: 'm/lots',
    title: 'Foreman Lots',
    keywords: ['lot cards', 'checks due', 'hold point badge', 'open lot map', 'conformed'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Foreman Lots is the field-friendly list of assigned/accessible lots. ${CHROME}

**Open the lot map** switches to the spatial view. Each lot card opens its lot hub and shows status plus useful chips such as checks due, hold point or conformed. The list has no create/edit controls; office lot management remains in the full register. Retry reloads failed data.`,
  },
  {
    route: 'm/lots/map',
    title: 'Foreman Lot Map',
    keywords: ['mobile lot map', 'satellite map', 'map layers', 'lot popup', 'locate lot'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Lot Map shows accessible lot geometry in the field and opens lot details from a polygon. ${CHROME}

It reuses the map's pan, zoom, locate, layers and lot-popup controls within the shell. Selecting a lot popup opens that lot. The foreman does not get office-only Draw Lot/setup controls unless their actual role permits them. If no project is selected, the page explains that instead of showing an empty map.`,
  },
  {
    route: 'm/lots/<lotId>',
    title: 'Foreman Lot Hub',
    keywords: [
      'continue inspections',
      'governing revision superseded',
      'lot photos',
      'drawings for lot',
      'details status',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `The Lot Hub is the foreman's menu for one lot. ${CHROME}

**Continue inspections — N due** opens the next ITP work and appears when checks remain. Tiles open **Inspections**, Photos scoped to this lot, Drawings scoped to this lot, and read-only **Details & status**. A Governing revision superseded banner warns that a referenced drawing moved on; it is informational and does not itself block conforming the lot.`,
  },
  {
    route: 'm/lots/<lotId>/itp',
    title: 'Foreman ITP Run',
    keywords: [
      'pass check',
      'fail check',
      'not applicable',
      'add evidence photo',
      'photo recommended',
      'hold point',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `ITP Run is the swipe/scrub field workflow through a lot's checklist. ${CHROME}

The dot track and whole-screen drag move between checks. **Pass**, **Fail** and **N/A** record the outcome allowed for the item. Failing or marking N/A opens a reason sheet; failure requires an issue photo. **Add evidence photo** attaches evidence; the amber recommended banner offers Add photo or Continue without one when photo evidence is advisory. Hold-point items route to the hold-point action instead of pretending the foreman can self-release them. **Back to lot** returns to the hub. Locked/verification-pending items show their state instead of active controls.`,
  },
  {
    route: 'm/lots/<lotId>/details',
    title: 'Foreman Lot Details',
    keywords: [
      'lot readiness mobile',
      'what is left',
      'ready for office',
      'open issues',
      'read only',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Lot Details gives a read-only field summary of status, activity, chainage and evidence progress. ${CHROME}

What's left explains checks, failed items, hold points, tests and open issues still owed. Ready for the office means field capture is complete enough for office review; it does not itself conform the lot. There are no conform/override/edit controls on this screen.`,
  },
  {
    route: 'm/dockets',
    title: 'Foreman Dockets',
    keywords: [
      'docket status filter',
      'pending approval',
      'docket cards',
      'approved dockets',
      'queried dockets',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Foreman Dockets lists project dockets, open-first for field review. ${CHROME}

Status chips filter All, Pending, Approved, Queried and Rejected states. Tapping a docket card opens its detail. This list does not change a docket by itself; available approval actions live on the detail screen.`,
  },
  {
    route: 'm/dockets/<docketId>',
    title: 'Foreman Docket Detail',
    keywords: [
      'approve docket mobile',
      'adjust hours',
      'send query',
      'reject docket',
      'docket detail',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Docket Detail shows the submitted labour, plant, lot allocations and totals. ${CHROME}

The main **Approve** button accepts the unadjusted docket when allowed. **Adjust hours** opens an approval form with revised hours. **Query** opens the message form; **Reject** opens the rejection reason. Final or inaccessible dockets are read-only. Retry reloads detail after a fetch error.`,
  },
  {
    route: 'm/dockets/<docketId>/adjust',
    title: 'Foreman Adjust Docket Hours',
    keywords: [
      'approve adjusted hours',
      'labour hours',
      'plant hours',
      'approval note',
      'original hours',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Adjust Hours approves a docket with explicitly revised labour or plant hours. ${CHROME}

Hour inputs change the approved values while retaining the submitted originals; the note explains the adjustment. **Approve with adjusted hours** submits the decision and returns to the docket list, and is disabled while invalid or saving.`,
  },
  {
    route: 'm/dockets/<docketId>/query',
    title: 'Foreman Query Docket',
    keywords: [
      'send docket query',
      'query message',
      'return to subbie',
      'required question',
      'queried docket',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Query Docket returns the docket to the subcontractor with a question. ${CHROME}

The message textarea is required. **Send query** records the query, changes the docket state and returns to the list; it is disabled while empty or sending.`,
  },
  {
    route: 'm/dockets/<docketId>/reject',
    title: 'Foreman Reject Docket',
    keywords: [
      'reject docket reason',
      'docket rejection',
      'decline docket',
      'required reason',
      'docket decision',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Reject Docket records why the submitted docket cannot be accepted. ${CHROME}

The reason textarea is required. **Reject docket** is destructive-looking by design, submits the rejection and returns to the list; it is disabled while empty or saving.`,
  },
  {
    route: 'm/issues',
    title: 'Foreman Issues',
    keywords: ['raise issue', 'ncr filter mobile', 'open issues', 'issue status', 'camera capture'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Issues is the phone list of NCRs and defects visible to the foreman. ${CHROME}

Status chips filter the list. Each issue card opens its detail and shows severity/status. **Raise an issue** opens camera-first capture for a new issue rather than silently creating an NCR. Retry reloads failed data.`,
  },
  {
    route: 'm/issues/<ncrId>',
    title: 'Foreman Issue Detail',
    keywords: [
      'respond to ncr foreman',
      'add issue photo',
      'open evidence',
      'before after evidence',
      'responsible user',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Issue Detail shows an NCR's description, responsibility, dates and before/after evidence. ${CHROME}

**Respond** appears only when this foreman is the responsible user; it opens proposed action, root cause and response fields and submits them. **Add photo** captures more evidence. Evidence buttons securely open the associated image/file. The screen does not expose office-only review, QM approval, concession or close actions.`,
  },
  {
    route: 'm/photos',
    title: 'Foreman Photos',
    keywords: ['all photos', 'unfiled filter', 'retry upload', 'photo grid', 'offline photos'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Photos is the recent-first project photo grid, including offline captures. ${CHROME}

**All** and **Unfiled** filter chips switch the grid. Tapping a photo opens detail. A failed pending upload exposes **Retry upload** and requires signal; refresh reloads server photos. When opened from a lot, the list stays scoped to that lot.`,
  },
  {
    route: 'm/photos/<documentId>',
    title: 'Foreman Photo Detail',
    keywords: ['file photo to lot', 'unfiled', 'upload failed', 'retry photo', 'photo detail'],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Photo Detail shows the full image, caption, date, GPS and filing/upload state. ${CHROME}

For an uploaded unfiled photo, **File to a lot** opens the lot picker; it is disabled offline because filing is a server change. A failed local upload shows **Retry upload**. UPLOADING, UPLOAD FAILED, UNFILED and lot pills describe distinct states—an unfiled photo can be uploaded successfully but still need a lot link.`,
  },
  {
    route: 'm/docs',
    title: 'Foreman Drawings and Documents',
    keywords: [
      'search drawings mobile',
      'current revision',
      'open drawing',
      'acknowledge drawing',
      'field documents',
    ],
    roles: FOREMAN_ROLES,
    surface: 'foreman-shell',
    body: `Drawings & Docs is a view-focused field register for current drawings, specifications and lot-filed drawing documents. ${CHROME}

Search filters by drawing number/title. Tapping a card opens its local detail sheet with current revision and revision context; **Open drawing** launches the secured PDF/image in the device viewer. Where acknowledgement is offered it records that the foreman saw the revision. There is no upload, supersede, delete or status-change control in this shell. A lotId entry scopes the list to that lot.`,
  },
] satisfies readonly PageKnowledge[];
