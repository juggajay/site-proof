# SiteProof v3 — Triple-Lens Product Audit

Generated 2026-06-21 against master @ 352a4195. Method: 69-agent workflow — 17 triple-lens (user/PM/senior-dev) finders, adversarial verification per finding, refute panel on every high/blocker, completeness critic + gap round.

**Tally:** 117 confirmed findings (only 2 false positives). 29 high/blocker raised, 27 survived an adversarial refute pass (2 downgraded). Plus 15 findings from the gap round.

> Context: this is a PRODUCT/UX/LOGIC audit, deeper than the prior security pass. Security & auth remain strong — these are real bugs, field-workflow breaks, and ship-but-dont-deliver gaps, not security holes.

## 1. HIGH / BLOCKER (survived adversarial refute)

### H1. [HIGH · USER] 'Log in instead' on the invite-accept page dead-ends existing users into company-creation onboarding
**Area:** Auth & onboarding  
**Location:** `frontend/src/pages/subcontractor-portal/AcceptInvitePage.tsx:518-526; frontend/src/pages/auth/postLoginRedirect.ts:89-95,106-111; frontend/src/components/layouts/ProtectedAppShell.tsx:21-36; frontend/src/App.tsx:152-154,185-188`  
**Detail:** The redirect-rejection, the default fallback, and the onboarding force-redirect all line up exactly as described against the real code. An existing subbie following the intended 'log in to accept' path is bounced into head-contractor company setup and never reaches the accept page. Note a partial mitigation exists: a logged-in user who navigates to the accept page directly can self-discover via /api/subcontractors/my-pending-invitation (AcceptInvitePage.tsx:144-159), but the post-login redirect never delivers them there, so the journey is genuinely broken. High severity is reasonable for an invited-crew activation failure.  
**Fix:** Allow /subcontractor-portal/accept-invite and /accept-invite through isAllowedPostLoginRedirect even without an existing subbie identity (the page is public and re-discovers the invite), so logged-in invitees land on the accept page instead of /onboarding.


### H2. [HIGH · PM] Archiving a project does nothing — "read-only" is a false promise; archived projects remain fully mutable
**Area:** Projects & Lots lifecycle  
**Location:** `backend/src/routes/projects/writeRoutes.ts:397-400,485; frontend/src/pages/projects/settings/components/DangerZone.tsx:223-231`  
**Detail:** The read-only promise is real in the UI copy but there is genuinely no backend write gate keyed on project.status. Every mutating lot/quality route I checked authorizes on project ROLE only. An archived/completed project remains fully mutable. The UI explicitly promises read-only, so this is a real false-promise / compliance gap, not boilerplate.  
**Fix:** Add a project-status write guard (reject mutating lot/ITP/NCR/claim/docket create+update when project.status is archived/completed), or remove the 'read-only' wording from the archive UI.


### H3. [HIGH · DEV] Overriding a conformed lot back to an operational status leaves stale conformedAt/conformedBy on a non-conformed lot
**Area:** Projects & Lots lifecycle  
**Location:** `backend/src/routes/lots/qualityRoutes.ts:279-353 (override updates only status); :242-257 (conform sets conformedAt/conformedBy); validation.ts:9-18,249-251; frontend/src/pages/lots/components/LotHeader.tsx:143-153`  
**Detail:** Independently reproduced: the override path writes only `status`, conform stamps conformedAt/conformedById, override is reachable on a conformed lot (only 'claimed' current-status is excluded), and the read route returns the stale fields. A lot can end up status='in_progress' while still showing 'Conformed by X on Y'. Real data-integrity/audit defect.  
**Fix:** When override moves a lot away from 'conformed', clear conformedAt/conformedById (and audit the reset), or require a dedicated un-conform action instead of a generic override.


### H4. [HIGH · PM] ITP verify/reject workflow has no driving UI — separation-of-duties verification is backend-only and unreachable
**Area:** ITP instances & completions  
**Location:** `backend/src/routes/itp/completionVerificationRoutes.ts:63-377 (endpoints) vs frontend/src (no caller)`  
**Detail:** The separation-of-duties verification workflow is genuinely unreachable from the product UI. When requireSubcontractorVerification + itpRequiresVerification are on, subbie completions land in pending_verification (completions.ts:319-326) and there is no surface to verify or reject them. The PM/QM headline 'verify subbie quality' feature is a dead end through the UI; the only ways to clear pending_verification are the API directly or a DB write.  
**Fix:** Add Verify/Reject actions (ITP_VERIFY_ROLES only) on the HC lot ITP surface and wire the pending-verifications queue, or hide/disable the verification project setting until the UI ships.


### H5. [HIGH · DEV] Rejecting a subbie ITP item leaves it counting as 'completed' for lot auto-progression and claim readiness
**Area:** ITP instances & completions  
**Location:** `backend/src/routes/itp/completionVerificationRoutes.ts:234-243; backend/src/routes/itp/helpers/lotProgression.ts:47-53; backend/src/lib/evidenceReadiness/claimReview.ts:18-21`  
**Detail:** A rejected (or not-yet-verified pending) non-hold-point completion still drives lot auto-progression to completed and reads as claim-complete. Note a partial mitigation: for HOLD-POINT checklist items specifically, claimReview.ts:54-59 raises 'unreleased_itp_hold_points' when verificationStatus !== 'verified', so rejected hold-point items are caught there. But standard/witness items and lot auto-progression are not, so the integrity gap is real for the common (non-hold-point) item.  
**Fix:** Exclude rejected (and, for claim readiness, pending_verification) completions from the completed-item counts in lotProgression and claimReview, or clear status/completedAt on reject so the item returns to unfinished.


### H6. [HIGH · DEV] Re-completing a rejected ITP item never resets verificationStatus back to pending_verification
**Area:** ITP instances & completions  
**Location:** `backend/src/routes/itp/completions.ts:295-331 (derivation) and :372-403 (update branch)`  
**Detail:** Confirmed for the head-contractor resubmit path: the rejected flag is sticky and the item is never re-queued for verification, producing an inconsistent rejected+completed row. The subbie resubmit path does recompute verificationStatus (correctly to pending_verification when still required, or 'verified' when no longer required), so the bug is specifically the HC-resubmit case the finding calls out as (a). No explicit 'on resubmit clear rejected' logic exists.  
**Fix:** On any POST /completions that re-finishes a row whose verificationStatus is 'rejected', explicitly reset it (pending_verification when verification is required, else clear) and clear verifiedAt/By/Notes.


### H7. [HIGH · USER] Mobile NCR register is a dead-end: tapping/swiping a card opens nothing and exposes no workflow actions
**Area:** NCRs end to end  
**Location:** `frontend/src/pages/ncr/components/NCRMobileList.tsx:108-156, frontend/src/pages/ncr/hooks/useNCRModals.ts:37-39, frontend/src/pages/ncr/NCRPage.tsx:252-262`  
**Detail:** Genuinely present: on a <768px viewport a PM/QM/site_manager can view the register but every tap/swipe-right is a no-op, and no management action (Respond/Review/Close/Concession/Notify/QM-approve) is reachable. The Raise-NCR FAB still works, but acting on existing NCRs is impossible. Severity stays high but is bounded by the fact the desktop register remains fully functional, so it is a degraded-mobile-experience issue rather than total loss of capability.  
**Fix:** Make the mobile card open a detail sheet/route that surfaces the same status-appropriate actions as the desktop NCRTable, or route mobile management users to an actionable detail screen.


### H8. [HIGH · DEV] Concession button shown in 'rectification' status always fails — backend /close requires 'verification'
**Area:** NCRs end to end  
**Location:** `frontend/src/pages/ncr/components/NCRTable.tsx:413, backend/src/routes/ncrs/ncrClosureWorkflow.ts:218-222`  
**Detail:** Confirmed in code. The button visibility condition includes 'rectification' but the endpoint only allows 'verification', a guaranteed dead-end on a high-stakes quality action. Note: this is desktop-only (mobile has no Concession button at all per Finding 1), and the user does get a clear error toast rather than silent corruption, but the wasted effort + confusion on a major-NCR concession path justifies high.  
**Fix:** Hide the Concession button unless status === 'verification', or allow concession closure from 'rectification' in the backend (and document which is intended).


### H9. [HIGH · DEV] Client-approval reference for a major-NCR concession is silently discarded (never persisted)
**Area:** NCRs end to end  
**Location:** `frontend/src/pages/ncr/components/ConcessionModal.tsx:170-203, frontend/src/pages/ncr/hooks/useNCRActions.ts:293, backend/src/routes/ncrs/ncrWorkflowValidation.ts:75-112`  
**Detail:** Confirmed. The reference the UI tells the PM is required for a major-NCR concession is collected, sent, and silently dropped — no DB field, no audit log entry, no PDF. In an audit/dispute there is no record of the claimed client sign-off. The audit log (ncrClosureWorkflow.ts:292-307) records withConcession but not the approval reference. Genuine data-integrity/compliance gap on the exact failure the product promises to prevent.  
**Fix:** Add clientApprovalDocId/clientApprovalReference to closeNcrSchema, persist it (and require it server-side when withConcession && severity === 'major'), and include it in the audit log and PDF.


### H10. [HIGH · USER] QM reviews the NCR response 'blind' — the submitted root cause / corrective action are never shown
**Area:** NCRs end to end  
**Location:** `frontend/src/pages/ncr/components/QMReviewModal.tsx:87-96, frontend/src/pages/ncr/types.ts:6-30`  
**Detail:** Confirmed. The QM gatekeeping step displays no real response data, only boilerplate. The reviewer must leave the modal (e.g. the NCR PDF) to read what they are approving, hollowing out the structured review flow. High is fair for a core review step rendered non-functional, though it is review-quality degradation rather than a hard error or data loss.  
**Fix:** Add rootCauseCategory/rootCauseDescription/proposedCorrectiveAction to the NCR type and render them read-only in QMReviewModal before the accept/reject buttons.


