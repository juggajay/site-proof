# Foreman Mobile Browser Test Plan (v2)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Exhaustively test every feature of the SiteProof foreman mobile UI using Playwright MCP browser tools — happy paths, negative paths, validation, data flows, and visual states.

**Architecture:** Browser-based manual testing using Playwright MCP tools. Each task tests a discrete feature area with pass/fail criteria. Test data is seeded via API before UI testing begins so every tab has real data to interact with.

**Tech Stack:** Playwright MCP browser tools, local dev (frontend :5174, backend :4008)

**Test Credentials:** `foreman@test.com` / `password123`
**Project:** "highway upgrade" (ID: `457af21a-16bf-49e7-a23b-c467af933e7e`)
**Project URL Base:** `http://localhost:5174/projects/457af21a-16bf-49e7-a23b-c467af933e7e`

---

## Prerequisites

Before starting any task:
1. Backend running at `http://localhost:4008`
2. Frontend running at `http://localhost:5174`
3. Foreman test user exists (`foreman@test.com` / `password123`)
4. Browser resized to 375x812 (mobile viewport)

---

## PHASE 1: SETUP & DATA SEEDING

### Task 1: Browser Setup & Mobile Viewport

**Goal:** Configure the browser for mobile testing.

**Step 1: Resize browser to mobile viewport**
- Tool: `browser_resize` → width: 375, height: 812

**Step 2: Navigate to app**
- Tool: `browser_navigate` → url: `http://localhost:5174`
- Expected: App loads (login page or dashboard)

**Step 3: Screenshot to confirm mobile viewport**
- Tool: `browser_take_screenshot` → filename: `test-01-mobile-viewport.png`

**Step 4: Snapshot the page**
- Tool: `browser_snapshot`
- Expected: Page accessibility tree visible at mobile width

---

### Task 2: Login Flow — Happy Path

**Goal:** Log in as foreman user and verify authentication.

**Step 1: Navigate to login page**
- Tool: `browser_navigate` → url: `http://localhost:5174/login`

**Step 2: Snapshot login page**
- Tool: `browser_snapshot`
- Expected: Email input (id="email"), password input (id="password"), "Sign In" button, "Remember me" checkbox

**Step 3: Fill login form**
- Tool: `browser_fill_form` → fields:
  - name: "Email", type: "textbox", ref: [email input ref], value: "foreman@test.com"
  - name: "Password", type: "textbox", ref: [password input ref], value: "password123"

**Step 4: Click Sign In**
- Tool: `browser_click` → ref: [Sign In button ref], element: "Sign In button"

**Step 5: Wait for redirect**
- Tool: `browser_wait_for` → time: 3

**Step 6: Snapshot post-login page**
- Tool: `browser_snapshot`
- Expected: Dashboard or project selection visible. User authenticated.

**Step 7: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-02-post-login.png`

---

### Task 3: Login Flow — Negative Path (Wrong Password)

**Goal:** Verify login rejects invalid credentials with a clear error message.

**Step 1: Navigate to login page**
- Tool: `browser_navigate` → url: `http://localhost:5174/login`

**Step 2: Snapshot login page**
- Tool: `browser_snapshot`

**Step 3: Fill form with wrong password**
- Tool: `browser_fill_form` → fields:
  - name: "Email", type: "textbox", ref: [email ref], value: "foreman@test.com"
  - name: "Password", type: "textbox", ref: [password ref], value: "wrongpassword99"

**Step 4: Click Sign In**
- Tool: `browser_click` → ref: [Sign In ref], element: "Sign In button"

**Step 5: Wait for error**
- Tool: `browser_wait_for` → time: 2

**Step 6: Snapshot error state**
- Tool: `browser_snapshot`
- Expected: Error alert visible with "Invalid email or password" or similar message. Still on login page.

**Step 7: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-03-login-error.png`

**Step 8: Log in correctly for remaining tests**
- Tool: `browser_fill_form` → fields:
  - name: "Email", type: "textbox", ref: [email ref], value: "foreman@test.com"
  - name: "Password", type: "textbox", ref: [password ref], value: "password123"
- Tool: `browser_click` → ref: [Sign In ref], element: "Sign In button"
- Tool: `browser_wait_for` → time: 3

---

### Task 4: Seed Test Data via API

**Goal:** Create lots, dockets, and diary data so all tabs have content to test against.

**Step 1: Get auth token**
- Tool: `browser_evaluate` → function: `() => { const auth = localStorage.getItem('siteproof_auth'); return auth ? JSON.parse(auth).token : null; }`
- Expected: JWT token string returned. Store this for API calls.

**Step 2: Create test lots via API**
- Tool: `browser_evaluate` → function:
```javascript
() => {
  const auth = JSON.parse(localStorage.getItem('siteproof_auth'));
  const projectId = '457af21a-16bf-49e7-a23b-c467af933e7e';
  const lots = [
    { projectId, lotNumber: 'LOT-TEST-001', description: 'Earthworks Stage 1', activityType: 'Earthworks', lotType: 'chainage', chainageStart: 0, chainageEnd: 500 },
    { projectId, lotNumber: 'LOT-TEST-002', description: 'Drainage Stage 1', activityType: 'Drainage', lotType: 'chainage', chainageStart: 500, chainageEnd: 1000 },
    { projectId, lotNumber: 'LOT-TEST-003', description: 'Pavement Stage 1', activityType: 'Pavement', lotType: 'chainage', chainageStart: 1000, chainageEnd: 1500 }
  ];
  return Promise.all(lots.map(lot =>
    fetch('/api/lots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth.token },
      body: JSON.stringify(lot)
    }).then(r => r.json().then(d => ({ status: r.status, id: d.id || d.lot?.id, lotNumber: lot.lotNumber })))
  ));
}
```
- Expected: 3 lots created (or 409 if already exist). Record lot IDs.

**Step 3: Create test docket via API**
- Tool: `browser_evaluate` → function:
```javascript
() => {
  const auth = JSON.parse(localStorage.getItem('siteproof_auth'));
  const projectId = '457af21a-16bf-49e7-a23b-c467af933e7e';
  return fetch('/api/dockets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth.token },
    body: JSON.stringify({
      projectId,
      date: new Date().toISOString().split('T')[0],
      labourHours: 24,
      plantHours: 8,
      notes: 'Test docket for foreman approval'
    })
  }).then(r => r.json().then(d => ({ status: r.status, data: d })));
}
```
- Expected: Docket created. Record docket ID and status.

**Step 4: Verify seeded data**
- Tool: `browser_evaluate` → function:
```javascript
() => {
  const auth = JSON.parse(localStorage.getItem('siteproof_auth'));
  const projectId = '457af21a-16bf-49e7-a23b-c467af933e7e';
  return Promise.all([
    fetch('/api/lots?projectId=' + projectId, { headers: { 'Authorization': 'Bearer ' + auth.token } }).then(r => r.json()),
    fetch('/api/dockets?projectId=' + projectId, { headers: { 'Authorization': 'Bearer ' + auth.token } }).then(r => r.json()),
  ]).then(([lots, dockets]) => ({
    lotCount: Array.isArray(lots) ? lots.length : lots.lots?.length || 0,
    docketCount: Array.isArray(dockets) ? dockets.length : dockets.dockets?.length || 0
  }));
}
```
- Expected: At least 3 lots and 1 docket exist.

---

## PHASE 2: FOREMAN SHELL & NAVIGATION

### Task 5: Navigate to Project & Verify Foreman Mobile Shell

**Goal:** Confirm the 5-tab foreman bottom nav appears.

**Step 1: Navigate to foreman view**
- Tool: `browser_navigate` → url: `http://localhost:5174/projects/457af21a-16bf-49e7-a23b-c467af933e7e/foreman/today`

