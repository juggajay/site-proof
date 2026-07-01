# User Testing Feedback Log - 2026-07-01

Purpose: capture Jay's hands-on user-testing feedback without fixing anything immediately.

Rule for this log:

- Document observations exactly enough to reproduce later.
- Do not implement fixes from this file until Jay explicitly asks.
- Keep each item small, with role, page/workflow, expected result, actual result, and priority if known.

## Open Feedback

### UTF-001 - Basic project usage counts archived projects inconsistently

- Status: open
- Reported by: Jay
- Role/profile: main company user / company settings
- Page/workflow: Company Settings -> subscription tier / project usage
- Steps observed:
  1. Account shows subscription tier `Basic`, with a stated allowance of 3 projects.
  2. One existing project was archived.
  3. The archived project could not be deleted.
  4. After archiving, the app allowed creation of another project.
  5. Company Settings now shows project usage as `4 out of 3 projects used`.
- Expected:
  - The app should present and enforce project limits consistently.
  - If archived projects do not count toward the creation limit, the usage display should probably show active-count usage clearly.
  - If archived projects do count, creating a fourth project on a 3-project plan should be blocked.
  - The delete/archived-project policy should be clear to the user.
- Actual:
  - Archiving appears to free capacity for creating a new project, but the usage counter still reports total projects as over the Basic limit.
- Impact:
  - Confusing billing/plan UX.
  - Could look like the customer is over quota immediately after following a valid workflow.
  - Possible quota/accounting mismatch if archived projects are treated differently between enforcement and display.
- Evidence:
  - User observed `4 out of 3 projects used` after archiving one project and creating another.
- Notes:
  - Needs product decision: should project quota count active projects only, all non-deleted projects, or all historical projects?

### UTF-002 - Company logo needs clear UI placement and report usage

- Status: open
- Reported by: Jay
- Role/profile: main company user
- Page/workflow: Company Settings -> company logo upload
- Steps observed:
  1. User noticed company logo upload controls.
  2. User was unsure where the logo is displayed in the UI after upload.
  3. User expects the uploaded company logo to appear in all user-creatable reports.
- Expected:
  - The UI should make clear where the company logo appears after upload.
  - The company logo should be shown in appropriate in-app company/project surfaces where branding matters.
  - The company logo should be included in all generated reports/exportable PDFs that users can create, unless there is a specific reason a report should remain unbranded.
  - If relevant, expose enough product copy to reassure the user that the file is stored through the app, not pasted as an arbitrary public URL.
- Actual:
  - User could not tell where the uploaded logo is used.
  - It is not yet confirmed whether every creatable report includes the uploaded company logo.
- Impact:
  - Trust/clarity issue around file storage.
  - User may hesitate to upload company branding if storage and usage are not obvious.
  - Reports may feel unfinished or less professional if the company logo is missing.
- Evidence:
  - Code check: frontend uploads via `POST /api/company/logo`.
  - Code check: backend route `backend/src/routes/company.ts` stores via Supabase Storage when configured, or falls back to local/static upload storage in unconfigured environments.
  - Code check: display/download path is backend mediated via `GET /api/company/logo/file/:companyId` with a short-lived token tied to the stored logo object.
- Notes:
  - This is documented as feedback only. No implementation change made.
  - Follow-up audit should list every report/export surface and confirm whether the company logo is rendered.

### UTF-003 - Project team assignment should pick from company members instead of requiring typed email

- Status: open
- Reported by: Jay
- Role/profile: main company user
- Page/workflow: Company Settings -> Team Members, then Project -> assign/add team members
- Steps observed:
  1. In Company Settings, add a company team member such as `John Brian`.
  2. Give the member a company role such as `foreman`.
  3. Open a specific project.
  4. Use the project team/member assignment flow.
  5. The user must type the individual email address manually.
- Expected:
  - Project team assignment should offer a dropdown/search picker of existing company team members.
  - The user should be able to pick `John Brian` from the company member list instead of remembering and typing their email.
- Actual:
  - Project assignment flow appears email-entry based.
- Impact:
  - Repetitive and error-prone for real teams.
  - Makes company-level team setup feel disconnected from project-level assignment.
  - Higher chance of typo, wrong user, or duplicated invite attempt.
