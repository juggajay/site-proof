import { Router } from 'express'
import { requireAuth } from '../../middleware/authMiddleware.js'
import { diaryCoreRouter } from './diaryCore.js'
import { diaryItemsRouter } from './diaryItems.js'
import { diarySubmissionRouter } from './diarySubmission.js'
import { diaryReportingRouter } from './diaryReporting.js'

const router = Router()

// Apply auth middleware to all diary routes
router.use(requireAuth)

// Mount sub-routers
// Order matters: more specific routes (project/*, entry/*) should come before
// catch-all parameter routes in diaryCore (/:projectId, /:projectId/:date)
router.use(diaryItemsRouter)
router.use(diarySubmissionRouter)
router.use(diaryReportingRouter)
router.use(diaryCoreRouter)

export default router