**Step 2: Wait for load**
- Tool: `browser_wait_for` → time: 3

**Step 3: Snapshot**
- Tool: `browser_snapshot`
- Expected: Bottom navigation with 5 tabs: "Today", "Approve", "Capture" (center elevated), "Diary", "Lots". Today tab active/highlighted.

**Step 4: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-05-foreman-shell.png`

---

### Task 6: Tab Navigation — All 5 Tabs

**Goal:** Verify all tabs navigate correctly and show active state.

**Step 1: Click Approve tab**
- Tool: `browser_snapshot` (to get refs)
- Tool: `browser_click` → ref: [Approve tab ref], element: "Approve tab"
- Tool: `browser_wait_for` → time: 2
- Tool: `browser_snapshot`
- Expected: Approve page visible, "Approve" header, filter pills. Approve tab highlighted.

**Step 2: Screenshot Approve**
- Tool: `browser_take_screenshot` → filename: `test-06-approve-tab.png`

**Step 3: Click Diary tab**
- Tool: `browser_click` → ref: [Diary tab ref], element: "Diary tab"
- Tool: `browser_wait_for` → time: 2
- Tool: `browser_snapshot`
- Expected: Diary mobile view with date header, lot selector, weather bar, quick-add chips. Diary tab highlighted.

**Step 4: Screenshot Diary**
- Tool: `browser_take_screenshot` → filename: `test-06-diary-tab.png`

**Step 5: Click Lots tab**
- Tool: `browser_click` → ref: [Lots tab ref], element: "Lots tab"
- Tool: `browser_wait_for` → time: 2
- Tool: `browser_snapshot`
- Expected: Lots page with lot list. Status badges: pending=amber, in_progress=sky, completed=emerald. Lots tab highlighted.

**Step 6: Screenshot Lots**
- Tool: `browser_take_screenshot` → filename: `test-06-lots-tab.png`

**Step 7: Click Capture button (center)**
- Tool: `browser_click` → ref: [Capture button ref], element: "Capture camera button"
- Tool: `browser_wait_for` → time: 1
- Tool: `browser_snapshot`
- Expected: CaptureModal opens with "Opening camera..." or "Open Camera" fallback button and "Cancel" button.

**Step 8: Screenshot Capture modal**
- Tool: `browser_take_screenshot` → filename: `test-06-capture-modal.png`

**Step 9: Close Capture modal**
- Tool: `browser_click` → ref: [Cancel button ref], element: "Cancel button"
- Expected: Modal closes

**Step 10: Click Today tab**
- Tool: `browser_click` → ref: [Today tab ref], element: "Today tab"
- Tool: `browser_wait_for` → time: 2
- Tool: `browser_snapshot`
- Expected: Today worklist visible. Today tab highlighted. Full navigation cycle complete.

---

### Task 7: Responsive Behavior — Desktop vs Mobile

**Goal:** Verify foreman nav only appears at mobile viewport.

**Step 1: Confirm mobile state**
- Tool: `browser_snapshot`
- Expected: Foreman 5-tab bottom nav visible

**Step 2: Resize to desktop (1280x800)**
- Tool: `browser_resize` → width: 1280, height: 800
- Tool: `browser_wait_for` → time: 2

**Step 3: Snapshot desktop layout**
- Tool: `browser_snapshot`
- Expected: Standard desktop navigation (sidebar). Foreman 5-tab bottom nav NOT present.

**Step 4: Screenshot desktop**
- Tool: `browser_take_screenshot` → filename: `test-07-desktop-view.png`

**Step 5: Resize back to mobile (375x812)**
- Tool: `browser_resize` → width: 375, height: 812
- Tool: `browser_wait_for` → time: 2

**Step 6: Snapshot mobile restored**
- Tool: `browser_snapshot`
- Expected: Foreman 5-tab bottom nav reappears

**Step 7: Screenshot mobile restored**
- Tool: `browser_take_screenshot` → filename: `test-07-mobile-restored.png`

---

## PHASE 3: TODAY WORKLIST

### Task 8: Today Worklist — Content & Empty States

**Goal:** Verify Today tab displays worklist sections or empty state correctly.

**Step 1: Navigate to Today**
- Tool: `browser_navigate` → url: `http://localhost:5174/projects/457af21a-16bf-49e7-a23b-c467af933e7e/foreman/today`
- Tool: `browser_wait_for` → time: 3