- Evidence:
  - User observed this during manual testing.
- Notes:
  - Likely UX improvement rather than a correctness bug, unless the typed-email flow also allows invalid/non-company users through unexpectedly.

### UTF-004 - Foreman/subbie users briefly land in desktop UI before dedicated shell

- Status: open
- Reported by: Jay
- Role/profile: foreman user, subcontractor/subbie user
- Page/workflow: login / initial post-login route
- Steps observed:
  1. Log in as a foreman or subbie.
  2. These roles have their own dedicated UIs.
  3. Immediately after login, the app appears to show/revert to the desktop UI first.
  4. After clicking through a couple of buttons, the app transitions into the dedicated foreman/subbie UI.
- Expected:
  - Foreman should land directly and quickly in the foreman-specific UI.
  - Subbie should land directly and quickly in the subbie-specific UI.
  - Users should not see the desktop/main contractor UI flash or become the first apparent destination.
- Actual:
  - Foreman/subbie users appear to hit the desktop UI initially, then eventually move into their dedicated UI after extra interaction.
- Impact:
  - First-login experience feels wrong for role-specific users.
  - Risk of confusion: users may think they are in the wrong product or have the wrong permissions.
  - Could expose unavailable navigation/options momentarily, even if backend access remains protected.
- Evidence:
  - User observed during manual testing with foreman and subbie profiles.
- Notes:
  - Likely area to check later: post-login redirect, role resolution/loading state, `ShellGuard`, `SubbieShellGuard`, and any feature-flag/default-shell timing.

### UTF-005 - Foreman/subbie UI cards need role-focused simplification

- Status: open
- Reported by: Jay
- Role/profile: foreman user, subcontractor/subbie user
- Page/workflow: dedicated foreman UI and subbie UI home/dashboard cards
- Steps observed:
  1. Open the dedicated subbie UI.
  2. The subbie UI shows many card/options.
  3. User feels the subbie UI may have too many choices and should be narrowed down.
  4. User is not sure whether the foreman UI format contains exactly what the foreman needs.
- Expected:
  - Each role-specific UI should prioritize the most important jobs for that role.
  - Subbie should see fewer, clearer options focused on assigned work, ITPs/hold points, dockets, NCRs, documents, and actions that matter today.
  - Foreman UI should be checked against the actual daily foreman workflow and avoid unnecessary cards/options.
- Actual:
  - Subbie UI may be too broad/noisy.
  - Foreman UI needs review for whether the cards match the real workflow.
- Impact:
  - Role-specific UI may feel less direct than intended.
  - Too many cards can slow down site users and make the product feel harder than it is.
  - Risk that important tasks are buried behind lower-priority options.
- Evidence:
  - User observed during manual role testing.
- Notes:
  - This is a product/UX review item, not necessarily a bug.
  - Later work should map cards to the top daily tasks for each role and decide what to remove, combine, or demote.

### UTF-006 - Lots page subcontractor dropdown does not carry into create-lot form

- Status: open
- Reported by: Jay
- Role/profile: main company user
- Page/workflow: Projects -> Lots -> top horizontal controls -> Create New Lot
- Steps observed:
  1. Open a project.
  2. Go to the Lots page.
  3. In the top horizontal controls, use the subcontractor dropdown/menu.
  4. Select a subcontractor.
  5. Open Create New Lot.
  6. The selected subcontractor is not preselected in the create-lot form.
- Expected:
  - If the top subcontractor dropdown is meant to set context/defaults, Create New Lot should inherit that selected subcontractor.
  - If the dropdown is only a filter or bulk-action control, the UI should make that clearer so the user does not expect it to prefill the lot form.
  - User's current leaning: remove the horizontal menu if it does not have a clear purpose.
- Actual:
  - Selecting a subcontractor in the top controls does not affect the Create New Lot modal.
- Impact:
  - Confusing workflow when creating lots for a subcontractor.
  - User cannot tell what the top dropdown is supposed to do.
  - Could lead to lots being created without the intended subcontractor assignment.
- Evidence:
  - User observed during manual testing before creating a lot.
- Notes:
  - Needs later investigation/design decision: classify the top control as filter, bulk assignment, create-lot default context, or remove it entirely.

