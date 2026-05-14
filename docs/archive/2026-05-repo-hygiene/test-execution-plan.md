# SiteProof Comprehensive Test Execution Plan

## Overview

**Approach:** Critical Path Testing (Option B)
**Goal:** Test every feature by creating real test data and walking through complete user journeys
**Philosophy:** Create once, test everything - use test profiles and test project to exercise all features

---

## Phase 0: Test Environment Setup

### 0.1 Create Test Head Contractor Account
- Register new account: `test-hc@siteproof-test.com`
- Password: `TestPassword123!`
- Verify email (or use existing account if registration tested before)
- This isolates test data from production user data

### 0.2 Create Test Project
- Project Name: `TEST - Full Regression Project`
- Project Code: `TEST-001`
- Status: Active
- This project will be used to test ALL features

### 0.3 Create Test Subcontractor (when needed)
- Company: `Test Subcontractor Pty Ltd`
- Contact: `test-sub@siteproof-test.com`
- Will be invited to test project
- Used to test full subcontractor portal flow

---

## Phase 1: Head Contractor Core Journey

### 1.1 Authentication Tests
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.1.1 | Login with test account | Redirect to dashboard |
| 1.1.2 | Verify dashboard loads | Stats, widgets visible |
| 1.1.3 | Test logout | Redirect to login page |
| 1.1.4 | Test invalid login | Error message shown |

### 1.2 Project Creation & Setup
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.2.1 | Navigate to Projects | Projects list loads |
| 1.2.2 | Click "New Project" | Creation modal opens |
| 1.2.3 | Fill project details | Form accepts input |
| 1.2.4 | Submit project | Project created, redirects to project |
| 1.2.5 | Verify project in list | New project visible |

### 1.3 Lots Management (Within Test Project)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.3.1 | Navigate to Lots | Lots page loads |
| 1.3.2 | Create Lot "LOT-TEST-001" | Lot created |
| 1.3.3 | Create Lot "LOT-TEST-002" | Second lot created |
| 1.3.4 | View lot details | Details panel opens |
| 1.3.5 | Edit lot | Changes saved |
| 1.3.6 | Change lot status | Status updated |
| 1.3.7 | Filter lots | Filter works |
| 1.3.8 | Search lots | Search works |

### 1.4 ITPs (Inspection Test Plans)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.4.1 | Navigate to ITPs | ITPs page loads |
| 1.4.2 | Create new ITP | ITP created |
| 1.4.3 | Link ITP to lot | Association saved |
| 1.4.4 | Complete checklist item | Item marked complete |
| 1.4.5 | View ITP details | Details shown |

### 1.5 Hold Points
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.5.1 | Navigate to Hold Points | Page loads |
| 1.5.2 | Create hold point | Hold point created |
| 1.5.3 | Link to lot | Association saved |
| 1.5.4 | Add notification recipient | Recipient added |
| 1.5.5 | Release hold point | Status changes to released |

### 1.6 Test Results
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.6.1 | Navigate to Test Results | Page loads |
| 1.6.2 | Create test result (Pass) | Result saved |
| 1.6.3 | Create test result (Fail) | Result saved |
| 1.6.4 | Link to lot | Association saved |
| 1.6.5 | Filter by pass/fail | Filter works |
| 1.6.6 | Edit test result | Changes saved |

### 1.7 NCRs (Non-Conformance Reports)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.7.1 | Navigate to NCRs | Page loads |
| 1.7.2 | Raise new NCR | NCR created |
| 1.7.3 | Assign category | Category saved |
| 1.7.4 | Assign severity | Severity saved |
| 1.7.5 | Assign responsible party | Assignment saved |
| 1.7.6 | Update NCR status | Status changed |
| 1.7.7 | Close NCR | NCR closed |
| 1.7.8 | Filter NCRs | Filters work |

### 1.8 Daily Diary
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.8.1 | Navigate to Daily Diary | Page loads |
| 1.8.2 | Create diary entry | Entry created |
| 1.8.3 | Add weather data | Weather saved |
| 1.8.4 | Add personnel | Personnel saved |
| 1.8.5 | Add plant/equipment | Plant saved |
| 1.8.6 | Add activities | Activities saved |
| 1.8.7 | Add delay record | Delay saved |
| 1.8.8 | Edit diary entry | Changes saved |

