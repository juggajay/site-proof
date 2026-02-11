import { Router } from 'express'
import { ncrCoreRouter } from './ncrCore.js'
import { ncrWorkflowRouter } from './ncrWorkflow.js'
import { ncrEvidenceRouter } from './ncrEvidence.js'
import { ncrAnalyticsRouter } from './ncrAnalytics.js'

const ncrsRouter = Router()

// Mount all sub-routers - routes are defined with full paths in each module
ncrsRouter.use(ncrAnalyticsRouter) // analytics/check-role must be before core (/:id would match first)
ncrsRouter.use(ncrCoreRouter)
ncrsRouter.use(ncrWorkflowRouter)
ncrsRouter.use(ncrEvidenceRouter)

export { ncrsRouter }