### UTF-007 - Create Lot form should allow entering lot dollar value/budget

- Status: open
- Reported by: Jay
- Role/profile: main company user
- Page/workflow: Projects -> Lots -> Create New Lot
- Steps observed:
  1. Open a project.
  2. Go to Lots.
  3. Open Create New Lot.
  4. Try to add a dollar value/budget for the lot during creation.
  5. No obvious field is available in the create-lot form.
  6. User expects the current workaround is to create the lot first, then edit the lot later to add the dollar value.
- Expected:
  - Create New Lot should include a field for the lot dollar value/budget where the user's role is allowed to set it.
  - The user should not need to create the lot, reopen/edit it, and then add the dollar value.
- Actual:
  - Dollar value/budget is not available or not visible in the create-lot menu/form.
- Impact:
  - Extra workflow steps for commercial setup.
  - Higher chance of lots being created without budget values.
  - Makes the creation flow feel incomplete.
- Evidence:
  - User observed during manual lot creation flow.
- Notes:
  - Later check should confirm whether backend already accepts `budgetAmount` on lot creation and whether this is mainly a frontend form gap.

### UTF-008 - Project creation ITP/spec selection should respect selected state and allow national option

- Status: open
- Reported by: Jay
- Role/profile: main company user
- Page/workflow: Create Project -> state selection -> ITP/specification selection
- Steps observed:
  1. Start creating a project.
  2. Select the project state first.
  3. Continue to the section where the user picks which ITP/specification set applies.
  4. User can still see/select unrelated state options such as Queensland or Victoria even when the selected state is different.
- Expected:
  - After selecting a state, unrelated state-specific ITP/specification options should not be selectable.
  - Non-applicable state options should probably be hidden or greyed out with clear disabled state.
  - Nationally applicable options should remain selectable.
  - User should be able to select more than one applicable option where valid, for example a NSW-specific option plus the national option.
- Actual:
  - State-specific options appear too broadly available during project creation.
  - It is unclear whether multiple applicable standards can be selected together.
- Impact:
  - User can choose an invalid specification/ITP library for the project state.
  - Incorrect setup could lead to wrong ITP templates appearing later.
  - Project setup feels less guided than it should.
- Evidence:
  - User observed during manual project creation flow.
- Notes:
  - User mentioned NSW plus a national standard option. Later investigation should identify the exact national standard label, likely the cross-state/national ITP library option.
  - Needs product decision on whether project setup supports one specification set, multiple selected libraries, or one primary plus optional national library.

### UTF-009 - Desktop ITP checklist controls should match clearer pass/fail/NA shell pattern

- Status: open
- Reported by: Jay
- Role/profile: main company user / desktop UI
- Page/workflow: Lot detail -> assigned ITP -> ITP item checklist
- Steps observed:
  1. Main user opens desktop UI.
  2. Open a lot with an assigned ITP.
  3. View the ITP checklist items.
  4. Desktop UI shows actions such as "Mark as N/A", "Mark as Failed", and notes.
  5. User does not see an obvious pass button.
  6. User compares this unfavorably with the subbie/foreman UI style.
- Expected:
  - Desktop ITP item controls should be visually clearer and faster to use.
  - User wants the same type of system/pattern as the subbie and foreman UI.
  - Keep clear status actions/icons:
    - green tick for pass,
    - red X for fail,
    - grey N/A for not applicable.
  - Notes/evidence should still be available, but not make the primary pass/fail/NA action feel clunky.
- Actual:
  - Desktop checklist feels less polished and less obvious.
  - There is no clear pass button visible to the user.
  - Available actions are wordier and less direct than the role-specific mobile/shell controls.
- Impact:
  - Desktop ITP workflow is slower and less intuitive.
  - The same ITP task feels inconsistent across desktop, foreman, and subbie views.
  - Users may miss how to pass an item.
- Evidence:
  - User observed during manual desktop ITP testing.
- Notes:
  - Later design pass should compare desktop `ITPChecklistTab` behavior with foreman/subbie ITP run components and decide whether to reuse a shared checklist action component.

### UTF-010 - Foreman/subbie shell ITP links should not fall back to old desktop UI