**Step 2: Snapshot**
- Tool: `browser_snapshot`
- Expected: One of:
  - **Content sections**: "Blocking Work" (red), "Due Today" (amber), "Coming Up" (blue) with items
  - **Empty state**: "You're all caught up" + "No hold points, inspections, or ITP items need your attention right now." + "Check again" button
  - **Loading**: "Loading your worklist..."
  - **Error**: Error message + "Try again" button

**Step 3: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-08-today-worklist.png`

**Step 4: Test refresh button**
- If empty state: click "Check again" button
- If error state: click "Try again" button
- Tool: `browser_click` → ref: [refresh button ref], element: "Check again / Try again button"
- Tool: `browser_wait_for` → time: 2
- Tool: `browser_snapshot`
- Expected: Page re-fetches data without error

**Step 5: Verify badge count on Today tab**
- From snapshot, check if the Today tab in the bottom nav shows a badge count
- Expected: Badge shows count of blocking + due items (or no badge if 0)

---

## PHASE 4: DOCKET APPROVALS

### Task 9: Docket Approvals — Filter Pills

**Goal:** Test all 4 filter pills on the Approve tab.

**Step 1: Navigate to Approve tab**
- Tool: `browser_click` → ref: [Approve tab ref], element: "Approve tab"
- Tool: `browser_wait_for` → time: 2

**Step 2: Snapshot**
- Tool: `browser_snapshot`
- Expected: Filter pills visible: "All", "Pending" (or "Pending (N)"), "Approved", "Rejected"

**Step 3: Click "All" filter**
- Tool: `browser_click` → ref: [All pill ref], element: "All filter pill"
- Tool: `browser_snapshot`
- Expected: Shows all dockets. Stats line: "N total · Xh labour · Yh plant"

**Step 4: Click "Pending" filter**
- Tool: `browser_click` → ref: [Pending pill ref], element: "Pending filter pill"
- Tool: `browser_snapshot`
- Expected: Only pending dockets shown, or "All caught up" / "No dockets waiting for your review"

**Step 5: Click "Approved" filter**
- Tool: `browser_click` → ref: [Approved pill ref], element: "Approved filter pill"
- Tool: `browser_snapshot`
- Expected: Only approved dockets, or "No dockets found"

**Step 6: Click "Rejected" filter**
- Tool: `browser_click` → ref: [Rejected pill ref], element: "Rejected filter pill"
- Tool: `browser_snapshot`
- Expected: Only rejected dockets, or "No dockets found"

**Step 7: Screenshot final filter state**
- Tool: `browser_take_screenshot` → filename: `test-09-approve-filters.png`

---

### Task 10: Docket Approval — Approve Action

**Goal:** Actually approve a pending docket and verify the action completes.

**Step 1: Switch to Pending filter**
- Tool: `browser_click` → ref: [Pending pill ref], element: "Pending filter pill"
- Tool: `browser_wait_for` → time: 2
- Tool: `browser_snapshot`

**Step 2: Check if pending dockets exist**
- If "All caught up" or no dockets: record as BLOCKED (no test data) and skip
- If docket card visible: proceed

**Step 3: Look for approve action on docket card**
- Swipe-right reveals green "Approve" action. Since Playwright may not support swipe well, try:
  - Tool: `browser_drag` → startRef: [card ref], startElement: "Docket card", endRef: [card ref shifted right], endElement: "Docket card right edge"
  - OR look for any tap-based approve button
- Tool: `browser_snapshot`
- Expected: Approve action visible (green)

**Step 4: Click Approve**
- Tool: `browser_click` → ref: [Approve action ref], element: "Approve button"
- Tool: `browser_wait_for` → time: 2

**Step 5: Snapshot after approval**
- Tool: `browser_snapshot`
- Expected: Either:
  - Approval modal appears with fields (Adjusted Labour Hours, Plant Hours, notes)
  - OR docket status changes to "Approved" directly

**Step 6: If modal, fill and confirm**
- Fill any required fields and click confirm button
- Tool: `browser_wait_for` → time: 2

**Step 7: Verify docket approved**
- Tool: `browser_snapshot`
- Expected: Docket moved from pending list. Check "Approved" filter to confirm it appears there.

**Step 8: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-10-docket-approved.png`

---

### Task 11: Docket Rejection — Reject Action

**Goal:** Reject a pending docket and verify rejection reason is required.

**Step 1: Switch to Pending filter**
- Tool: `browser_click` → ref: [Pending pill ref], element: "Pending filter pill"
- Tool: `browser_wait_for` → time: 2
- Tool: `browser_snapshot`

**Step 2: Check if pending dockets exist**
- If none: record as BLOCKED and skip
- If exists: proceed

**Step 3: Look for reject action (swipe left reveals red "Reject")**
- Try drag or look for tap alternative
- Tool: `browser_snapshot`

**Step 4: Click Reject**
- Tool: `browser_click` → ref: [Reject action ref], element: "Reject button"
- Tool: `browser_wait_for` → time: 1

**Step 5: Snapshot rejection modal**
- Tool: `browser_snapshot`
- Expected: Modal with "Rejection Reason *" field (required), "Cancel" and "Reject" buttons

**Step 6: Try submitting without reason (validation test)**
- Tool: `browser_click` → ref: [Reject confirm ref], element: "Reject confirm button"
- Tool: `browser_snapshot`
- Expected: Validation error — rejection reason is required

**Step 7: Fill rejection reason and submit**
- Tool: `browser_type` → ref: [reason field ref], text: "Work does not match site records"
- Tool: `browser_click` → ref: [Reject confirm ref], element: "Reject confirm button"
- Tool: `browser_wait_for` → time: 2

**Step 8: Verify rejection**
- Tool: `browser_snapshot`
- Expected: Docket moved from pending. Check "Rejected" filter.