### H11. [HIGH · DEV] Copy-from-yesterday carries docket-imported crew/plant forward as manual entries, causing double-counting when today's docket is approved
**Area:** Daily diary  
**Location:** `backend/src/routes/diary/diaryCore.ts:363-396 / :426-457; backend/src/routes/dockets/review.ts:259-289; frontend/src/pages/diary/hooks/useCopyFromYesterday.ts:97-111,131-259`  
**Detail:** The full chain is real and present: a day's diary auto-populated from approved dockets (source='docket'), carried forward to the next day via the copy shortcut (re-created as source='manual'), then that next day's docket approved (same crew added again as source='docket'), with no unique constraint or dedupe anywhere to collapse them. The diary then holds two copies of the same worker/machine and their hours, which flows into the PDF/CSV (DiarySubmitSection.tsx:142-158 builds the PDF from diary.personnel/plant directly). On a civil project this is the legal daily record used for EOT/delay and progress claims, so duplicated hours are a genuine data-integrity and commercial risk. Severity high is honest given the official-record impact, tempered only by it requiring a dockets-enabled project plus the foreman using the copy shortcut.  
**Fix:** Filter previous-personnel/previous-plant to source='manual' only, and/or have the docket auto-population skip personnel/plant already present for the same docket or same name+company on that diary.


### H12. [HIGH · DEV] Docket create route stores HOURS in the cost columns (totalLabourSubmitted/totalPlantSubmitted), corrupting every downstream dollar figure
**Area:** Dockets (labour/plant)  
**Location:** `backend/src/routes/dockets.ts:187-188`  
**Detail:** Real and currently present. The same DB column carries hours on the create path and dollars on every other path — a genuine split-brain unit confirmed across create, entry refreshers, mappers, the currency renderer, and four separate cost rollups, with the committed test explicitly encoding the dollars contract. The subbie's primary in-portal create (DocketScreen.tsx:202) is clean (lazy create sends only notes), but the head-contractor modal and offline sync are not, and those values are not re-derived for an empty/asymmetric docket. High severity is justified because the contamination reaches PM budget variance/trend and multiple cost rollups, though note the persistence is conditional (it is overwritten once entries of that class are added/mutated).  
**Fix:** In POST /api/dockets initialise totalLabourSubmitted/totalPlantSubmitted to 0 (and drop labourHours/plantHours from the create contract, plus the head-contractor modal hours inputs and the offline-sync hours payload) so the columns only ever hold derived cost.


### H13. [HIGH · DEV] AI certificate review never sets/recomputes pass-fail, so corrected results can be stored with a contradicting pass/fail (or can't be saved at all)
**Area:** Documents / drawings / test results / evidence  
**Location:** `frontend/src/pages/tests/components/UploadCertificateModal.tsx:95-106,141-153; backend/src/routes/testResults/corrections.ts:103-104; backend/src/routes/testResults/extractionConfirmation.ts:18-29,89-93`  
**Detail:** Independently reproduced from source. Both sub-claims (stale passFail after correction; unrecoverable dead-end when AI yields no usable spec/result) are real and currently present. This is the headline AI cert-import flow and the defect lands directly in a quality record used as conformance/hold-point evidence, so high severity is justified. The batch path (BatchUploadModal.tsx:106-124 review data, 161-178 confirm) has the identical gap — also no passFail.  
**Fix:** Add a Pass/Fail control with calculatePassFail auto-recompute to both AI review modals and include passFail in corrections, OR have the backend recompute passFail from the effective resultValue/specMin/specMax whenever any of those is corrected (and avoid throwing RESULT_REQUIRED before giving the user a way to set it).


### H14. [HIGH · DEV] Project switcher selection is silently dropped on every shell navigation — multi-project subbie files dockets against the wrong project
**Area:** Subcontractor portal (end to end)  
**Location:** `frontend/src/shell/subbie/screens/HomeScreen.tsx:260,384,406,418,429,440,451,462,472; frontend/src/shell/subbie/subbieShellData.ts:68-92; frontend/src/shell/subbie/screens/dockets/DocketScreen.tsx:93,110,202`  
**Detail:** Independently verified end to end. The bug is real and currently present: selecting project B on Home then tapping any tile or the bottom-bar action reverts to the default project because the projectId is not threaded through navigations or back-links, and the docket POST uses the default project's id. The assigned-lots dropdown (DocketScreen line 113 useAssignedLotsQuery(userId, company?.projectId)) and the existing-dockets check also key off the default project, so a new docket — the subbie's pay claim — is filed against the wrong project. Backend accepts it because the subbie legitimately has access to the default project, so no error surfaces. High severity is justified: it corrupts pay-claim/labour data integrity for multi-project subbies. One partial mitigation: the wrong project's lots appear in the dropdown, so an attentive subbie might notice unfamiliar lots — but that is not a guard, and the silent default still drives the file path.  
**Fix:** Thread the active projectId through every hub-tile navigation, the 'Add today's hours' action, and every parent back-link (or persist the selected projectId in shell context/storage rather than only in the URL search param) so the selection survives screen transitions and the docket POST targets the intended project.


### H15. [BLOCKER · DEV] Offline ITP N/A and Fail are lost on a no-signal site, contradicting the on-screen 'changes sync when you're back online' promise
**Area:** Foreman mobile shell & mobile UX  
**Location:** `frontend/src/pages/lots/hooks/useItpMobileActions.ts:26-99; frontend/src/shell/screens/lots/useShellItpRun.ts:82-88,190-198; frontend/src/shell/screens/lots/ItpRunScreen.tsx:201-214,574-579`  
**Detail:** Every claim in the finding is borne out by the code: PASS is online-then-offline; N/A and FAIL are online-only with no fallback despite the offline primitive supporting both statuses; the failure path strands the foreman on the item; and the cached-checklist banner contradicts the failure copy. This is a genuine data-loss / workflow-blocking bug on the default foreman experience in exactly the low-signal conditions civil sites face. Blocker severity is justified — the entries that matter most (defects/NCRs) are the ones that cannot be recorded offline.  
**Fix:** Route mobileMarkNA/mobileMarkFailed (or a shell-specific wrapper) through an online-then-offline primitive analogous to writeItpCompletionToggle, calling updateChecklistItemOffline with status 'na'/'failed' on isRetriableNetworkFailure, and queue the FAIL NCR creation for later sync.


### H16. [HIGH · DEV] Sliding to submit the diary offline shows a 'saved — will send when back on signal' ceremony but never queues the submit
**Area:** Foreman mobile shell & mobile UX  
**Location:** `frontend/src/shell/screens/diary/ReviewScreen.tsx:189-218; frontend/src/shell/screens/diary/DoneScreen.tsx:130-157`  
**Detail:** The core defect is real and present: the offline branch shows a success/queued ceremony while persisting and queueing nothing, so a foreman who slides to submit offline gets 'saved, will send' but the office never receives a submitted diary — silent loss of the key end-of-day artefact. CORRECTION to the finding's framing: it implies the legacy/timeline path queues the submit via useDiaryMobileHandlers and the ReviewScreen 'bypasses the handlers.' In reality useDiaryMobileHandlers only queues individual entries (weather/activity/etc.), and the legacy DiaryFinishFlow.handleSubmit (DiaryFinishFlow.tsx:354-367) ALSO does not call submitDiaryOffline in its offline branch — its comment even says 'we don't await it here' but there is no queue call at all. So NEITHER path actually queues the submit; the comparison is inaccurate but the ReviewScreen bug the finding targets is confirmed. High severity (silent data loss) is appropriate.  
**Fix:** In the offline branch, call submitDiaryOffline(projectId, date) (which already enqueues 'diary_submit' the worker can replay) before showing the queued ceremony, and only show 'queued' if the enqueue succeeded. Apply the same fix to the legacy DiaryFinishFlow path, which has the same gap.


