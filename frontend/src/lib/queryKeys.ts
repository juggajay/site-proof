// Centralized query key factory — prevents typo bugs and enables type-safe invalidation
export const queryKeys = {
  // Projects
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  projectModules: (id: string) => ['project-modules', id] as const,

  // Lots
  lots: (projectId: string) => ['lots', projectId] as const,
  lot: (id: string) => ['lot', id] as const,
  projectLotGeometries: (projectId: string) => ['project-lot-geometries', projectId] as const,
  lotGeometries: (lotId: string) => ['lot-geometries', lotId] as const,
  spatialSearch: (projectId: string) => ['spatial-search', projectId] as const,
  lotStatusTimeline: (projectId: string) => ['lot-status-timeline', projectId] as const,
  projectCoverage: (projectId: string) => ['project-coverage', projectId] as const,
  projectTestCoverage: (projectId: string) => ['project-test-coverage', projectId] as const,
  projectCloseoutReadiness: (projectId: string) =>
    ['project-closeout-readiness', projectId] as const,
  lotReadiness: (id: string) => ['lot-readiness', id] as const,
  // Wave D `D1b` — issued evidence folios for a lot.
  lotFolios: (lotId: string) => ['lot-folios', lotId] as const,
  lotQualityAccess: (projectId: string) => ['lot-quality-access', projectId] as const,

  // NCRs
  ncrs: (projectId?: string) => (projectId ? (['ncrs', projectId] as const) : (['ncrs'] as const)),
  ncrRole: (projectId: string) => ['ncr-role', projectId] as const,
  ncrEvidence: (ncrId: string) => ['ncr-evidence', ncrId] as const,

  // Hold Points
  holdPoints: (projectId: string) => ['hold-points', projectId] as const,

  // Test Results
  testResults: (projectId: string) => ['test-results', projectId] as const,
  /**
   * Review L10 — the shipped test-frequency registry. Not project-scoped and it
   * carries no tenant content (`routes/testSufficiency.ts`), so one key serves
   * every project and it is cached for an hour. Here rather than inline in the
   * hook so the day a pack correction has to be busted, the key is where the
   * other 34 are instead of needing a grep.
   */
  sufficiencyRulesets: () => ['test-sufficiency', 'rulesets'] as const,

  // ITPs
  itps: (projectId: string) => ['itps', projectId] as const,
  itpTemplates: (projectId: string, includeGlobal: boolean) =>
    ['itp-templates', projectId, includeGlobal] as const,
  itpCrossProjectTemplates: (currentProjectId: string) =>
    ['itp-cross-project-templates', currentProjectId] as const,
  itpTemplateMatch: (projectId: string, activity: string) =>
    ['itp-template-match', projectId, activity] as const,
  itpTemplateRank: (projectId: string, activity: string) =>
    ['itp-template-rank', projectId, activity] as const,
  itpInstanceByLot: (lotId: string) => ['itp', 'instance', 'lot', lotId] as const,

  // Diary
  diaries: (projectId: string) => ['diaries', projectId] as const,
  diary: (id: string) => ['diary', id] as const,

  // Documents & Drawings
  documents: (projectId: string) => ['documents', projectId] as const,
  drawings: (projectId: string) => ['drawings', projectId] as const,

  // Revision governance (Wave G G1)
  revisionIssues: (projectId: string, entityType: string, entityId: string) =>
    ['revision-issues', projectId, entityType, entityId] as const,

  // Claims & Costs
  claims: (projectId: string) => ['claims', projectId] as const,
  variations: (projectId: string) => ['variations', projectId] as const,
  claimReadiness: (projectId: string) => ['claim-readiness', projectId] as const,
  claimReadinessSummary: (projectId: string) => ['claim-readiness-summary', projectId] as const,
  claimReadinessBlockedLots: (projectId: string, reasonCode: string) =>
    ['claim-readiness-blocked-lots', projectId, reasonCode] as const,
  claimEvidenceReview: (projectId: string, claimId: string) =>
    ['claim-evidence-review', projectId, claimId] as const,
  costs: (projectId: string) => ['costs', projectId] as const,

  // Dockets
  dockets: (projectId: string, status = 'all') => ['dockets', projectId, status] as const,
  docketProject: (projectId: string) => ['docket-project', projectId] as const,
  docketDetail: (docketId: string) => ['docket-detail', docketId] as const,

  // Subcontractors
  subcontractors: (projectId: string) => ['subcontractors', projectId] as const,
  lotAssignments: (lotId: string) => ['lot-assignments', lotId] as const,
  pendingSubcontractorInvitation: (userId: string | null | undefined) =>
    ['pending-subcontractor-invitation', userId ?? 'anonymous'] as const,
  // Subbie-facing "My Company" read; user-scoped so one subbie's cache never
  // leaks to another account in the same browser session (commit 9574ced).
  myCompany: (
    userId: string | null | undefined,
    projectId: string | null | undefined,
    subcontractorCompanyId?: string | null | undefined,
  ) =>
    [
      'my-company',
      userId ?? 'anonymous',
      projectId ?? 'default',
      subcontractorCompanyId ?? 'default-company',
    ] as const,

  // Users & Auth
  profile: ['profile'] as const,
  auditLogs: (params: string) => ['audit-logs', params] as const,
  notifications: ['notifications'] as const,
  notificationUnreadCount: ['notifications', 'unread-count'] as const,

  // Comments
  comments: (entityType: string, entityId: string, page: number) =>
    ['comments', entityType, entityId, page] as const,

  // Search
  search: (term: string) => ['search', term] as const,
  globalSearch: (
    projectId: string,
    term: string,
    scope: 'lots' | 'ncrs' | 'tests' | 'documents' | 'drawings',
  ) => ['global-search', projectId, term, scope] as const,

  // Foreman
  foremanDashboard: (projectId: string) => ['foreman-dashboard', projectId] as const,
  foremanWorklist: (projectId: string) => ['foreman-worklist', projectId] as const,
  foremanBadges: (projectId: string) => ['foreman-badges', projectId] as const,

  // Subcontractor Portal
  portalCompanies: (userId: string | null | undefined) =>
    ['portal-companies', userId ?? 'anonymous'] as const,
  portalDashboard: (userId: string | null | undefined) =>
    ['portal-dashboard', userId ?? 'anonymous'] as const,
  portalDockets: (
    userId: string | null | undefined,
    projectId: string | null | undefined,
    subcontractorCompanyId?: string | null | undefined,
  ) =>
    [
      'portal-dockets',
      userId ?? 'anonymous',
      projectId ?? 'no-project',
      subcontractorCompanyId ?? 'all-companies',
    ] as const,
  portalDocket: (userId: string | null | undefined, docketId: string | null | undefined) =>
    ['portal-docket', userId ?? 'anonymous', docketId ?? 'no-docket'] as const,
  portalDocketEditLots: (
    userId: string | null | undefined,
    projectId: string | null | undefined,
    subcontractorCompanyId?: string | null | undefined,
  ) =>
    [
      'portal-docket-edit-lots',
      userId ?? 'anonymous',
      projectId ?? 'no-project',
      subcontractorCompanyId ?? 'default-company',
    ] as const,
  portalNCRs: (
    userId: string | null | undefined,
    projectId: string | null | undefined,
    subcontractorCompanyId?: string | null | undefined,
    lotId?: string | null | undefined,
  ) =>
    [
      'portal-ncrs',
      userId ?? 'anonymous',
      projectId ?? 'no-project',
      subcontractorCompanyId ?? 'default-company',
      lotId ?? 'all-lots',
    ] as const,
  portalTestResults: (
    userId: string | null | undefined,
    projectId: string | null | undefined,
    subcontractorCompanyId?: string | null | undefined,
  ) =>
    [
      'portal-test-results',
      userId ?? 'anonymous',
      projectId ?? 'no-project',
      subcontractorCompanyId ?? 'default-company',
    ] as const,
  portalITPs: (
    userId: string | null | undefined,
    projectId: string | null | undefined,
    subcontractorCompanyId?: string | null | undefined,
  ) =>
    [
      'portal-itps',
      userId ?? 'anonymous',
      projectId ?? 'no-project',
      subcontractorCompanyId ?? 'default-company',
    ] as const,
  portalHoldPoints: (
    userId: string | null | undefined,
    projectId: string | null | undefined,
    subcontractorCompanyId?: string | null | undefined,
  ) =>
    [
      'portal-hold-points',
      userId ?? 'anonymous',
      projectId ?? 'no-project',
      subcontractorCompanyId ?? 'default-company',
    ] as const,
  portalDocuments: (
    userId: string | null | undefined,
    projectId: string | null | undefined,
    subcontractorCompanyId?: string | null | undefined,
  ) =>
    [
      'portal-documents',
      userId ?? 'anonymous',
      projectId ?? 'no-project',
      subcontractorCompanyId ?? 'default-company',
    ] as const,
  portalAssignedWork: (
    userId: string | null | undefined,
    projectId: string | null | undefined,
    subcontractorCompanyId?: string | null | undefined,
  ) =>
    [
      'portal-assigned-work',
      userId ?? 'anonymous',
      projectId ?? 'no-project',
      subcontractorCompanyId ?? 'default-company',
    ] as const,

  // Wave D `D1c.3` — the project's handover export jobs, and the thin lot list
  // that drives the lot-range scope picker (kept off the lot register's key so
  // it cannot be invalidated by, or confused with, LotsPage's cache entry).
  handoverExports: (projectId: string) => ['handover-exports', projectId] as const,
  handoverExportLotOptions: (projectId: string) =>
    ['handover-export-lot-options', projectId] as const,
  folioCoverage: (projectId: string) => ['folio-coverage', projectId] as const,

  // Reports
  reports: (projectId: string) => ['reports', projectId] as const,
  reportSchedules: (projectId: string) => ['report-schedules', projectId] as const,

  // Dashboard
  dashboard: (projectId?: string) =>
    projectId ? (['dashboard', projectId] as const) : (['dashboard'] as const),
  dashboardStats: (startDate: string, endDate: string) =>
    ['dashboard-stats', startDate, endDate] as const,
  /**
   * Prefix key covering EVERY parameterised `dashboardStats` entry. Use it to
   * invalidate after a mutation: the caller does not know which date range the
   * dashboard (or /dashboard/needs-attention, which reads the same entry) is
   * sitting on, and `staleTime` is 5 min with no refetch-on-focus, so without
   * this an actioned NCR or hold point stays listed for minutes.
   */
  dashboardStatsAll: ['dashboard-stats'] as const,
  pmDashboard: ['pm-dashboard'] as const,
  qmDashboard: ['qm-dashboard'] as const,

  // Portfolio
  portfolio: ['portfolio'] as const,

  // Settings
  settings: ['settings'] as const,
  emailPreferences: ['email-preferences'] as const,
  companySettings: ['company-settings'] as const,
  projectSettings: (projectId: string) => ['project-settings', projectId] as const,
  projectUsers: (projectId: string) => ['project-users', projectId] as const,
  projectAreas: (projectId: string) => ['project-areas', projectId] as const,
  controlLines: (projectId: string) => ['control-lines', projectId] as const,
  planSheets: (projectId: string) => ['plan-sheets', projectId] as const,

  // AI availability
  aiStatus: ['ai-status'] as const,

  // Copilot (AI setup proposals)
  copilotProposals: (projectId: string) => ['copilot-proposals', projectId] as const,
  copilotProposal: (projectId: string, proposalId: string) =>
    ['copilot-proposal', projectId, proposalId] as const,
  copilotLotPresence: (projectId: string) => ['copilot-lot-presence', projectId] as const,

  // Wave B — migration imports. Batch lists and profile lists are per KIND
  // (ITP templates, lot registers), so the two never share a cache entry.
  importBatches: (projectId: string, kind: string) => ['import-batches', projectId, kind] as const,
  importBatch: (projectId: string, batchId: string) =>
    ['import-batch', projectId, batchId] as const,
  importProfiles: (projectId: string, kind: string) =>
    ['import-profiles', projectId, kind] as const,
  importMasters: (projectId: string, kind: string) => ['import-masters', projectId, kind] as const,
} as const;