**Step 9: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-11-docket-rejected.png`

---

## PHASE 5: DIARY — COMPONENTS

### Task 12: Diary — Lot Selector

**Goal:** Test the lot selector dropdown.

**Step 1: Navigate to Diary tab**
- Tool: `browser_click` → ref: [Diary tab ref], element: "Diary tab"
- Tool: `browser_wait_for` → time: 3

**Step 2: Snapshot to find lot selector**
- Tool: `browser_snapshot`
- Expected: Lot selector button: "All Lots" or "Lot {N}"

**Step 3: Click lot selector**
- Tool: `browser_click` → ref: [lot selector ref], element: "Lot selector"
- Tool: `browser_snapshot`
- Expected: Dropdown opens with "All Lots" + individual lot options (LOT-TEST-001, etc.)

**Step 4: Select a specific lot**
- Tool: `browser_click` → ref: [first lot option ref], element: "Lot option"
- Expected: Dropdown closes, button text updates, timeline filters to that lot

**Step 5: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-12-lot-selector.png`

**Step 6: Reset to All Lots**
- Click lot selector, select "All Lots"
- Expected: Shows all entries again

---

### Task 13: Diary — Weather Bar

**Goal:** Test weather bar display and interaction.

**Step 1: Snapshot to find weather bar**
- Tool: `browser_snapshot`
- Expected: One of:
  - Weather data: "{conditions} · {min}°–{max}°C · {rainfall}mm" + "Edit" link
  - No weather: "Tap to add weather"
  - Loading: "Fetching weather..."

**Step 2: Click edit or add weather**
- If weather exists: Tool: `browser_click` → ref: [Edit ref], element: "Edit weather"
- If no weather: Tool: `browser_click` → ref: [add ref], element: "Tap to add weather"
- Expected: Weather input form appears

**Step 3: Snapshot weather form**
- Tool: `browser_snapshot`
- Expected: Weather condition fields visible (conditions, temp min/max, rainfall)

**Step 4: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-13-weather-bar.png`

---

### Task 14: Diary — Docket Summary Card

**Goal:** Test collapsible docket summary card.

**Step 1: Snapshot**
- Tool: `browser_snapshot`
- Expected: Docket summary section. One of:
  - Summary: "{N} workers · {N} machines · {N} pending" (expandable)
  - No dockets: "No dockets yet today" + "Add manually" button
  - Loading: "Loading docket data..."

**Step 2: If summary exists, click to expand**
- Tool: `browser_click` → ref: [summary header ref], element: "Docket summary header"
- Tool: `browser_snapshot`
- Expected: Expanded with approved docket details (✓ subcontractor, workers, hours) and/or pending (⏰)

**Step 3: Click to collapse**
- Tool: `browser_click` → ref: [summary header ref], element: "Docket summary header"
- Tool: `browser_snapshot`
- Expected: Collapsed to single line

**Step 4: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-14-docket-summary.png`

---

## PHASE 6: DIARY — ADDING ENTRIES (HAPPY PATH + VALIDATION)

### Task 15: Add Activity — Happy Path + Suggestion Chips

**Goal:** Test adding an activity, including suggestion chips and "More details" expansion.

**Step 1: Snapshot quick-add bar**
- Tool: `browser_snapshot`
- Expected: Chips visible: "Activity", "Delay", "Delivery", "Plant", "Event", "+ More"

**Step 2: Click "Activity" chip**
- Tool: `browser_click` → ref: [Activity chip ref], element: "Activity chip"
- Tool: `browser_snapshot`
- Expected: Bottom sheet with title "Add Activity", description field (placeholder: "What work was done?"), suggestion chips (up to 6), "More details" toggle, "Save Activity" button (green)

**Step 3: Test suggestion chip (if visible)**
- If suggestion chips exist: click the first one
- Tool: `browser_click` → ref: [first suggestion chip ref], element: "Activity suggestion chip"
- Tool: `browser_snapshot`
- Expected: Description field auto-populated with suggestion text. Suggestion chips disappear.

**Step 4: Clear and type custom description**
- Clear the field and type custom text
- Tool: `browser_type` → ref: [description ref], text: "Concrete pouring for footings - Bay 3"

**Step 5: Expand "More details"**
- Tool: `browser_click` → ref: [More details ref], element: "More details toggle"
- Tool: `browser_snapshot`
- Expected: Additional fields: Lot (dropdown), Quantity (number), Unit (text), Notes (textarea)

**Step 6: Fill optional fields**
- Tool: `browser_type` → ref: [quantity ref], text: "15"
- Tool: `browser_type` → ref: [unit ref], text: "m3"

**Step 7: Save**
- Tool: `browser_click` → ref: [Save Activity ref], element: "Save Activity button"
- Tool: `browser_wait_for` → time: 2

**Step 8: Verify in timeline**
- Tool: `browser_snapshot`
- Expected: Activity entry with orange "Activity" label, "Concrete pouring for footings - Bay 3", timestamp

**Step 9: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-15-activity-added.png`

---

### Task 16: Add Activity — Validation (Empty Required Field)

**Goal:** Verify the form rejects empty required description.

**Step 1: Click "Activity" chip**
- Tool: `browser_click` → ref: [Activity chip ref], element: "Activity chip"
- Tool: `browser_snapshot`

**Step 2: Click Save without filling description**
- Tool: `browser_click` → ref: [Save Activity ref], element: "Save Activity button"
- Tool: `browser_wait_for` → time: 1

**Step 3: Snapshot validation state**
- Tool: `browser_snapshot`
- Expected: Either:
  - Validation error message on description field
  - Button stays disabled / no action
  - Sheet stays open (does not save)
- MUST NOT: Sheet closes and empty entry added to timeline

**Step 4: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-16-activity-validation.png`

**Step 5: Close sheet**
- Tool: `browser_press_key` → key: "Escape"

---

### Task 17: Add Delay — Happy Path + Type Selection

**Goal:** Test adding a delay with type selection.