### 1.9 Documents
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.9.1 | Navigate to Documents | Page loads |
| 1.9.2 | Upload document | File uploaded |
| 1.9.3 | View/download document | File downloads |
| 1.9.4 | Delete document | File removed |

### 1.10 Reports
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.10.1 | Navigate to Reports | Page loads |
| 1.10.2 | Generate report | Report generated |
| 1.10.3 | Export report | File downloads |

### 1.11 Project Settings
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1.11.1 | Navigate to Project Settings | Page loads |
| 1.11.2 | Edit project details | Changes saved |
| 1.11.3 | View team members | List shown |

---

## Phase 2: Subcontractor Invitation & Management

### 2.1 Invite Subcontractor
| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.1.1 | Navigate to Subcontractors | Page loads |
| 2.1.2 | Click "Invite Subcontractor" | Modal opens |
| 2.1.3 | Select "Create New" | Form enabled |
| 2.1.4 | Fill subcontractor details | Form accepts input |
| 2.1.5 | Send invitation | Invitation sent, subcontractor appears in list |
| 2.1.6 | Verify email sent | Check logs or email |

### 2.2 Manage Subcontractor (Before Acceptance)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 2.2.1 | View subcontractor details | Expand panel works |
| 2.2.2 | Check status is "Pending" | Correct status shown |

---

## Phase 3: Subcontractor Portal Journey

### 3.1 Accept Invitation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.1.1 | Open invitation link | Accept invite page loads |
| 3.1.2 | Register new account | Account created |
| 3.1.3 | Accept invitation | Redirects to portal |
| 3.1.4 | Verify portal dashboard | Dashboard loads |

### 3.2 My Company - Employee Management
| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.2.1 | Navigate to My Company | Page loads |
| 3.2.2 | Add employee | Employee added (pending) |
| 3.2.3 | Set employee rate | Rate saved |
| 3.2.4 | Add second employee | Employee added |
| 3.2.5 | Edit employee | Changes saved |

### 3.3 My Company - Plant Management
| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.3.1 | Add plant item | Plant added (pending) |
| 3.3.2 | Set dry/wet rates | Rates saved |
| 3.3.3 | Add second plant | Plant added |
| 3.3.4 | Edit plant | Changes saved |

### 3.4 Create Docket
| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.4.1 | Navigate to Dockets | Page loads |
| 3.4.2 | Create new docket | Draft docket created |
| 3.4.3 | Add labour entry | Entry added |
| 3.4.4 | Add plant entry | Entry added |
| 3.4.5 | Allocate to lot | Allocation saved |
| 3.4.6 | Submit docket | Validation passes, docket submitted |
| 3.4.7 | Verify status is "Pending" | Correct status |

### 3.5 Validation Tests
| Step | Action | Expected Result |
|------|--------|-----------------|
| 3.5.1 | Try submit with no entries | Error: requires entries |
| 3.5.2 | Try submit with no lot allocation | Error: requires allocation |

---

## Phase 4: Head Contractor - Docket Approval Flow

### 4.1 Approve Subcontractor Company
| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.1.1 | Login as head contractor | Dashboard loads |
| 4.1.2 | Navigate to Subcontractors | Page loads |
| 4.1.3 | Approve subcontractor company | Status changes to Approved |

### 4.2 Approve Rates
| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.2.1 | Expand subcontractor | Details shown |
| 4.2.2 | Approve employee rates | Rates approved |
| 4.2.3 | Approve plant rates | Rates approved |

### 4.3 Configure Portal Access
| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.3.1 | Click "Portal Access" | Panel opens |
| 4.3.2 | Toggle modules on/off | Settings saved |
| 4.3.3 | Enable all | All modules enabled |

### 4.4 Process Docket
| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.4.1 | Navigate to Docket Approvals | Page loads |
| 4.4.2 | View pending docket | Docket details shown |
| 4.4.3 | Query docket | Query sent |
| 4.4.4 | Approve docket | Docket approved |

### 4.5 View Costs
| Step | Action | Expected Result |
|------|--------|-----------------|
| 4.5.1 | Navigate to Costs | Page loads |
| 4.5.2 | Verify approved docket reflected | Costs updated |

---

## Phase 5: Secondary Features & Global Pages

### 5.1 Progress Claims
| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.1.1 | Navigate to Progress Claims | Page loads |
| 5.1.2 | Create claim | Claim created |
| 5.1.3 | Submit claim | Claim submitted |