- Status: open
- Reported by: Jay
- Role/profile: foreman user; check subbie user too
- Page/workflow: Foreman UI -> Inspections -> ITP assigned to lot -> hold point item
- Steps observed:
  1. Log in as foreman.
  2. Open the foreman UI.
  3. Go to Inspections.
  4. Open an ITP assigned to a lot.
  5. ITP shows 33 items.
  6. First item is a hold point.
  7. Click the "Open hold points" button.
  8. App navigates out of the new foreman UI and back into the old/desktop UI.
- Expected:
  - Foreman should stay inside the new foreman UI for hold point actions related to an ITP.
  - All ITP-related paths and buttons in the foreman shell should be accounted for inside the new shell.
  - Same rule should be checked for subbie UI: no accidental fallbacks to old desktop UI from subbie ITP/hold point paths.
- Actual:
  - "Open hold points" sends foreman back to the old UI.
- Impact:
  - Confusing context switch for site users.
  - Breaks the purpose of the dedicated role-specific shell.
  - User may lose confidence or orientation mid-inspection.
- Evidence:
  - User observed during manual foreman ITP/inspection testing.
- Notes:
  - User said "all ITPs/paths are accounted for in the new UI" is the desired standard.
  - Later investigation should audit every foreman/subbie shell link/button that points to legacy desktop routes.

### UTF-011 - Management needs guided lot/ITP preparation before foreman/subbie receives blocked checklist

- Status: open
- Reported by: Jay
- Role/profile: owner / project manager / higher-level management creating lots; downstream foreman and subbie users
- Page/workflow: Lot creation / ITP assignment / pre-start preparation / foreman-subbie ITP execution
- Steps observed:
  1. Higher-level user creates lots and assigns an ITP.
  2. Foreman or subbie later opens the assigned ITP checklist.
  3. Some ITPs can contain many hold points or items that the foreman/subbie cannot actually progress without prior management-side documents/data.
  4. Foreman/subbie can be left staring at a checklist that is mostly blocked or not actionable.
- Expected:
  - When owner/PM/admin creates a lot and assigns an ITP, the app should guide them through any required pre-start setup.
  - Required documents, evidence, approvals, superintendent contacts, or other prerequisite data should be collected before the lot/ITP is handed to the field user where possible.
  - Foreman/subbie should receive a practical work checklist with actionable tasks, not a list full of hold points they cannot move.
  - The app should make clear which ITP items are management-prep tasks versus field-execution tasks.
- Actual:
  - Current flow may allow a lot/ITP to be opened to foreman/subbie before the relevant upstream prep has been done.
  - Field users can get blocked by hold-point-heavy checklists.
- Impact:
  - Field workflow confusion.
  - Foreman/subbie may think the app is asking them to do things outside their role.
  - Risk that lots are started without required supporting documents or release context.
  - More back-and-forth between field and management.
- Evidence:
  - User observed/thought through this while testing foreman ITP/hold point flow.
- Notes:
  - Product/design question: create a "Lot readiness" or "ITP pre-start checklist" for management before field release.
  - Later investigation should identify which ITP item types are field-actionable vs management-prep vs external superintendent action.

### UTF-012 - Superintendent sign-off ITP item should not be actionable in foreman/subbie checklist

- Status: open
- Reported by: Jay
- Role/profile: foreman user, subcontractor/subbie user
- Page/workflow: Foreman/subbie UI -> ITP checklist items
- Steps observed:
  1. Open an ITP checklist as foreman or subbie.
  2. The last item in the ITP is usually superintendent sign-off.
  3. That item appears in the foreman/subbie checklist.
- Expected:
  - Superintendent sign-off items should not be presented as normal actionable checklist tasks for foreman/subbie.
  - If the item must be visible, it should be clearly separated as external/client/superintendent action or readiness status, not something the field user is expected to complete.
  - The app should route this through the hold-point/release/sign-off workflow instead.
- Actual:
  - Superintendent sign-off appears in the foreman/subbie ITP checklist, making it look like part of their work.
- Impact:
  - Confuses role responsibility.
  - Foreman/subbie may be blocked by an item that is not for them.
  - Adds noise to the field checklist.
- Evidence:
  - User observed/thought through this while testing ITP items.