**Step 1: Click "Delay" chip**
- Tool: `browser_click` → ref: [Delay chip ref], element: "Delay chip"
- Tool: `browser_snapshot`
- Expected: Sheet with "Add Delay", delay type buttons (Weather, Equipment, Material, Subcontractor, Safety, Other), description field, "More details", "Save Delay"

**Step 2: Select delay type "Weather"**
- Tool: `browser_click` → ref: [Weather type ref], element: "Weather delay type"
- Expected: Weather button highlighted

**Step 3: Fill description**
- Tool: `browser_type` → ref: [description ref], text: "Heavy rain stopped excavation work"

**Step 4: Expand and fill duration**
- Tool: `browser_click` → ref: [More details ref], element: "More details"
- Tool: `browser_type` → ref: [duration ref], text: "3.5"

**Step 5: Save**
- Tool: `browser_click` → ref: [Save Delay ref], element: "Save Delay button"
- Tool: `browser_wait_for` → time: 2

**Step 6: Verify in timeline**
- Tool: `browser_snapshot`
- Expected: Red "Delay" label, "Heavy rain stopped excavation work", "3.5h — Weather"

**Step 7: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-17-delay-added.png`

---

### Task 18: Add Delay — Validation (Missing Type + Description)

**Goal:** Verify delay form requires both type and description.

**Step 1: Click "Delay" chip**
- Tool: `browser_click` → ref: [Delay chip ref], element: "Delay chip"

**Step 2: Click Save without selecting type or filling description**
- Tool: `browser_click` → ref: [Save Delay ref], element: "Save Delay button"
- Tool: `browser_wait_for` → time: 1

**Step 3: Snapshot**
- Tool: `browser_snapshot`
- Expected: Validation errors. Sheet stays open.

**Step 4: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-18-delay-validation.png`

**Step 5: Close sheet**
- Tool: `browser_press_key` → key: "Escape"

---

### Task 19: Add Delivery — Happy Path

**Goal:** Test adding a delivery entry with all fields.

**Step 1: Click "Delivery" chip**
- Tool: `browser_click` → ref: [Delivery chip ref], element: "Delivery chip"
- Tool: `browser_snapshot`
- Expected: "Add Delivery" sheet. Fields: Description* ("What was delivered?"), Supplier ("Supplier name"), Docket Number ("e.g. DEL-001"), "More details", "Save Delivery"

**Step 2: Fill fields**
- Tool: `browser_type` → ref: [description ref], text: "20mm aggregate"
- Tool: `browser_type` → ref: [supplier ref], text: "Boral Materials"
- Tool: `browser_type` → ref: [docket number ref], text: "DEL-042"

**Step 3: Expand and fill optional**
- Tool: `browser_click` → ref: [More details ref], element: "More details"
- Tool: `browser_type` → ref: [quantity ref], text: "25"
- Tool: `browser_type` → ref: [unit ref], text: "tonnes"

**Step 4: Save**
- Tool: `browser_click` → ref: [Save Delivery ref], element: "Save Delivery button"
- Tool: `browser_wait_for` → time: 2

**Step 5: Verify in timeline**
- Tool: `browser_snapshot`
- Expected: Blue "Delivery" label, "20mm aggregate", "Boral Materials · 25 tonnes"

**Step 6: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-19-delivery-added.png`

---

### Task 20: Add Event — Happy Path

**Goal:** Test adding an event with type selection.

**Step 1: Click "Event" chip**
- Tool: `browser_click` → ref: [Event chip ref], element: "Event chip"
- Tool: `browser_snapshot`
- Expected: "Add Event" sheet. Event type buttons (Visitor, Safety, Instruction, Variation, Other), Description* ("What happened?"), Notes, Lot, "Save Event"

**Step 2: Select "Safety" type**
- Tool: `browser_click` → ref: [Safety ref], element: "Safety event type"

**Step 3: Fill description and notes**
- Tool: `browser_type` → ref: [description ref], text: "Toolbox talk - working at heights"
- Tool: `browser_type` → ref: [notes ref], text: "All crew attended. No incidents."

**Step 4: Save**
- Tool: `browser_click` → ref: [Save Event ref], element: "Save Event button"
- Tool: `browser_wait_for` → time: 2

**Step 5: Verify in timeline**
- Tool: `browser_snapshot`
- Expected: Purple "Event" label, "Toolbox talk - working at heights", "Safety"

**Step 6: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-20-event-added.png`

---

### Task 21: Add Manual Labour & Plant — Happy Path

**Goal:** Test adding personnel and plant entries.

**Step 1: Click "Plant" chip**
- Tool: `browser_click` → ref: [Plant chip ref], element: "Plant chip"
- Tool: `browser_snapshot`
- Expected: "Add Labour / Plant" sheet. Tip banner: "Tip: Labour and plant auto-populate from approved dockets." Two sections: PERSONNEL and PLANT / EQUIPMENT.

**Step 2: Fill personnel**
- Tool: `browser_type` → ref: [name ref], text: "Mike Johnson"
- Tool: `browser_type` → ref: [company ref], text: "ABC Construction"
- Tool: `browser_type` → ref: [role ref], text: "Labourer"
- Tool: `browser_type` → ref: [hours ref], text: "8"

**Step 3: Save Personnel**
- Tool: `browser_click` → ref: [Save Personnel ref], element: "Save Personnel button"
- Tool: `browser_wait_for` → time: 2
- Tool: `browser_snapshot`
- Expected: Form resets for next entry

**Step 4: Fill plant**
- Tool: `browser_type` → ref: [plant description ref], text: "CAT 320 Excavator"
- Tool: `browser_type` → ref: [id rego ref], text: "EXC-042"
- Tool: `browser_type` → ref: [plant company ref], text: "XYZ Plant Hire"
- Tool: `browser_type` → ref: [hours operated ref], text: "6.5"

**Step 5: Save Plant**
- Tool: `browser_click` → ref: [Save Plant ref], element: "Save Plant button"
- Tool: `browser_wait_for` → time: 2

