// Feature #592 trigger - ITP instance snapshot from template
// Feature #175 - Auto-notification before witness point
import { Router } from 'express'
import { templatesRouter } from './templates.js'
import { instancesRouter } from './instances.js'
import { completionsRouter } from './completions.js'

const itpRouter = Router()

// Mount all sub-routers - routes are defined with full paths in each module
itpRouter.use(templatesRouter)
itpRouter.use(instancesRouter)
itpRouter.use(completionsRouter)

export { itpRouter }