- Notes:
  - Later review should classify ITP checklist items by responsible party and decide visibility/actionability rules per role.

### UTF-013 - Batch hold-point release request needed for ITPs with many hold points

- Status: open
- Reported by: Jay
- Role/profile: main/management user and/or foreman, depending on hold-point permissions
- Page/workflow: ITP checklist / Hold Points menu / Request release
- Steps observed:
  1. User is working with an earthworks ITP template.
  2. The ITP has around 32-33 items.
  3. Around 16 of those items are hold points.
  4. User opens the Hold Points menu.
  5. Current workflow appears to require requesting release one hold point at a time.
  6. Each release request sends a separate email to the superintendent.
- Expected:
  - There should be an easy way to select/work through multiple related hold points.
  - User should be able to submit multiple hold points as one release request where appropriate.
  - Superintendent should receive one consolidated email/request instead of many separate emails.
  - The flow should still preserve individual hold-point tracking/status/audit history.
- Actual:
  - User expects the current flow requires one release request and one email per hold point.
- Impact:
  - Too much repetitive admin for hold-point-heavy ITPs.
  - Superintendent could receive excessive emails.
  - Higher chance users skip or mishandle hold-point release workflow because it feels too slow.
- Evidence:
  - User observed/thought through this while testing an earthworks ITP with many hold points.
- Notes:
  - Later product/design work should define grouping rules: by lot, ITP, date, superintendent, readiness state, or selected items.
  - Must retain per-hold-point release status, evidence, signatures, and audit events even if the request email is batched.

### UTF-014 - Hold Points menu needs lot selection/filtering

- Status: open
- Reported by: Jay
- Role/profile: project manager / main management user
- Page/workflow: Project -> Hold Points menu/register
- Steps observed:
  1. Project manager may be managing multiple lots.
  2. Open the Hold Points menu.
  3. Hold points appear as one linear list across lots.
  4. User wants to pick a lot and see only the hold points for that lot.
- Expected:
  - Hold Points view should allow selecting/filtering by lot.
  - Manager should be able to focus on a specific lot's hold points instead of scanning one long mixed list.
  - Lot context should be clear on every hold point row/card.
- Actual:
  - Hold Points menu feels like one linear list of hold points across different lots.
- Impact:
  - Harder to manage multiple lots.
  - More likely to request/release the wrong hold point or miss a lot-specific blocker.
  - Project manager workflow gets noisy on larger projects.
- Evidence:
  - User observed/thought through this while reviewing the Hold Points menu.
- Notes:
  - Later design should consider lot picker, lot grouping, search, and status filters together.

### UTF-015 - Hold-point release request needs evidence/file upload

- Status: open
- Reported by: Jay
- Role/profile: management user / foreman where permitted
- Page/workflow: Hold Points -> Request release
- Steps observed:
  1. Open a hold point and start requesting release.
  2. UI says what is needed for the hold point.
  3. Request release options appear limited to selecting date, selecting time, and entering the email/person who will release it.
  4. There is no obvious way to upload the specific files/evidence that the hold point requires.
- Expected:
  - Request release should allow uploading/attaching the files, documents, photos, certificates, or other evidence required by the hold point.
  - The UI should make it intuitive to satisfy the listed requirement before sending the request.
  - In a batch release flow, user should be able to attach the relevant files to each hold point or to the batch where appropriate.
  - Attached evidence should carry through to the superintendent email/release page and audit trail.
- Actual:
  - User only sees date/time/email fields and no file upload/submit evidence path in the request-release flow.
- Impact:
  - Release request can be sent without the supporting evidence the hold point asks for.
  - Superintendent may receive an incomplete request.
  - User has no clear place to put required documents, which undermines the hold-point workflow.
- Evidence:
  - User observed during manual hold-point release testing.
- Notes:
  - Relates to UTF-013 batch hold-point release request.
  - Later design should decide whether evidence is uploaded per hold point, as shared batch attachments, or both.
  - Must preserve clear mapping from each file to the specific hold point requirement it satisfies.

## Template

```md
### UTF-001 - Short title

- Status: open
- Reported by: Jay
- Role/profile:
- Page/workflow:
- Steps observed:
- Expected:
- Actual:
- Impact:
- Evidence:
- Notes:
```