**Step 6: Close sheet and verify timeline**
- Tool: `browser_press_key` → key: "Escape"
- Tool: `browser_snapshot`
- Expected: Personnel entry (emerald) and Plant entry (gray) in timeline

**Step 7: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-21-labour-plant-added.png`

---

### Task 22: Add Labour — Validation (Empty Name)

**Goal:** Verify personnel save requires name.

**Step 1: Click "Plant" chip to open Labour/Plant sheet**
- Tool: `browser_click` → ref: [Plant chip ref], element: "Plant chip"

**Step 2: Click "Save Personnel" without filling name**
- Tool: `browser_click` → ref: [Save Personnel ref], element: "Save Personnel button"
- Tool: `browser_wait_for` → time: 1

**Step 3: Snapshot**
- Tool: `browser_snapshot`
- Expected: Validation error on Name field. Form does not save.

**Step 4: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-22-labour-validation.png`

**Step 5: Close**
- Tool: `browser_press_key` → key: "Escape"

---

## PHASE 7: DIARY — TIMELINE INTERACTIONS

### Task 23: Timeline — Full Entry Verification

**Goal:** Verify the complete timeline shows all entries from Phase 6 in chronological order.

**Step 1: Snapshot full timeline**
- Tool: `browser_snapshot`
- Expected: All entries from Tasks 15-21:
  - Activity (orange): "Concrete pouring for footings - Bay 3"
  - Delay (red): "Heavy rain stopped excavation work"
  - Delivery (blue): "20mm aggregate"
  - Event (purple): "Toolbox talk - working at heights"
  - Personnel (emerald): "Mike Johnson"
  - Plant (gray): "CAT 320 Excavator"
- Each entry has: timestamp, type label, description

**Step 2: Full page screenshot**
- Tool: `browser_take_screenshot` → filename: `test-23-full-timeline.png`, fullPage: true

---

### Task 24: Timeline — Delete Entry

**Goal:** Delete a timeline entry and verify removal.

**Step 1: Snapshot to identify an entry to delete**
- Tool: `browser_snapshot`
- Pick a non-critical entry (e.g., the plant entry "CAT 320 Excavator")

**Step 2: Attempt to reveal delete action**
- Try swipe left using drag:
  - Tool: `browser_drag` → startRef: [entry ref], startElement: "Plant entry", endRef: [shifted left target], endElement: "Left edge"
- OR try clicking entry to see if actions appear
- Tool: `browser_snapshot`

**Step 3: If delete visible, click Delete**
- Tool: `browser_click` → ref: [Delete ref], element: "Delete action"
- Tool: `browser_wait_for` → time: 2

**Step 4: Verify removal**
- Tool: `browser_snapshot`
- Expected: "CAT 320 Excavator" entry no longer in timeline

**Step 5: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-24-entry-deleted.png`

---

### Task 25: Timeline — Edit Entry (Tap to Edit)

**Goal:** Test edit action on a timeline entry.

**Step 1: Snapshot**
- Tool: `browser_snapshot`
- Pick an entry (e.g., the activity "Concrete pouring for footings - Bay 3")

**Step 2: Click on the entry (tap-to-edit)**
- Tool: `browser_click` → ref: [activity entry ref], element: "Activity entry card"
- Tool: `browser_wait_for` → time: 1

**Step 3: Snapshot**
- Tool: `browser_snapshot`
- Expected: One of:
  - Edit bottom sheet opens with pre-populated fields
  - Entry detail view with edit option
  - No action (edit not yet implemented — record as NOT IMPLEMENTED)

**Step 4: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-25-edit-entry.png`

**Step 5: Close any open sheet**
- Tool: `browser_press_key` → key: "Escape"

---

### Task 26: Pull-to-Refresh on Diary

**Goal:** Test pull-to-refresh gesture on diary timeline.

**Step 1: Simulate pull-to-refresh via touch events**
- Tool: `browser_run_code` → code:
```javascript
async (page) => {
  const diary = await page.locator('[data-pull-refresh], main, .overflow-auto').first();
  const box = await diary.boundingBox();
  if (!box) return 'No scrollable element found';
  const startX = box.x + box.width / 2;
  const startY = box.y + 20;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Pull down 100px (above 80px threshold)
  for (let i = 0; i < 10; i++) {
    await page.mouse.move(startX, startY + (i * 10));
    await new Promise(r => setTimeout(r, 50));
  }
  await page.mouse.up();
  await new Promise(r => setTimeout(r, 2000));
  return 'Pull-to-refresh gesture completed';
}
```
- Expected: Refresh indicator appears (white circle with arrow/spinner), data reloads

**Step 2: Snapshot after refresh**
- Tool: `browser_snapshot`
- Expected: Timeline data refreshed (same content, no errors)

**Step 3: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-26-pull-refresh.png`

---

## PHASE 8: DIARY — SUBMISSION & READ-ONLY

### Task 27: Diary Submission Flow

**Goal:** Submit the diary and verify it becomes read-only.

**Step 1: Look for submission trigger**
- Tool: `browser_snapshot`
- Look for a "Finish" or "Submit" button in the diary view, or access via `browser_evaluate`:
- Tool: `browser_evaluate` → function:
```javascript
() => {
  const auth = JSON.parse(localStorage.getItem('siteproof_auth'));
  const projectId = '457af21a-16bf-49e7-a23b-c467af933e7e';
  const today = new Date().toISOString().split('T')[0];
  return fetch('/api/diary?projectId=' + projectId, {
    headers: { 'Authorization': 'Bearer ' + auth.token }
  }).then(r => r.json()).then(data => {
    const diaries = Array.isArray(data) ? data : data.diaries || [];
    const todayDiary = diaries.find(d => d.date?.startsWith(today));
    return todayDiary ? { id: todayDiary.id, status: todayDiary.status } : 'No diary for today';
  });
}
```
- Expected: Diary ID returned with status "draft"

**Step 2: Submit diary via API (to test read-only UI)**
- Tool: `browser_evaluate` → function:
```javascript
() => {
  const auth = JSON.parse(localStorage.getItem('siteproof_auth'));
  const projectId = '457af21a-16bf-49e7-a23b-c467af933e7e';
  const today = new Date().toISOString().split('T')[0];
  return fetch('/api/diary?projectId=' + projectId, {
    headers: { 'Authorization': 'Bearer ' + auth.token }
  }).then(r => r.json()).then(data => {
    const diaries = Array.isArray(data) ? data : data.diaries || [];
    const todayDiary = diaries.find(d => d.date?.startsWith(today));
    if (!todayDiary) return 'No diary found';
    return fetch('/api/diary/' + todayDiary.id + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth.token },
      body: JSON.stringify({ acknowledgeWarnings: true })
    }).then(r => r.json().then(d => ({ status: r.status, data: d })));
  });
}
```
- Expected: Diary submitted successfully

**Step 3: Reload diary page**
- Tool: `browser_navigate` → url: `http://localhost:5174/projects/457af21a-16bf-49e7-a23b-c467af933e7e/diary`
- Tool: `browser_wait_for` → time: 3