### H17. [HIGH · USER] Foreman shell Home renders four dead tiles with no feedback when the foreman has no project
**Area:** Foreman mobile shell & mobile UX  
**Location:** `frontend/src/shell/screens/HomeScreen.tsx:238,291-295,374-380; frontend/src/hooks/useEffectiveProjectId.ts:61-65; frontend/src/components/foreman/ForemanMobileDashboard.tsx:192-229`  
**Detail:** Confirmed: the shell Home shows a normal-looking hub where every tile and the camera silently do nothing for a foreman not yet on a project, with no guidance — a clear regression from two existing surfaces that handle the state. The day-1 'invited but not yet added' state is a realistic pilot condition. High severity is slightly aggressive for an edge case, but defensible: there is genuinely no path forward and it reads as broken, which on a pilot's first impression is costly.  
**Fix:** Read hasNoProject from useEffectiveProjectId and render a dedicated empty state (mirror ForemanMobileDashboard's no-project block) with guidance and a link to /projects; suppress the dead tiles and camera bar in that state.


### H18. [HIGH · DEV] Diary-reminder "end of day" time and digest cutoff use server (UTC) local time, not project/AU time
**Area:** Notifications & alerts  
**Location:** `backend/src/lib/notificationAutomation/helpers.ts:79-82; backend/src/lib/notificationJobs.ts:75-81`  
**Detail:** The mechanism is real and currently present: the 17:00 diary-reminder gate and the digest cutoff are evaluated against the process's local clock, which on Railway is UTC, with no project/AU timezone conversion anywhere. For an AEST/AEDT-targeted product this shifts the intended 5pm fire time by ~8-11 hours. This is a genuine correctness bug. I keep 'high' but note it sits at the medium/high boundary — impact is mistimed nudges/digests (annoyance + reduced usefulness), not data loss or missed delivery; reminders still eventually fire each day, just at the wrong wall-clock hour.  
**Fix:** Add a project timezone field (default Australia/Sydney) and compute the due/cutoff comparison in that timezone via Intl/Luxon instead of server-local time.


### H19. [HIGH · DEV] Name-based @mentions silently fail on production Postgres (case-sensitive equality)
**Area:** Notifications & alerts  
**Location:** `backend/src/routes/notifications/mentions.ts:44-49; backend/src/routes/notifications/mentionUsers.ts:45-49`  
**Detail:** Verified independently: there is no citext column and no insensitive mode, while names are stored with original casing. On Postgres, a display-name @mention produces zero matches and therefore no notification, with no error surfaced to the author. This is a real, currently-present functional gap in a core mentions feature. High severity is appropriate (silent failure of an action-item alert).  
**Fix:** Add `mode: 'insensitive'` to the fullName equality and the autocomplete `contains`, or compare against a stored normalized lowercase name.


### H20. [HIGH · DEV] Diary report summary KPIs are computed from only the current page, not the full filtered set
**Area:** Reports & dashboard  
**Location:** `backend/src/routes/reports/diaryRoutes.ts:111-234; frontend/src/pages/reports/components/DiaryReportTab.tsx:144-294`  
**Detail:** The mismatch is real and currently present: a project with >100 diaries shows a correct totalDiaries headline but understated submitted/draft counts and undercounted personnel/plant/delay hours, with no UI signal and no way to page further. The default limit is 100; verified the summaries are derived from the paginated array, not a DB-side aggregate over whereClause.  
**Fix:** Compute submittedCount/draftCount and all section summaries from full-set aggregate queries (groupBy / DB-side aggregation) over whereClause, independent of pagination; or add an explicit 'totals reflect page only' caption plus a pagination control.


### H21. [HIGH · DEV] Quality-manager ITP completion rate mixes template-item count with per-lot completion count, can exceed 100%
**Area:** Reports & dashboard  
**Location:** `backend/src/routes/dashboard/roleDashboards.ts:360-365,404,441; backend/src/routes/dashboardResponses.ts:245; frontend/src/components/dashboard/QualityManagerDashboard.tsx:277`  
**Detail:** The two operands count different populations: numerator scales with (template items x lots), denominator is just (template items). Once a template is applied to >1 lot and items are verified, numerator exceeds denominator and the rate goes over 100%, shown uncapped. The audit-readiness penalty is also corrupted. Confirmed by code and the schema unique constraint.  
**Fix:** Use one consistent population: denominator = count of all ITPCompletion rows for the project's instances, numerator = verified ITPCompletion rows; clamp to 100%.


### H22. [HIGH · PM] API key and webhook management have no frontend UI — two fully-built backend features are unshipped
**Area:** Settings / company / users / API keys / webhooks / audit  
**Location:** `backend/src/routes/apiKeys.ts (full router), backend/src/routes/webhooks.ts (full router); zero consumers in frontend/src`  
**Detail:** Independently verified: both backend routers are complete and feature-rich, yet there is no frontend surface anywhere that calls them. A non-technical user cannot create/reveal/revoke an API key or configure a webhook through the product. This is real build-but-don't-ship waste and an activation gap for integration features.  
**Fix:** Add an Integrations settings section wired to the existing endpoints: API key list/create (with one-time-secret reveal)/revoke, and webhook create/edit/test/deliveries/regenerate-secret.


### H23. [HIGH · PM] No way to remove a company member or change their role (backend endpoint and UI both missing)
**Area:** Settings / company / users / API keys / webhooks / audit  
**Location:** `backend/src/routes/company/memberRoutes.ts (no remove/role-change endpoint); frontend/src/pages/company/components/CompanyTeamMembersSection.tsx (read-only rows)`  
**Detail:** The core PM gap is confirmed: there is no company-level member removal or role-change path (endpoint or UI). The audit-constant claim is imprecise (project-level routes use them), which I corrected, but it does not change the verdict — a departed employee retains company access and a mis-roled invite can only be fixed by delete-and-reinvite via DB. Note: a company member who is removed from all projects still has companyId set; only /leave (self-service) nulls companyId.  
**Fix:** Add DELETE /api/company/members/:userId and PATCH /api/company/members/:userId (role) with the project-admin orphan invariant and audit logging, plus row actions in CompanyTeamMembersSection.


### H24. [HIGH · DEV] Ownership can be transferred to a pending (never-activated) member, orphaning the company
**Area:** Settings / company / users / API keys / webhooks / audit  
**Location:** `backend/src/routes/company/memberRoutes.ts:501-518; frontend OwnershipTransferModal.tsx:97-101; CompanySettingsPage.tsx:244-246`  
**Detail:** Fully reproducible: an owner can select a never-activated invitee in the dropdown and the backend accepts it, leaving the company with a non-functional owner (no passwordHash, cannot log in to perform owner-only actions or transfer back) and a demoted ex-owner who can no longer transfer. Recovery requires manual DB or support intervention.  
**Fix:** Reject transfer when target has no passwordHash (and is not a subcontractor account); exclude or disable pending members in the modal with a clear reason. The status/hasPassword fields are already in the API response.


### H25. [HIGH · USER] Foreman mobile shell HomeScreen (/m) is a silent dead-end when the foreman has no project assigned
**Area:** USER LENS — first-run & everyday loop (cross-cutting)  
**Location:** `frontend/src/shell/screens/HomeScreen.tsx:238,291-297,374`  
**Detail:** Independently verified in the actual code. The hook surfaces the exact state the screen ignores, two sibling surfaces handle it cleanly, and /m is genuinely the default foreman mobile landing — so a newly-invited foreman with no project assignment (a documented first-session state) sees a normal-looking home where nothing works and nothing explains why. Real, currently present, on the default happy path. Severity high is honest: it is not a crash and a few users hit it, but it is the literal first impression for an onboarding foreman and is indistinguishable from a broken app.  
**Fix:** In HomeScreen read `hasNoProject` from useEffectiveProjectId and, when true, render a clear no-project empty state mirroring ForemanMobileDashboard's 'No Project Assigned' card (explanation + 'View Projects' action) instead of the inert hero/tiles/camera bar. Add a HomeScreen.test.tsx case with hasNoProject:true.


### H26. [HIGH · DEV] Foreman desktop dashboard "Inspections Due Today" lists every ITP item on the project, not items due today
**Area:** PM LENS — completeness, activation & value (cross-cutting)  
**Location:** `backend/src/routes/dashboard/roleDashboards.ts:161-187 (ITP query); count built at backend/src/routes/dashboardResponses.ts:141; rendered at frontend/src/components/dashboard/ForemanDashboard.tsx:388-391`  
**Detail:** Independently verified every link in the chain. The ITP query is genuinely unfiltered by status and date, the count is the raw array length, the card is labelled 'Inspections Due Today', and a correct implementation exists elsewhere in the same codebase. The bug is real and present on the desktop foreman path. Note one minor inaccuracy in the original write-up: ForemanMobileDashboard.tsx is a different code path (mobile shell), not where this query surfaces — but that does not affect the verdict. High severity is honest: it directly corrupts the foreman's primary 'what's due today' trust moment.  
**Fix:** Replace the iTPChecklistItem query with the iTPCompletion query used in operationalRoutes.ts (filter status to pending/in_progress, exclude hold points which are handled separately), or reuse the worklist logic so the desktop and worklist surfaces agree.


### H27. [HIGH · DEV] SOPA business-day / payment-due-date math silently miscomputes for dates beyond 2027 (no runtime staleness guard)
**Area:** SENIOR DEV LENS — cross-cutting correctness & tech debt  
**Location:** `frontend/src/pages/claims/sopaBusinessDays.ts:319-337 + frontend/src/pages/claims/utils.ts:29-71`  
**Detail:** Mechanism fully confirmed. The Christmas window logic (inChristmasWindow) is year-agnostic and would still fire, but date-specific public holidays (Australia Day, Easter, King's Birthday, etc.) for 2028 are absent, so the count is wrong. Direction of error matches the description (due date computed earlier than statutory). SOPA dates are legally significant and drive overdue chips (utils.ts:74-131).  
**Fix:** Add a runtime guard in addBusinessDays (or the calculate* wrappers): if any date in the counted span exceeds SOPA_HOLIDAY_COVERAGE_THROUGH_YEAR, return null and have callers render 'due date unavailable' rather than a confidently-wrong date.


## 2. MEDIUM / LOW confirmed (88)

- **[medium·pm]** Email verification is effectively optional and never enforced anywhere
  - `backend/src/routes/auth.ts:264-397 (login selects email_verified but never gates on it); backend/src/routes/auth/registrationRoutes.ts:227-248 (register issues JWT immediately); backend/src/routes/auth/magicLinkRoutes.ts:193-216; backend/src/middleware/* (no verification middleware)`
  - Fix: Make the policy explicit: either gate sensitive actions (company creation, invites) on verification, or formally treat verification as optional and stop the 24h-token machinery from implying it is required.
- **[low·user]** Verifying email does not refresh the logged-in session; banner persists and copy tells already-logged-in users to 'log in'
  - `frontend/src/pages/auth/VerifyEmailPage.tsx:43-92,199-214; frontend/src/components/EmailVerificationBanner.tsx:22`
  - Fix: On verification success, call refreshUser() (or prompt a reload) and adapt the CTA to 'Continue to dashboard' when an active session exists.
- **[low·pm]** Foreman and subcontractor shells never render the email-verification banner
  - `frontend/src/components/layouts/MainLayout.tsx:8,29; frontend/src/App.tsx:159-183 (/m and /p mounted outside ProtectedAppShell)`
  - Fix: Render the verification reminder in the shell layouts (or a shared wrapper) so mobile/portal users also see it.
- **[low·dev]** ToS acceptance is recorded in a separate non-transactional UPDATE after user creation
  - `backend/src/routes/auth/registrationRoutes.ts:162-181 vs 338-348`
  - Fix: Set tosAcceptedAt: new Date() and tosVersion: CURRENT_TOS_VERSION inside the prisma.user.create() data block, as the invitation flow already does, and drop the raw UPDATE.
- **[low·user]** MFA-enabled accounts can still request a magic link and receive a non-functional login email
  - `backend/src/routes/auth/magicLinkRoutes.ts:47-118 (request) vs 187-191 (verify)`
  - Fix: Detect twoFactorEnabled at request time and either skip the email with a generic message or support the MFA challenge in the magic-link verify flow (taking care not to leak account/MFA existence).
- **[low·dev]** Standalone /api/mfa/verify endpoint returns only {valid:true} and no session token, leaving it unusable for completing login
  - `backend/src/routes/mfa.ts:323-394; backend/src/routes/mfa/responses.ts:29-31; frontend/src/pages/auth/LoginPage.tsx:200-222; frontend/src/lib/auth.tsx:336`
  - Fix: Either return a real session token from /api/mfa/verify (and wire the client to it) or remove the endpoint to avoid an incomplete, misleading auth surface.
- **[medium·pm]** Bulk status update and bulk subcontractor assignment write no audit log
  - `backend/src/routes/lots/bulkMutationRoutes.ts:32-86 (bulk-update-status) and :89-167 (bulk-assign-subcontractor); single assign logs at :277-292`
  - Fix: Emit per-lot (or one batch) AuditLog entries in both bulk handlers mirroring the single-action audit fields.
- **[medium·dev]** Lot PATCH updates (including the only budget edit allowed on conformed lots) are not audit-logged
  - `backend/src/routes/lots.ts:39-237 (PATCH /:id, no createAuditLog); conformed-budget path at :111-130,190-192`
  - Fix: Add createAuditLog to the lot PATCH handler capturing changed fields (especially budgetAmount and status).
- **[medium·user]** Cloning a lot silently drops the ITP — the cloned lot has no inspection plan
  - `backend/src/routes/lots/createRoutes.ts:267-372 (clone); sourceLot select :281-298 omits itpTemplateId; create :328-342 sets none and makes no ITPInstance`
  - Fix: Carry the source lot's itpTemplateId into the clone and create a fresh not_started ITPInstance from the current template snapshot (completions not copied).
- **[low·pm]** Force-conform leaves no durable marker on the lot — reports/UI can't show a lot bypassed prerequisites
  - `backend/src/routes/lots/qualityRoutes.ts:188-275 (conform handler; force recorded only in AuditLog at :259-272); backend/prisma/schema.prisma model Lot (415-468) has no forceConformed flag`
  - Fix: Persist a forceConformed flag (+reason) on the Lot and surface a 'Force conformed' indicator on the lot detail and conformance report.
- **[low·user]** DeleteLotModal copy claims all data will be permanently deleted, but deletion is blocked whenever associated data exists
  - `frontend/src/pages/lots/components/DeleteLotModal.tsx:51-53; backend blockers in backend/src/lib/lotDeletion.ts:48-131`
  - Fix: Reword the modal to note that lots with hold points, dockets, or conformance/claim history cannot be deleted and must be archived, matching backend behaviour.
- **[low·dev]** Lot-number suggestion can miss the true max on very large projects (>10k lots) due to string-ordered scan cap
  - `backend/src/routes/lots/readRoutes.ts:64 (MAX_SUGGEST_NUMBER_LOT_SCAN_RESULTS=10_000),230-238 (orderBy lotNumber desc, take cap); backend/src/routes/lots/suggestNumber.ts:39-57`
  - Fix: Compute the max suffix in SQL (numeric cast / MAX aggregate) instead of a lexically-ordered capped page, or surface a clearer 'lot number already exists' message on the conflict.
- **[medium·dev]** N/A items count toward lot progress but are treated as 'missing' by claim-evidence readiness
  - `backend/src/lib/evidenceReadiness/claimReview.ts:18-36 vs backend/src/routes/itp/helpers/lotProgression.ts:47-53, backend/src/lib/conformancePrerequisites.ts:21`
  - Fix: In claimReview.ts count not_applicable as complete (status==='completed' || status==='not_applicable'), matching lotProgression and conformancePrerequisites.
- **[medium·pm]** Photo/test 'evidence required' on a checklist item is never enforced when completing the item
  - `backend/src/routes/itp/completions.ts:128-605 (POST /completions); frontend/src/components/foreman/mobileItpChecklistHelpers.ts:101-110`
  - Fix: Either enforce required evidence on completion (block 'completed' for evidenceRequired==='photo'/'test' until an attachment/test result exists) or make the advisory nature explicit in docs/UI.
- **[medium·user]** Rejected ITP completion state is invisible in the field UI — subbie/foreman cannot see WHY or that rework is needed
  - `frontend/src/shell/subbie/screens/SubbieItpRunScreen.tsx:514-521; frontend/src/pages/lots/components/ITPChecklistItemRow.tsx (no rejected branch)`
  - Fix: Render a distinct 'Rejected' state with the verifier's reason (verificationNotes) and a clear resubmit affordance in both SubbieItpRunScreen and the classic ITPChecklistItemRow.
- **[low·dev]** holdPointReleaseByItem map silently drops all but the last released hold point sharing a checklist item
  - `backend/src/routes/itp/instances.ts:357-369`
  - Fix: Add a deterministic orderBy (e.g. releasedAt desc) to the released-hold-points query so the most-recent release wins predictably, or key by a guaranteed-unique field.
- **[medium·dev]** Conformance N/A hold-point guard drifts from the shared release-gating definition for 'witness_point' items
  - `backend/src/lib/conformancePrerequisites.ts:217-243 vs backend/src/lib/holdPointReleaseGating.ts:1-11`
  - Fix: Replace the inline predicate in conformancePrerequisites.ts:219-221 with the shared isReleaseGatedChecklistItem() so all four enforcement points use one definition, and update the stale 'in sync' comment.
- **[medium·dev]** Stale comment justifies a race-prone find-then-create instead of an upsert on ITPCompletion (a unique key now exists)
  - `backend/src/routes/holdpoints.ts:371-400 and backend/src/routes/holdpoints/actionRoutes.ts:398-429`
  - Fix: Use prisma upsert on the now-existing compound unique key (where: { itpInstanceId_checklistItemId: { itpInstanceId, checklistItemId } }) in both handlers and delete the stale comments.
- **[medium·pm]** Public secure-link release ignores the project 'Hold Point Releases' notification toggle that the in-app release honours
  - `backend/src/routes/holdpoints.ts:410-502 vs backend/src/routes/holdpoints/actionRoutes.ts:456`
  - Fix: Import isProjectNotificationEnabled and gate the public path's notification.createMany and confirmation emails behind isProjectNotificationEnabled(project.settings, 'holdPointReleases'), matching actionRoutes.ts.
- **[medium·pm]** External superintendent secure-link release cannot capture a signature, unlike the in-app release
  - `frontend/src/pages/holdpoints/PublicHoldPointReleasePage.tsx:430-503 + handleSubmit:178-182 vs backend publicReleaseSchema validation.ts:238-243 and frontend RecordReleaseModal.tsx:316-325`
  - Fix: Add an optional (or method-conditional) signature-pad to PublicHoldPointReleasePage and include signatureDataUrl in the POST body, matching the in-app release.
- **[low·dev]** Public release confirmation email displays the email-send time, not the recorded release time
  - `backend/src/routes/holdpoints.ts:300 vs holdpoints.ts:449`
  - Fix: Format the already-recorded releasedAt from line 300 for the email instead of calling new Date() again at line 449 (rename or reuse the variable).
- **[low·dev]** Unauthenticated public evidence endpoint returns raw Supabase object locators in attachment/photo fileUrl
  - `backend/src/routes/holdpoints.ts:68-222 via evidencePackage.ts:153, 197, 218, 275-284`
  - Fix: Strip fileUrl from the public evidence checklist/photos serialization (the public page only needs filename/caption), or substitute a backend-mediated access URL.
- **[low·user]** Recipient removed from the project after a valid link is issued is blocked from releasing when superintendent-approval is required
  - `backend/src/routes/holdpoints.ts:219 and :286-298 -> superintendentRecipients.ts:86-109; validation.ts:80-82`
  - Fix: When approval is required, run the same eligibility check during GET /public/:token and reflect it in tokenInfo.canRelease plus an explanatory message, so the page communicates the block up front instead of only on submit.
- **[medium·dev]** Foreman/responsible-party 'Respond' affordance shown for non-open NCRs, producing a guaranteed error
  - `frontend/src/shell/screens/issues/issuesShellState.ts:142-150, frontend/src/shell/screens/issues/IssueDetailScreen.tsx:108,244-255, backend/src/routes/ncrs/ncrWorkflow.ts:64-66`
  - Fix: Tighten canForemanRespond to require ncr.status === 'open' (and ideally not already responseSubmittedAt) so the button only appears when /respond will succeed.
- **[medium·pm]** Subbie portal NCR screen is read-only, but the backend expects assigned subcontractors to respond and submit rectification evidence
  - `frontend/src/shell/subbie/screens/NcrsScreen.tsx:137-208, backend/src/routes/ncrs/ncrAccess.ts:187-228, backend/src/routes/ncrs/ncrWorkflow.ts:58-66, backend/src/routes/ncrs/ncrEvidence.ts:239-244`
  - Fix: Either add a subbie NCR detail with respond + evidence upload for NCRs where the subcontractor is responsible, or explicitly decide subcontractors are read-only and stop granting them respond/evidence-mutation server-side.
- **[medium·dev]** Closing an NCR resets affected lots to 'in_progress' regardless of their pre-NCR status, silently dropping 'conformed'
  - `backend/src/routes/ncrs/ncrCore.ts:309-315, backend/src/routes/ncrs/ncrClosureWorkflow.ts:282-288`
  - Fix: Capture the lot's pre-NCR status when setting 'ncr_raised' and restore it on close, or recompute the correct status from evidence rather than defaulting to 'in_progress'.
- **[medium·pm]** Major NCR can be fully closed even though 'client notification required' was never satisfied
  - `backend/src/routes/ncrs/ncrClosureWorkflow.ts:218-256, backend/src/routes/ncrs/ncrCore.ts:284`
  - Fix: Decide whether client notification is mandatory for major-NCR closure; if so, block /close when clientNotificationRequired && !clientNotifiedAt (with an explicit override path), otherwise relabel the flag as optional in the UI.
- **[low·user]** QM 'request revision' wipes the responsible party's submitted response with no preserved history
  - `backend/src/routes/ncrs/ncrWorkflow.ts:238-261`
  - Fix: Preserve prior response text (snapshot into a revisions history or prefill the respond form) so revisions are edits rather than blind full re-entry.
- **[low·dev]** Reopened NCR lands in 'rectification' with stale rectification/response timestamps and can be re-submitted on old evidence
  - `backend/src/routes/ncrs/ncrClosureWorkflow.ts:487-502, backend/src/routes/ncrs/ncrVerificationSubmission.ts:11-22`
  - Fix: On reopen, clear rectificationSubmittedAt/responseSubmittedAt (and consider requiring fresh evidence before re-submission), and record the reopen in explicit history rather than prepending to lessonsLearned.
- **[low·pm]** Frontend submit always sends acknowledgeWarnings:true, making the server-side warning-acknowledgement gate dead
  - `frontend/src/pages/diary/components/DiarySubmitSection.tsx:51-68,82-88; vs backend gate backend/src/routes/diary/diarySubmission.ts:140-197; counter-evidence frontend/src/components/foreman/DiaryFinishFlow.tsx:136-151,339-372 and frontend/src/shell/screens/diary/ReviewScreen.tsx:193-195`
  - Fix: Make DiarySubmitSection follow the mobile pattern (omit acknowledgeWarnings on first submit, let the 422 populate the modal, then resubmit), so all UI paths share the server's warning rules as the single source of truth.
- **[medium·user]** No way to correct a submitted daily diary except free-text addendums (no reopen / amend / edit-with-audit)
  - `backend/src/routes/diary/diaryAccess.ts:70-77,101-104; backend/src/routes/diary/diarySubmission.ts:284-287; frontend/src/pages/diary/components/DiarySubmitSection.tsx:271-275,299-341`
  - Fix: Add a role-gated reopen/amend flow (revert-to-draft with an audit-logged reason, or an approver-only structured edit), rather than relying on addendums alone.
- **[low·pm]** Diary 'lock' state is enforced everywhere but never set — locked_at is dead defensive code with no feature behind it
  - `backend/src/routes/diary/diaryAccess.ts:74-77,105-108; backend/src/routes/dockets/review.ts:294-300; backend/prisma/schema.prisma:817`
  - Fix: Either ship the lock feature (e.g. auto-lock submitted diaries after a cutoff via an endpoint/job that sets lockedAt) or remove the column and the dead guards to avoid implying a capability that does not exist.
- **[low·user]** Copy-from-yesterday affordance and dedupe ignore docket-sourced rows, so the prompt shows and re-adds crew even when docket crew already exists
  - `frontend/src/components/foreman/DiaryMobileView.tsx:102-110; backend/src/routes/diary/diaryReporting.ts:473-492; frontend/src/pages/diary/hooks/useCopyFromYesterday.ts:97-111`
  - Fix: Treat docket-sourced personnel/plant as 'crew already present' when deciding whether to show the copy affordance, and surface docket rows on the timeline so the day does not look empty.
- **[low·dev]** Concurrent first-write to a date returns a confusing 409 'A record with this value already exists' instead of merging
  - `backend/src/routes/diary/diaryCore.ts:266-329; schema.prisma:841; backend/src/middleware/errorHandler.ts:255-261`
  - Fix: Use prisma.upsert on (projectId,date) for the weather write, or catch P2002 in the create branch and fall back to the update path so the operation is genuinely create-or-update under concurrency.
- **[medium·pm]** Quality Manager cannot approve/query/reject dockets despite product docs saying PM/QM can
  - `backend/src/routes/dockets/access.ts:20,128-139`
  - Fix: Add 'quality_manager' to DOCKET_APPROVERS (it is automatically picked up by the respond-handler approver-notification query at review.ts:597, which reuses the same constant).
- **[low·user]** Plant entries lose their adjusted hours on approval — approver hour reduction is invisible while cost silently drops
  - `backend/src/routes/dockets/review.ts:166-174; backend/prisma/schema.prisma:1197-1216; frontend/src/pages/dockets/components/DocketActionModal.tsx:392`
  - Fix: Either add a DocketPlant.approvedHours column and persist it like labour, or render plant per-entry hours via the docket-level approved/submitted plant ratio so the per-line reduction is visible.
- **[low·dev]** Approving with adjusted hours but no matching entries records phantom approved hours with $0 cost
  - `backend/src/routes/dockets/review.ts:108-150; backend/src/routes/dockets/approvalResponse.ts:68-104`
  - Fix: Clamp stored totalLabourApproved/totalPlantApproved to 0 when there are no entries of that class (or ignore adjusted-hours input for an empty entry class) in resolveDocketApprovedTotals / the approve handler.
- **[low·dev]** No invariant that labour lot-allocation hours reconcile with the entry's computed hours
  - `backend/src/routes/dockets/entries.ts:107-160,201-238; backend/src/routes/dockets/validation.ts:140-156; backend/src/routes/dockets/entryCalculations.ts:32-49`
  - Fix: Validate on add/update that the sum of lotAllocation.hours does not exceed the entry's computed hours (within a small tolerance). Low priority until a per-lot hours/cost rollup actually consumes these values.
- **[medium·dev]** Create-Claim readiness endpoint runs an N+1 (one deep conformance query per lot) every time the modal opens
  - `backend/src/routes/claims/readRoutes.ts:160-252; backend/src/lib/conformancePrerequisites.ts:121-160,228-235`
  - Fix: Reuse the already-fetched lot rows (the readiness route already selects holdPoints/testResults/documents) and compute conformance from a single batched query set keyed by lotId, rather than calling checkConformancePrerequisites(lot.id) per lot. A batched ITP-completion + NCR + holdPoint fetch over all lotIds would collapse this to a small constant number of queries.
- **[low·dev]** Claim certified via the generic PUT path records no certifier (certifiedBy) unless variation notes are supplied
  - `backend/src/routes/claims/workflowRoutes.ts:424-434`
  - Fix: In the PUT certified branch, always persist certifiedBy (and certifiedAt) regardless of whether disputeNotes were supplied, mirroring /certify, so the register read-back is consistent across both write surfaces.
- **[low·dev]** SOPA certification/payment due-date countdown mixes UTC date-key parsing with local 'now', risking off-by-one near boundaries
  - `frontend/src/pages/claims/utils.ts:56,69 (new Date(submittedAt)) and :87,:122 (daysUntilDue against local now)`
  - Fix: Compute the day delta on calendar dates in one consistent basis — e.g. compare YYYY-MM-DD keys, or floor both due and now to local midnight before differencing — so the countdown is stable across the day.
- **[low·pm]** Claims summary 'Outstanding' and 'Total Certified' include amounts from later-disputed claims, overstating cash position
  - `frontend/src/pages/claims/claimsPageData.ts:43-54; backend/src/routes/claims/workflowRoutes.ts:440-446`
  - Fix: Either exclude disputed (and other non-current) claims from the certified/outstanding rollups, or clear/segregate certifiedAmount when a claim moves to disputed, so the summary cards reflect only currently-valid certified value.
- **[low·dev]** Certified-then-disputed metadata can become a plain dispute string that drops the recorded certifier/variation/certificate on re-display
  - `backend/src/routes/claims/workflowValidation.ts:279-294; workflowRoutes.ts:424-433; postEvidenceWorkflowRoutes.ts:142-149`
  - Fix: Persist certifier metadata (certifiedBy) at certification time unconditionally in both /certify and PUT, so serializeDisputeNotesForStatusTransition always has certification keys to preserve through a later dispute.
- **[low·dev]** Generic PUT 'paid' transition requires exact full payment, conflicting with the partial-payment model the dedicated endpoint supports
  - `backend/src/routes/claims/workflowRoutes.ts:381-394; postEvidenceWorkflowRoutes.ts:299-372; workflowValidation.ts:210-215`
  - Fix: Funnel all payment recording through /payment, or make the PUT 'paid' branch delegate to the same partial-aware logic and add a 'partially_paid' entry to the transition map, so the two surfaces cannot diverge.
- **[medium·pm]** Failed AI-imported test results skip the NCR prompt that manual entry triggers
  - `frontend/src/pages/tests/TestResultsPage.tsx:359-371 (NCR prompt only in handleCreateTestResult); UploadCertificateModal.tsx:141-177 and BatchUploadModal.tsx:161-202 (confirm paths, no fail handling)`
  - Fix: After AI/batch confirm, detect effective passFail==='fail' and surface the same RaiseNcrModal prompt (with linkedTestResultId). Consider also adding it to the manual Enter Results path for consistency.
- **[medium·dev]** Chainage parsing in lot suggestion is dimensionally wrong (CH 1234+50 treated as 1234.50)
  - `backend/src/routes/testResults/testResultMapping.ts:107-118,146-155; schema.prisma:337-338,400-401`
  - Fix: Interpret the +offset as whole metres (or the project's defined chainage convention) and align units with stored lot chainage; add a unit test fixing the CH N+M semantics.
- **[low·user]** Document list category counts are computed from the current page only, not the full result set
  - `backend/src/routes/documents/listRoutes.ts:124-152; frontend DocumentsPageChrome.tsx:88-110`
  - Fix: Compute the breakdown with prisma.document.groupBy({ by: ['category'], where, _count }) over the full filter (the same `where`), independent of pagination.
- **[low·dev]** Public signed-URL download is not revoked when the granting user loses document/project access
  - `backend/src/routes/documents/fileHelpers.ts:90-118; backend/src/routes/documents/publicRoutes.ts:60-99; mint-time check at fileAccessRoutes.ts:97-108`
  - Fix: Optionally re-run canReadDocument for the token's userId at download time, and/or tighten default/max expiry and add per-document revoke, explicitly accepting the share-link tradeoff.
- **[low·user]** Drawing fileFilter accepts any file whose extension is allowed even if MIME type isn't, with a generic rejection message
  - `backend/src/routes/drawings/storage.ts:39-58; defense-in-depth at backend/src/routes/drawings.ts:91-96 (assertUploadedFileMatchesDeclaredType)`
  - Fix: Mirror the documents path: emit a descriptive message listing supported drawing formats (PDF, JPEG, PNG, TIFF, DWG, DXF) and the offending filename; consider AND-ing mimetype+extension for clarity since the magic-byte check already backstops content.
- **[medium·pm]** Legacy portal pages (ITPs/NCRs/Tests/Hold points/Documents/Docket history) have no project switcher and silently pin multi-project subbies to the default project
  - `frontend/src/pages/subcontractor-portal/SubcontractorITPsPage.tsx:80-89; SubcontractorNCRsPage.tsx:107-116; SubcontractorTestResultsPage.tsx:93-102; DocketsListPage.tsx:98-107; App.tsx:482-538; SubbieShellGuard.tsx:10-12`
  - Fix: Add the availableProjects switcher + ?projectId= plumbing already present on the dashboard/AssignedWorkPage to these legacy pages, or retire the legacy pages in favour of the /p shell (after Finding 1's projectId threading is fixed).
- **[low·user]** Assigned Work lot cards are a dead-end on the legacy page — no way to open the lot's ITP/details
  - `frontend/src/pages/subcontractor-portal/AssignedWorkPage.tsx:285-309; frontend/src/shell/subbie/screens/WorkScreen.tsx:182-185`
  - Fix: Make the legacy LotCard link to the lot ITP (matching the shell WorkScreen), or retire the legacy AssignedWorkPage in favour of the shell.
- **[low·dev]** Docket date uses Sydney-local 'today' on the client but the backend's empty-date fallback uses UTC — a latent off-by-one duplicate/date bug
  - `frontend/src/lib/localDate.ts:1,25-31; backend/src/routes/dockets/validation.ts:242-260; backend/src/routes/dockets.ts:158`
  - Fix: Make parseDocketDate's empty/blank default derive 'today' in the app timezone (Australia/Sydney, e.g. via the shared formatDateKey/timezone helper) so client and server agree on the current docket day even when the date is omitted.
- **[low·user]** Portal module access can be revoked while the subbie is mid-session, but there is no shell-level 'access changed' signal — only per-screen 403s
  - `frontend/src/shell/subbie/subbieShellData.ts:100-103; frontend/src/shell/subbie/screens/NcrsScreen.tsx:170-173; ItpsScreen.tsx:212-215; DocketScreen.tsx:115,654-660; backend/src/lib/projectAccess.ts:207-218`
  - Fix: On a module 403 from a portal data call, invalidate the my-company query (to re-sync tile visibility) and show a consistent 'your access to this section was changed by the head contractor' notice across shell screens, matching the graceful lots-off handling already in DocketScreen.
- **[low·dev]** Backend isolation and RBAC across the subcontractor portal are genuinely strong — few real issues in this area
  - `backend/src/lib/projectAccess.ts:207-218; backend/src/routes/lots/access.ts:19-21,73-129; backend/src/routes/ncrs/ncrAccess.ts:255-338; backend/src/routes/subcontractors/myCompanyRoutes.ts:76-123`
  - Fix: No action required. Preserve the per-module requireSubcontractorPortalModuleAccess + assigned-lot scoping (assignment + legacy) pattern when adding new portal surfaces.
- **[medium·pm]** Legacy foreman bottom nav has no way to reach Docket Approvals, Test Results, ITPs or Hold Points list
  - `frontend/src/components/foreman/ForemanBottomNavV2.tsx:24-56; frontend/src/components/layouts/MobileNav.tsx:51-59,199-216,384-395`
  - Fix: Add a 'More'/menu affordance (or a Dashboard tab) to ForemanBottomNavV2 that opens the FOREMAN_MENU_ITEMS drawer, ensuring at minimum Docket Approvals and Test Results are reachable from the legacy foreman experience.
- **[medium·user]** Capture modal's top 'Save' button silently discards the type/description/lot the foreman already set
  - `frontend/src/components/foreman/CaptureModal.tsx:276-303,365-367,469-487`
  - Fix: Make the header Save honour the current state (call handleSave), or relabel it (e.g. 'Save as photo') so the discard is explicit. Do not reset user input silently inside a 'Save' handler.
- **[medium·dev]** Mobile ITP 'Pass' from the detail sheet doesn't await the save and closes the sheet even if it fails
  - `frontend/src/components/foreman/MobileITPChecklist.tsx:41-49,204-237; frontend/src/pages/lots/hooks/useItpInstance.ts:265-301`
  - Fix: Make onToggleCompletion return Promise<boolean> (or a result) and await it in onPass, closing the sheet only on success — matching onNA/onFail's contract.
- **[low·user]** Shell header SyncChip shows 'N waiting ↑' / 'N failed' but is not tappable; the only retry/resolve control is a separate floating pill
  - `frontend/src/shell/components/SyncChip.tsx:50-79; frontend/src/components/OfflineIndicator.tsx:94-148; frontend/src/App.tsx:552`
  - Fix: Either drop the actionable '↑' so the chip reads purely as status, or make it interactive and route to / surface the OfflineIndicator's retry/resolve actions.
- **[low·pm]** Capture 'Note' type isn't a real note — it's stored only as a photo caption and toasts 'Photo saved'
  - `frontend/src/components/foreman/CaptureModal.tsx:142-143,171,217-249,482-483`
  - Fix: Either route 'Note' to a real diary-note/register entry, or relabel it (e.g. 'Photo + note') with an accurate success message; consider allowing a note without a mandatory photo.
- **[medium·dev]** Duplicate missing-diary notifications: two automation jobs alert the same PM for the same date
  - `backend/src/lib/notificationAutomation/diaryAutomation.ts:185-267; backend/src/lib/notificationAutomation/systemAutomation.ts:297-358; orchestrated in backend/src/lib/notificationAutomation.ts:394-400`
  - Fix: Consolidate missing-diary alerting into a single job, or share one dedupe key/notification type across both paths so each recipient is notified once per project/day.
- **[medium·dev]** POST /alerts/check-escalations can double-escalate and double-notify (no concurrency guard)
  - `backend/src/routes/notifications/alerts.ts:264-370; backend/src/routes/notifications/alertPersistence.ts:66-82`
  - Fix: Apply the same conditional updateMany guard (or wrap in the advisory-lock transaction) in the route, or retire the route in favour of the worker.
- **[medium·user]** Notifications page is capped at 20 items with no pagination; filters only see that window
  - `frontend/src/pages/NotificationsPage.tsx:82-93; backend default DEFAULT_NOTIFICATION_LIMIT=20 in backend/src/routes/notifications/validation.ts:16`
  - Fix: Add pagination / 'load more' using the existing limit/offset params, or push the type/unread filter to the server so the filtered view isn't truncated to the first 20 rows.
- **[medium·dev]** GET /alerts can be starved by escalated alerts from other tenants (unbounded OR before in-memory filter)
  - `backend/src/routes/notifications/alerts.ts:167-203 then 205-212`
  - Fix: Scope the escalated-alert OR branch to the requesting user (e.g. an escalatedToId column or per-user/project condition) so the 500-row cap isn't consumed by unrelated tenants.
- **[low·dev]** Two parallel system-alert generators (worker + HTTP route) duplicate logic and in-app notifications
  - `backend/src/routes/notifications/systemAlerts.ts:30-319 vs backend/src/lib/notificationAutomation/systemAutomation.ts:138-362`
  - Fix: Make the HTTP route delegate to processSystemAlerts (single source of truth), or clearly scope/disable the route in production.
- **[low·pm]** Subcontractor portal has no notification list, bell, or read/unread management
  - `frontend/src/shell/subbie/screens/HomeScreen.tsx:315-341; frontend/src/pages/subcontractor-portal/subcontractorDashboardHelpers.ts:147-191; backend/src/routes/notifications/access.ts:78-123`
  - Fix: Either give the portal a real notification inbox with portal-relative links, or stop creating subbie-targeted in-app notifications the portal can't display/route.
- **[low·user]** Notifications page exposes no per-item actions (no per-notification dismiss/delete, no individual undo of mark-read)
  - `frontend/src/pages/NotificationsPage.tsx:95-233; backend DELETE /api/notifications/:id at backend/src/routes/notifications/userRoutes.ts:160-188`
  - Fix: Surface per-item delete (wire DELETE /:id) and consider a per-item read toggle; the API already supports both.
- **[medium·dev]** PM dashboard lot-progress breakdown omits valid statuses and tracks a non-existent 'on_hold' status
  - `backend/src/routes/dashboard/roleDashboardResponses.ts:113-146 and the duplicate inline copy in projectManagerDashboardRoute.ts:69-86; frontend/src/components/dashboard/ProjectManagerDashboard.tsx:250-285`
  - Fix: Map 'hold_point' (not 'on_hold') to the hold bucket and add buckets for awaiting_test, ncr_raised, and claimed so the breakdown reconciles with total. Also de-duplicate the inline copy in projectManagerDashboardRoute.ts.
- **[medium·pm]** Cost-trend and PM cost-tracking use SUBMITTED docket amounts and include unapproved dockets, overstating spend
  - `backend/src/routes/dashboard/operationalRoutes.ts:122,130-133,166-167; backend/src/routes/dashboard/projectManagerDashboardRoute.ts:178-181; backend/src/routes/dashboard/roleDashboardResponses.ts:205-213`
  - Fix: Aggregate the approved cost fields and restrict the cost trend to approved dockets, or clearly label submitted vs approved in the UI.
- **[medium·user]** Lot-status and NCR report detail tables silently truncate at the first page with no pagination UI or count caption
  - `backend/src/routes/reports/lotStatusRoutes.ts:59-78; backend/src/routes/reports/ncrRoutes.ts:64-81; frontend/src/pages/reports/components/LotStatusTab.tsx:207-229; frontend/src/pages/reports/components/NCRReportTab.tsx`
  - Fix: Add pagination controls or a 'Showing first 100 of N — refine filters to see the rest' caption to the lot-status and NCR report tables, mirroring the backend pagination metadata already returned.
- **[low·dev]** Diary report end-date filter omits end-of-day, inconsistent with test/claims reports
  - `backend/src/routes/reports/diaryRoutes.ts:94; contrast backend/src/routes/reports/testRoutes.ts:73 and backend/src/routes/reports/claimRoutes.ts:136`
  - Fix: Pass endOfDay=true for the diary end-date parse (or normalize diary date to midnight on write) to match the other report routes.
- **[low·pm]** PM dashboard is single-project despite portfolio framing and silently shows only the most-recently-updated active project
  - `backend/src/routes/dashboard/projectManagerDashboardRoute.ts:42-51`
  - Fix: Either aggregate across the PM's accessible projects or make the selected project explicit and sticky, and clearly label the dashboard as single-project.
- **[medium·dev]** API keys are per-user only — owners cannot see or revoke keys created by other members, and leaving the company does not revoke them
  - `backend/src/routes/apiKeys.ts:230-293; backend/src/routes/company/memberRoutes.ts:101-165 (leave); backend/src/lib/apiKeyRevocation.ts`
  - Fix: Add a company-admin API key inventory + revoke endpoint and call revokeActiveApiKeysForUser inside the leave/remove transactions.
- **[medium·dev]** Audit-trail writes are best-effort and outside the action's transaction, so the compliance log can silently miss events
  - `backend/src/lib/auditLog.ts:65-91; call sites company.ts:266, memberRoutes.ts:411/520, webhooks.ts:225/335, apiKeys.ts:210/277`
  - Fix: For privileged company/security actions, write the audit row inside the same transaction, or add reconciliation/alerting when createAuditLog fails instead of silently swallowing it.
- **[low·dev]** Audit-log CSV export fetches every page into browser memory with no upper bound
  - `frontend/src/pages/admin/AuditLogPage.tsx:165-179 (fetchAllLogsForExport), :208-229 (exportToCSV)`
  - Fix: Add a server-side streaming/paginated CSV export endpoint, or cap the client export to a date window / max rows with a clear message.
- **[low·pm]** quality_manager cannot view any audit logs, even for their own projects
  - `backend/src/routes/auditLog.ts:17 (AUDIT_LOG_ROLES) and :30-71 (getAuditLogAccessWhere); frontend/src/appRouteRoles.ts:1 (ADMIN_ROLES)`
  - Fix: If product intent is for quality_manager to self-serve quality investigations, add it to AUDIT_LOG_ROLES (project-scoped) and ADMIN_ROLES for the audit-log route. Otherwise document the escalation path.
- **[low·user]** Project managers reach Company Settings and see an editable company form they cannot save
  - `frontend App.tsx:412-415 (ADMIN_ROLES gate); frontend CompanySettingsSections.tsx CompanyInformationCard (lines 31-192); backend company.ts:439 PATCH uses requireCompanyAdmin`
  - Fix: Render the company-info form read-only (or hide the Save button) for non-owner/admin roles, mirroring the backend requireCompanyAdmin rule. Pass a canEdit prop derived from the same role check used for the team/transfer sections.
- **[low·pm]** Two divergent mobile-foreman surfaces depending on entry path (/m shell vs /projects/:id/foreman classic)
  - `frontend/src/pages/projects/ProjectDetailPage.tsx:17-21; frontend/src/App.tsx:215-225; frontend/src/shell/shellFlag.ts:149-160`
  - Fix: Have ProjectDetailPage's mobile-foreman redirect target /m (or /m with a project query) so both entry points converge on one surface, once /m handles the no-project case (finding 1).
- **[low·user]** Subbie shell home computes docket-prerequisite state then discards it, so first-session setup guidance is weaker than the classic portal
  - `frontend/src/shell/subbie/screens/HomeScreen.tsx:343-352; contrast frontend/src/pages/subcontractor-portal/SubcontractorDashboard.tsx:387-411`
  - Fix: Use the computed getDocketPrerequisiteState result on the subbie shell home to render the same 'finish setup' notice the classic dashboard shows (re-using the existing copy), or remove the dead call if deferral is intentional.
- **[medium·pm]** PM/QM/Foreman role dashboards silently show only ONE project with no switcher, breaking the multi-project persona
  - `backend/src/routes/dashboard/projectManagerDashboardRoute.ts:46-47, roleDashboards.ts:91 (foreman) and :266 (quality_manager); frontend ProjectManagerDashboardChrome.tsx:7-23 (display-only context); SubcontractorDashboard.tsx:310-331 (has a real switcher); Sidebar.tsx:87-91 + roles.ts:52-53`
  - Fix: Add a project switcher to the PM/QM/foreman dashboards mirroring the subbie portal's <select>, and/or surface a Portfolio/portfolio-aware link for quality_manager, site_manager and project_manager (currently all locked out of Portfolio by isAdminRole).
- **[medium·pm]** Quality Manager / Project Manager dashboards have no first-run empty state; a fresh tenant sees a misleading metrics wall instead of setup guidance
  - `frontend/src/components/dashboard/QualityManagerDashboard.tsx:157,222 (no project===null branch) + defaultQMData:89-98; ProjectManagerDashboard.tsx:131-132; backend buildEmptyQualityManagerDashboardResponse dashboardResponses.ts:149-170; contrast DashboardPage.tsx:291-316`
  - Fix: When data.project is null on the QM and PM dashboards, render a setup/empty state (reuse DashboardSetupChecklist or DashboardMemberSetupNotice) instead of the all-zero/100% metric grid.
- **[low·pm]** Dashboard setup checklist 'Assign an ITP template' step never ticks and points only at the generic /projects route
  - `frontend/src/components/dashboard/DashboardSetupChecklist.tsx:49-64`
  - Fix: Fetch template/member counts to tick steps 3-4, and deep-link the ITP step to a lot's quality/ITP-assignment surface rather than /projects. The team step's /company-settings target is acceptable.
- **[low·pm]** Claim submission method is collected but ignored; 'submitted' is a self-asserted state with no recipient or transmission
  - `frontend/src/pages/claims/ClaimsPage.tsx:189-235 (handleSubmitClaim ignores _method); components/SubmitClaimModal.tsx:28-69; submissionOptions.ts:9-15`
  - Fix: Either persist a submission/method/recipient field on the claim for the audit trail, or (since there is only one option) drop the option-array indirection and the unused _method parameter so the code doesn't imply a choice mechanism that isn't there.
- **[medium·dev]** Concurrent diary create race turns a benign duplicate into a permanent-looking offline sync error
  - `backend/src/routes/diary/diaryCore.ts:266-329 + frontend/src/lib/offline/syncWorker.ts:131-136,261-266,402-406`
  - Fix: Catch P2002 in the diary POST handler and re-read + return the existing diary as 200, mirroring the claims unique-constraint handling, so the upsert is genuinely idempotent under concurrency.
- **[medium·dev]** Hold-point release date/time parsed in server-local (UTC) time while scheduled date uses Date.UTC — inconsistent, en-AU release timestamps shift
  - `backend/src/routes/holdpoints/dateParsing.ts:77 vs :22`
  - Fix: Apply a single explicit timezone convention (ideally the project/app timezone via the existing localDate helper) to both release and scheduled parsing, and document it.
- **[low·dev]** 'Today' is computed inconsistently (server-local vs UTC) across diary and docket date defaults
  - `backend/src/routes/diary/diarySubmission.ts:83-85 vs backend/src/routes/dockets/validation.ts:242-260`
  - Fix: Centralise 'today' on one timezone-aware helper and use it for both the late-submission check and the docket date default.
- **[low·dev]** Equal start/finish time logs a 24-hour shift as 0 hours
  - `backend/src/routes/dockets/entryCalculations.ts:17-19`
  - Fix: Decide and document semantics for start == finish (reject as ambiguous, or treat as 24h) rather than silently returning 0.
- **[low·pm]** Stale tech-debt guidance in CLAUDE.md: the 'giant route files' have already been split into folders
  - `CLAUDE.md 'Known Large Files' section vs backend/src/routes/{holdpoints,lots,notifications,auth,dockets}`
  - Fix: Rewrite the 'Known Large Files' section to reflect the completed splits; point only at files that are still genuinely large today (e.g. frontend syncWorker.ts ~932 lines) and re-measure before listing any.
- **[low·dev]** Cross-cutting correctness is largely SOLID — money, locking, N+1, subbie isolation, offline idempotency all well-handled
  - `backend/src/routes/claims/workflowRoutes.ts:48-160; backend/src/routes/dashboard/portfolio.ts:195-234; backend/src/routes/dockets/access.ts:141-211; backend/prisma/schema.prisma:1166-1204`
  - Fix: Keep as context. Treat findings 1-7 as discrete fixes; no broad correctness overhaul is warranted.

## 3. GAP ROUND (15 — cross-cutting surfaces the main sweep under-examined)

- **[high·pm]** Tier quotas are enforced but there is no upgrade path: companies that hit the basic 3-project / 5-user ceiling are permanently blocked
  - GAP: Billing / subscription tier — no upgrade path exists (dead-end monetisation surface)
  - `backend/src/routes/projects/writeRoutes.ts:262-275; backend/src/routes/company/memberRoutes.ts:326-339; backend/src/routes/projects/sampleProjectRoute.ts:296-302; backend/src/routes/reports.ts:86-90; backend/src/lib/tierLimits.ts`
  - Fix: Either feature-flag tier enforcement OFF until a real upgrade path exists, or ship a minimal admin/self-serve endpoint that can write subscriptionTier (gated by billing) before relying on quotas in any paid pilot.
- **[high·user]** In-app 'Upgrade your plan' prompts are dead-end text with no button, link, or action
  - GAP: Billing / subscription tier — no upgrade path exists (dead-end monetisation surface)
  - `frontend/src/pages/company/components/CompanyUsageSection.tsx:31,64-66,100-102`
  - Fix: Make the upgrade copy actionable — link it to a real upgrade flow, or replace it with honest copy that sets expectations until billing ships.
- **[low·pm]** Support form offers a 'billing' category, implying self-serve billing exists when it does not
  - GAP: Billing / subscription tier — no upgrade path exists (dead-end monetisation surface)
  - `backend/src/routes/support.ts:14`
  - Fix: Treat the 'billing' support category as an interim manual-ops path and document the manual tier-change runbook, until a real billing integration replaces it.
- **[high·pm]** Web-push notifications are never triggered by any real domain event (only the manual test/send endpoints fire them)
  - GAP: Web-push notifications are registered but NEVER triggered by any real event
  - `backend/src/routes/pushNotifications/delivery.ts:63,150 (sendPushNotification / broadcastPushNotification) — zero domain callers; verified via grep across backend/src`
  - Fix: Add a single push fan-out helper (e.g. in lib/notificationAutomation) that mirrors each notification.create/createMany to sendPushNotification/broadcastPushNotification for the recipient userIds, and invoke it alongside the existing in-app + email writes at the domain notification sites.
- **[high·user]** Push settings UI explicitly promises hold-point / NCR / mention pushes that the backend never sends
  - GAP: Web-push notifications are registered but NEVER triggered by any real event
  - `frontend/src/components/settings/PushNotificationSettings.tsx:173-176 and :290`
  - Fix: Wire real events to push (preferred), or until then soften the copy to 'test notifications only' so the UI does not promise event delivery it cannot make.
- **[medium·dev]** In-app and email notifications are fanned out per-site with no shared create-and-deliver helper, so push (and any future channel) cannot be added in one place
  - GAP: Web-push notifications are registered but NEVER triggered by any real event
  - `backend/src — ~25 direct prisma.notification.create/createMany call sites (e.g. ncrs/ncrCore.ts:179,353,427,536; holdpoints.ts:434; dockets/review.ts:619; claims/workflowRoutes.ts:530,593; itp/completions.ts:566; notifications/mentions.ts:80)`
  - Fix: Introduce one createNotifications(...) helper that writes in-app rows and fans out to email + push, then migrate the domain sites onto it incrementally.
- **[high·dev]** Outbound webhooks never fire: no domain event ever calls triggerWebhooks
  - GAP: Outbound webhooks are configurable but no domain event ever fires one
  - `backend/src/routes/webhooks/delivery.ts:315 (triggerWebhooks) — zero callers; only real delivery is webhooks.ts:451 (deliverWebhook, event 'test')`
  - Fix: Either wire triggerWebhooks into the relevant domain mutations (ncr.created, holdpoint.released, lot.status_changed, etc.) behind a documented event catalog, or feature-flag/hide webhook creation until emission exists — do not ship a configurable-but-dead integration.
- **[medium·pm]** Webhook event names are unconstrained free-form strings with no catalog of real events
  - GAP: Outbound webhooks are configurable but no domain event ever fires one
  - `backend/src/routes/webhooks/validation.ts:57-85 (normalizeEvents) and :9 (WEBHOOK_EVENT_PATTERN)`
  - Fix: Define a canonical emitted-events catalog, validate subscriptions against it (reject unknown events with a 400), and document it; back it with real emission before exposing the feature.
- **[low·dev]** GAP REFUTED: all three background workers now have proper cross-replica concurrency guards
  - GAP: Background workers run on every replica with no leader election (duplicate emails/escalations at scale)
  - `backend/src/lib/notificationAutomation/runner.ts:78-83; backend/src/lib/notificationJobs.ts:242-247; backend/src/lib/scheduledReports.ts:64-75,97-107; backend/.env.example:32-40`
  - Fix: No change needed for the workers; the advisory-lock + atomic-claim design is sound and idempotent across replicas.
- **[medium·dev]** Manual check-escalations endpoint uses non-atomic read-then-write — double-escalates and double-emails under concurrency
  - GAP: Background workers run on every replica with no leader election (duplicate emails/escalations at scale)
  - `backend/src/routes/notifications/alerts.ts:264-370 (handler) calling updateAlertEscalation in backend/src/routes/notifications/alertPersistence.ts:66-82`
  - Fix: Route check-escalations through the locked job (processAlertEscalations / processNotificationAutomationWithLock) or change updateAlertEscalation here to a compare-and-set updateMany guarded on the prior escalationLevel and skip notify when count===0; also add requireNotificationAdmin.
- **[medium·pm]** Diary reminder / missing-diary date and due-time math runs in UTC, not Australian local time
  - GAP: Background workers run on every replica with no leader election (duplicate emails/escalations at scale)
  - `backend/src/lib/notificationAutomation/helpers.ts:43-45 (formatDateKey), :58-82 (getPreviousWorkingDay/isWorkingDay/isDueForProjectTime); backend/Dockerfile (no TZ set)`
  - Fix: Evaluate working-day, due-time, and date-key logic in the project's configured timezone (or document AU local) and keep formatDateKey consistent with whatever local basis the gating uses.
- **[high·dev]** Data-retention token cleanup is implemented but never scheduled — used/expired bearer tokens accumulate permanently in production
  - GAP: Data-retention / token-cleanup is implemented but never scheduled — stale bearer tokens accumulate
  - `backend/scripts/data-retention.ts:308 (applyRetentionPolicies) + backend/src/server.ts:167-169 (only 3 workers started); no npm script, no GitHub Actions schedule (.github/workflows/), no Railway cron invokes it`
  - Fix: Add a guarded scheduled invocation of the retention apply path for the short-lived token tables (a nightly GitHub Actions `schedule` job mirroring database-backup.yml, or a server.ts interval worker behind an env flag).
- **[high·dev]** Used hold-point release tokens are never deleted on use — long-lived stale capability tokens persist with no time-based purge
  - GAP: Data-retention / token-cleanup is implemented but never scheduled — stale bearer tokens accumulate
  - `backend/src/routes/holdpoints.ts:303-315 (consume sets usedAt, does not delete); backend/prisma/schema.prisma:626-644 (HoldPointReleaseToken)`
  - Fix: Schedule the retention sweep (prior finding) and/or delete the release token in the same transaction once usedAt is set; add an index on (usedAt, expiresAt).
- **[medium·dev]** Email-verification tokens are marked used but never deleted; no time-based cleanup runs
  - GAP: Data-retention / token-cleanup is implemented but never scheduled — stale bearer tokens accumulate
  - `backend/src/routes/auth/emailVerificationRoutes.ts:95-102 (consume sets usedAt, no delete); cleanup only in unscheduled data-retention.ts apply`
  - Fix: Include emailVerificationToken in a scheduled retention sweep, or delete on successful consume.
- **[low·dev]** documentSignedUrlToken is only opportunistically cleaned — stops being purged if signed-URL generation goes idle
  - GAP: Data-retention / token-cleanup is implemented but never scheduled — stale bearer tokens accumulate
  - `backend/src/routes/documents/fileHelpers.ts:61-65 (cleanupExpiredSignedUrlTokens), invoked at :76 (on create) and :108 (on expired validate)`
  - Fix: Acceptable as-is; if a global retention sweep is added, include this table for completeness but treat it as low priority.

## 4. Downgraded by refute (raised high, but adversarial pass cleared them)

- OAuth-only users who enable MFA are permanently locked out with no self-service recovery
  - Why cleared: The finding's individual code claims are all accurate, but its central thesis — "permanently locked out with NO self-service recovery, requires manual DB intervention" — is refuted by the password-reset flow, which the finding did not account for. An OAuth-only user who enables MFA CAN recover entirely via self-service: 1. Login page has a "Forgot password?" link (LoginPage.tsx:453) routed to /forgot-password (App.tsx:135). 2. POST /api/auth/forgot-password (passwordResetRoutes.ts:75-142) looks up the user by EMAIL ONLY — it does not require an existing password, so OAuth-only users receive a reset email. OAuth users are created with emailVerified:true (oauth.ts:555), so no verification gate blocks them. 3. POST /api/auth/reset-password (passwordResetRoutes.ts:145-235) SETS passwordHash unconditionally — there is NO MFA gate and NO OAuth restriction on this route. The OAuth-only user now has a password. 4. They sign in with email + password + MFA code. The password-login MFA branch (auth.ts:308-348) accepts both a TOTP from their still-configured authenticator AND the backup codes shown at enrollment (MfaSecuritySection.tsx:302-347). This is exactly what the on-screen mfa_required message instructs ("Sign in with your email, password, and verification code" — LoginPage.tsx:39, OAuthCallbackPage.tsx:9). For an OAuth-only user, "your password" is established via the ordinary forgot-password flow. No DB intervention is needed, so the high-severity premise is incorrect. Residual nuance (does NOT sustain the finding as written): the recovery path is non-obvious (an OAuth user never set a password and may not realize "Forgot password?" is the way back), and the disable dialog genuinely lacks a TOTP/backup-code field (MfaSecuritySection.tsx:349-415; useMfaSettings.ts:180-183 sends only {password}) even though the backend /disable accepts a code (mfa.ts:240-300). That is a discoverability/UX-polish gap worth a small improvement, not a permanent lockout. Hence stillReal=false, severity low.
- Labour docket entry can be created with 0 hours / $0 cost (times are optional, no guard)
  - Why cleared: The finding's load-bearing claim — that the 0-hour/$0 labour entry is "reachable through the real subcontractor portal, not only via raw API" — is REFUTED by the actual UI code. Both real portal UIs always couple a lot allocation to the labour POST, using the SAME computed hours: - frontend/src/pages/subcontractor-portal/DocketEditPage.tsx:223,233 — `const hours = calculateHours(startTime, finishTime)` then `lotAllocations: [{ lotId: selectedLotId, hours }]`. - frontend/src/shell/subbie/screens/dockets/DocketScreen.tsx:270,279 — identical pattern. The Add button requires `selectedLotId` (DocketEntrySheet.tsx:255), so a lot allocation is always present. If the subbie clears both time fields, `calculateHours('', '')` returns 0 (docketEditHelpers.ts:9), so the payload is `lotAllocations: [{ lotId, hours: 0 }]`. That allocation is validated by `lotAllocationSchema` (validation.ts:140-143) whose `hours` is `dailyHoursNumber` = `.gt(0)` (validation.ts:41). So the backend rejects the request with 400 ("...must be greater than 0") and creates NO entry — the same guard the backend test proves for `hours: -1` (dockets.test.ts:799-809; 0 fails `.gt(0)` identically). The verifier overlooked that the UI attaches the zero-valued lot allocation to every labour POST, which is what actually blocks the journey. What remains real is only a minor schema asymmetry: `addLabourEntrySchema` makes startTime/finishTime AND lotAllocations all `.optional()` (validation.ts:147-155), so a hand-crafted raw API POST of `{ employeeId }` alone persists submittedHours:0/submittedCost:0 (entries.ts:126-128,139-141), whereas plant requires hoursOperated `.gt(0)`. But this is reachable ONLY by bypassing the UI; it is self-inflicted under-billing of the subbie's OWN labour; the zeroed line is visible to the human approver in the mandatory pending_approval review (approvalResponse.ts:62,109-116) before it counts toward anything. That is an input-hygiene gap, not the portal-reachable silent under-billing the finding describes. Recommendation: downgrade from "high" to a low-severity hardening item (add a superRefine requiring both times or a non-empty positive lotAllocation on addLabourEntrySchema, mirroring plant), and correct the reachability claim — it is not reachable through the real subcontractor portal.