### 5.2 Global Settings
| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.2.1 | Navigate to Settings | Page loads |
| 5.2.2 | Update profile | Changes saved |
| 5.2.3 | Change notification preferences | Preferences saved |

### 5.3 Company Settings
| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.3.1 | Navigate to Company Settings | Page loads |
| 5.3.2 | View company info | Info displayed |
| 5.3.3 | View subscription tier | Tier shown |

### 5.4 Audit Log
| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.4.1 | Navigate to Audit Log | Page loads |
| 5.4.2 | View entries | Entries shown |
| 5.4.3 | Filter entries | Filter works |

### 5.5 Portfolio
| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.5.1 | Navigate to Portfolio | Page loads |
| 5.5.2 | View project cards | Cards displayed |
| 5.5.3 | Check metrics | Metrics accurate |

### 5.6 Dashboard Widgets
| Step | Action | Expected Result |
|------|--------|-----------------|
| 5.6.1 | Test date filter | Data updates |
| 5.6.2 | Test refresh button | Data refreshes |
| 5.6.3 | Test export PDF | PDF downloads |
| 5.6.4 | Test quick links | Navigation works |

---

## Phase 6: Subcontractor Portal - Verify Portal Access Controls

### 6.1 Test Restricted Access
| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.1.1 | Login as subcontractor | Portal loads |
| 6.1.2 | Navigate to enabled modules | Access granted |
| 6.1.3 | Try disabled modules | Access denied or hidden |

### 6.2 Respond to Query
| Step | Action | Expected Result |
|------|--------|-----------------|
| 6.2.1 | View queried docket | Query shown |
| 6.2.2 | Respond to query | Response saved |
| 6.2.3 | Re-submit docket | Docket resubmitted |

---

## Phase 7: Cleanup (Optional)

### 7.1 Delete Test Data
| Step | Action | Expected Result |
|------|--------|-----------------|
| 7.1.1 | Delete test project | Project removed |
| 7.1.2 | Or keep for future testing | Data preserved |

---

## Execution Strategy

### Account Strategy
**Option A: Use existing account (jaysonryan21@hotmail.com)**
- Pros: Already logged in, existing data
- Cons: Test data mixed with real data

**Option B: Create dedicated test account**
- Pros: Clean isolation, reproducible
- Cons: Extra setup time

**Recommendation:** Use existing account but create a clearly named test project (`TEST - Regression`) that can be deleted later.

### Subcontractor Account Strategy
**Create new subcontractor via invitation flow** - this tests the invitation feature AND gives us a portal account to test with.

### Browser Testing Flow
1. Start logged in as head contractor
2. Create test project
3. Work through Phase 1-2 (all project features)
4. Invite subcontractor
5. Open new browser tab / incognito for subcontractor portal
6. Work through Phase 3 (subcontractor journey)
7. Switch back to head contractor for Phase 4-5
8. Final verification in Phase 6

---

## Bug Tracking Template

| Bug ID | Phase | Step | Description | Severity | Fixed? |
|--------|-------|------|-------------|----------|--------|
| BUG-001 | | | | | |

---

## Success Criteria

- [ ] All Phase 1 tests pass (Head Contractor Core)
- [ ] All Phase 2 tests pass (Subcontractor Invitation)
- [ ] All Phase 3 tests pass (Subcontractor Portal)
- [ ] All Phase 4 tests pass (Docket Approval)
- [ ] All Phase 5 tests pass (Secondary Features)
- [ ] All Phase 6 tests pass (Portal Access Controls)
- [ ] All critical bugs fixed
- [ ] Test report generated

---

## Estimated Time

| Phase | Estimated Time |
|-------|---------------|
| Phase 0: Setup | 5 mins |
| Phase 1: HC Core | 30 mins |
| Phase 2: Sub Invite | 10 mins |
| Phase 3: Sub Portal | 20 mins |
| Phase 4: Docket Flow | 15 mins |
| Phase 5: Secondary | 20 mins |
| Phase 6: Portal Access | 10 mins |
| Bug Fixing | Variable |
| **Total** | **~2 hours** |

---

## Ready to Execute

When approved, I will:
1. Start browser testing
2. Work through each phase systematically
3. Document all findings
4. Fix bugs as discovered
5. Report progress after each major phase