**Step 4: Snapshot submitted diary**
- Tool: `browser_snapshot`
- Expected:
  - Green "Submitted" badge in header
  - Quick-add chip bar HIDDEN (no Activity/Delay/etc chips)
  - Timeline entries visible but NOT interactive (no swipe actions)

**Step 5: Verify chips are hidden**
- From snapshot, confirm "Activity", "Delay", "Delivery" chips are NOT present
- Expected: Quick-add bar returns null when submitted

**Step 6: Try clicking a timeline entry**
- Tool: `browser_click` → ref: [any entry ref], element: "Timeline entry on submitted diary"
- Tool: `browser_snapshot`
- Expected: No edit sheet opens. Entry is read-only.

**Step 7: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-27-submitted-diary.png`

---

### Task 28: Diary — Date Navigation (Non-Today Date)

**Goal:** Test viewing a diary for a different date.

**Step 1: Check if date navigation is available**
- Tool: `browser_snapshot`
- Look for calendar icon, date picker, or arrow buttons near the date header

**Step 2: If date picker exists, click it**
- Tool: `browser_click` → ref: [date/calendar ref], element: "Date picker"
- Tool: `browser_snapshot`
- Expected: Calendar view with navigable days

**Step 3: Select yesterday's date**
- Find yesterday in the calendar and click it
- Tool: `browser_click` → ref: [yesterday date ref], element: "Yesterday's date"
- Tool: `browser_wait_for` → time: 2

**Step 4: Snapshot non-today diary**
- Tool: `browser_snapshot`
- Expected: One of:
  - "Not today" indicator in gray text
  - "No diary for this date" + "Switch to today to start recording"
  - Yesterday's diary entries (if one exists)

**Step 5: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-28-date-navigation.png`

**Step 6: Navigate back to today**
- Click today's date or "today" shortcut
- Tool: `browser_wait_for` → time: 2
- Tool: `browser_snapshot`
- Expected: Today's diary visible again

---

## PHASE 9: BOTTOM SHEET INTERACTIONS

### Task 29: Bottom Sheet — Close via X Button

**Goal:** Test closing bottom sheets via the X close button.

**Step 1: Open Activity sheet**
- Tool: `browser_click` → ref: [Activity chip ref], element: "Activity chip"
- Tool: `browser_snapshot`
- Expected: Bottom sheet open

**Step 2: Click X close button**
- Tool: `browser_click` → ref: [X close ref], element: "Close button"
- Tool: `browser_snapshot`
- Expected: Sheet closed. No overlay visible.

---

### Task 30: Bottom Sheet — Close via Escape Key

**Goal:** Test closing via Escape key.

**Step 1: Open Delay sheet**
- Tool: `browser_click` → ref: [Delay chip ref], element: "Delay chip"
- Tool: `browser_snapshot`

**Step 2: Press Escape**
- Tool: `browser_press_key` → key: "Escape"
- Tool: `browser_snapshot`
- Expected: Sheet closed

---

### Task 31: Bottom Sheet — Close via Backdrop Tap

**Goal:** Test closing by tapping the dark backdrop.

**Step 1: Open Delivery sheet**
- Tool: `browser_click` → ref: [Delivery chip ref], element: "Delivery chip"
- Tool: `browser_snapshot`

**Step 2: Click the dark overlay backdrop**
- Tool: `browser_click` → ref: [backdrop ref], element: "Sheet backdrop overlay"
- OR Tool: `browser_run_code` → code:
```javascript
async (page) => {
  const backdrop = await page.locator('.bg-black\\/50, [class*="bg-black"]').first();
  if (await backdrop.isVisible()) {
    await backdrop.click({ position: { x: 10, y: 10 } });
    return 'Clicked backdrop';
  }
  return 'Backdrop not found';
}
```
- Tool: `browser_snapshot`
- Expected: Sheet closed

**Step 3: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-31-sheet-close.png`

---

## PHASE 10: LOTS PAGE

### Task 32: Lots Page — Content & Status

**Goal:** Verify lots page shows seeded lots with correct status badges.

**Step 1: Click Lots tab**
- Tool: `browser_click` → ref: [Lots tab ref], element: "Lots tab"
- Tool: `browser_wait_for` → time: 2

**Step 2: Snapshot**
- Tool: `browser_snapshot`
- Expected: Lot list with LOT-TEST-001, LOT-TEST-002, LOT-TEST-003 (from Task 4 seeding). Each lot showing:
  - Lot number
  - Description
  - Status badge (pending=amber, in_progress=sky, completed=emerald)

**Step 3: Full page screenshot**
- Tool: `browser_take_screenshot` → filename: `test-32-lots-page.png`, fullPage: true

---

## PHASE 11: HEALTH CHECKS

### Task 33: Offline Indicator

**Goal:** Verify online/offline status indicator.

**Step 1: Snapshot bottom nav**
- Tool: `browser_snapshot`
- Expected: Either no indicator (online — normal) or "Offline - changes saved locally" / "{N} pending sync"

**Step 2: Check navigator.onLine**
- Tool: `browser_evaluate` → function: `() => navigator.onLine`
- Expected: Returns true

**Step 3: Screenshot**
- Tool: `browser_take_screenshot` → filename: `test-33-offline-indicator.png`

---

### Task 34: Console Errors Check

**Goal:** Check for JavaScript errors accumulated during testing.

**Step 1: Get error-level console messages**
- Tool: `browser_console_messages` → level: "error"
- Expected: No critical unhandled exceptions. Minor warnings acceptable.

**Step 2: Get warning-level messages**
- Tool: `browser_console_messages` → level: "warning"
- Expected: Document any unexpected warnings

**Step 3: Record findings**
- List all errors with severity for bug reporting

---

### Task 35: Network Requests Verification

**Goal:** Verify API calls succeeded during the session.

**Step 1: Navigate to Today tab (fresh load)**
- Tool: `browser_navigate` → url: `http://localhost:5174/projects/457af21a-16bf-49e7-a23b-c467af933e7e/foreman/today`
- Tool: `browser_wait_for` → time: 3

