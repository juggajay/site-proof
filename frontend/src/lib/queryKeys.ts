// Centralized query key factory — prevents typo bugs and enables type-safe invalidation
export const queryKeys = {
  // Projects
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  projectModules: (id: string) => ['project-modules', id] as const,

  // Lots
  lots: (projectId: string) => ['lots', projectId] as const,
  lot: (id: string) => ['lot', id] as const,

  // NCRs
  ncrs: (projectId?: string) => (projectId ? (['ncrs', projectId] as const) : (['ncrs'] as const)),
  ncrRole: (projectId: string) => ['ncr-role', projectId] as const,

  // Hold Points
  holdPoints: (projectId: string) => ['hold-points', projectId] as const,

  // Test Results
  testResults: (projectId: string) => ['test-results', projectId] as const,

  // ITPs
  itps: (projectId: string) => ['itps', projectId] as const,

  // Diary
  diaries: (projectId: string) => ['diaries', projectId] as const,
  diary: (id: string) => ['diary', id] as const,

  // Documents & Drawings
  documents: (projectId: string) => ['documents', projectId] as const,
  drawings: (projectId: string) => ['drawings', projectId] as const,

  // Claims & Costs
  claims: (projectId: string) => ['claims', projectId] as const,
  costs: (projectId: string) => ['costs', projectId] as const,

  // Dockets
  dockets: (projectId: string) => ['dockets', projectId] as const,

  // Subcontractors
  subcontractors: (projectId: string) => ['subcontractors', projectId] as const,
  lotAssignments: (lotId: string) => ['lot-assignments', lotId] as const,

  // Users & Auth
  profile: ['profile'] as const,
  auditLogs: (params: string) => ['audit-logs', params] as const,
  notifications: ['notifications'] as const,

  // Search
  search: (term: string) => ['search', term] as const,
  globalSearch: (projectId: string, term: string, scope: 'lots' | 'ncrs' | 'tests') =>
    ['global-search', projectId, term, scope] as const,

  // Foreman
  foremanDashboard: (projectId: string) => ['foreman-dashboard', projectId] as const,
  foremanWorklist: (projectId: string) => ['foreman-worklist', projectId] as const,
  foremanBadges: (projectId: string) => ['foreman-badges', projectId] as const,

  // Subcontractor Portal
  portalCompanies: ['portal-companies'] as const,
  portalDashboard: ['portal-dashboard'] as const,
  portalDockets: ['portal-dockets'] as const,
  portalNCRs: ['portal-ncrs'] as const,
  portalTestResults: ['portal-test-results'] as const,
  portalITPs: ['portal-itps'] as const,
  portalHoldPoints: ['portal-hold-points'] as const,
  portalDocuments: ['portal-documents'] as const,
  portalAssignedWork: ['portal-assigned-work'] as const,

  // Reports
  reports: (projectId: string) => ['reports', projectId] as const,
  reportSchedules: (projectId: string) => ['report-schedules', projectId] as const,

  // Dashboard
  dashboard: (projectId?: string) =>
    projectId ? (['dashboard', projectId] as const) : (['dashboard'] as const),
  dashboardStats: (startDate: string, endDate: string) =>
    ['dashboard-stats', startDate, endDate] as const,
  pmDashboard: ['pm-dashboard'] as const,
  qmDashboard: ['qm-dashboard'] as const,

  // Portfolio
  portfolio: ['portfolio'] as const,

  // Settings
  settings: ['settings'] as const,
  companySettings: ['company-settings'] as const,
  projectSettings: (projectId: string) => ['project-settings', projectId] as const,
  projectUsers: (projectId: string) => ['project-users', projectId] as const,
  projectAreas: (projectId: string) => ['project-areas', projectId] as const,
} as const;