**Step 2: Check network requests**
- Tool: `browser_network_requests` → includeStatic: false
- Expected: API calls returning 200:
  - GET /api/auth/me
  - GET /api/dashboard/projects/.../foreman/today
  - No 4xx/5xx errors

**Step 3: Navigate to Diary and check**
- Tool: `browser_click` → ref: [Diary tab ref], element: "Diary tab"
- Tool: `browser_wait_for` → time: 3
- Tool: `browser_network_requests` → includeStatic: false
- Expected: Diary API calls succeed (GET /api/diary/..., GET /api/diary/.../timeline)

---

## PHASE 12: SUMMARY

### Task 36: Final Test Summary & Cleanup

**Goal:** Compile pass/fail results.

**Step 1: Compile pass/fail matrix**
For each task (1-35), record:
- **PASS**: Feature works as expected
- **FAIL**: Feature broken or not working. Document: description, steps to reproduce, expected vs actual, screenshot ref
- **PARTIAL**: Partially works. Document what's missing.
- **BLOCKED**: Could not test (e.g., no test data, UI element not found)
- **NOT IMPLEMENTED**: Feature exists in code but not yet wired up (e.g., edit flow)

**Step 2: Screenshot summary page (final state)**
- Tool: `browser_take_screenshot` → filename: `test-36-final-state.png`

**Step 3: Close browser**
- Tool: `browser_close`

---

## Test Coverage Matrix

| # | Feature Area | Phase | Tasks | Type |
|---|-------------|-------|-------|------|
| 1 | Browser Setup | 1 | 1 | Setup |
| 2 | Login — Happy Path | 1 | 2 | Happy |
| 3 | Login — Wrong Password | 1 | 3 | Negative |
| 4 | Test Data Seeding | 1 | 4 | Setup |
| 5 | Foreman Shell & 5-Tab Nav | 2 | 5 | Happy |
| 6 | All Tab Navigation | 2 | 6 | Happy |
| 7 | Responsive Desktop/Mobile | 2 | 7 | Happy |
| 8 | Today Worklist | 3 | 8 | Happy |
| 9 | Docket Filter Pills | 4 | 9 | Happy |
| 10 | Docket Approve Action | 4 | 10 | Happy |
| 11 | Docket Reject + Validation | 4 | 11 | Happy + Negative |
| 12 | Lot Selector | 5 | 12 | Happy |
| 13 | Weather Bar | 5 | 13 | Happy |
| 14 | Docket Summary Card | 5 | 14 | Happy |
| 15 | Add Activity + Suggestions | 6 | 15 | Happy |
| 16 | Activity Validation | 6 | 16 | Negative |
| 17 | Add Delay + Type Selection | 6 | 17 | Happy |
| 18 | Delay Validation | 6 | 18 | Negative |
| 19 | Add Delivery | 6 | 19 | Happy |
| 20 | Add Event + Type Selection | 6 | 20 | Happy |
| 21 | Add Labour & Plant | 6 | 21 | Happy |
| 22 | Labour Validation | 6 | 22 | Negative |
| 23 | Timeline Full Verification | 7 | 23 | Happy |
| 24 | Delete Entry | 7 | 24 | Happy |
| 25 | Edit Entry (Tap) | 7 | 25 | Happy |
| 26 | Pull-to-Refresh | 7 | 26 | Happy |
| 27 | Diary Submission + Read-Only | 8 | 27 | Happy |
| 28 | Date Navigation | 8 | 28 | Happy |
| 29 | Sheet Close — X Button | 9 | 29 | Happy |
| 30 | Sheet Close — Escape Key | 9 | 30 | Happy |
| 31 | Sheet Close — Backdrop | 9 | 31 | Happy |
| 32 | Lots Page Content | 10 | 32 | Happy |
| 33 | Offline Indicator | 11 | 33 | Happy |
| 34 | Console Errors | 11 | 34 | Health |
| 35 | Network Requests | 11 | 35 | Health |
| 36 | Final Summary | 12 | 36 | Summary |

**Totals:** 36 tasks — 22 happy path, 4 negative/validation, 2 setup, 3 health checks, 5 interaction variants, 1 summary

**Improvements over v1:**
- Added test data seeding (Task 4) so all tabs have real data
- Added form validation tests (Tasks 16, 18, 22) for empty required fields
- Added docket approve action (Task 10) — tests the core approval workflow
- Added docket reject + validation (Task 11) — tests rejection reason required
- Added diary submission + read-only verification (Task 27)
- Added date navigation (Task 28)
- Added pull-to-refresh (Task 26) via touch event simulation
- Added activity suggestion chips test (Task 15)
- Added edit entry test (Task 25) — documents current implementation status
- Added login negative path (Task 3) — wrong password
- Removed redundant tab cycling task (was duplicate of individual tab tests)
- Removed redundant "all tabs screenshot" task (each tab already captured)
- Split bottom sheet close tests into 3 discrete methods (X, Escape, backdrop)
