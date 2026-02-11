import { Request, Response, NextFunction } from 'express'
import { AppError } from '../lib/AppError.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Route params that should be valid UUIDs
const UUID_PARAM_NAMES = new Set([
  'id', 'projectId', 'lotId', 'diaryId', 'ncrId', 'docketId',
  'claimId', 'documentId', 'drawingId', 'templateId', 'instanceId',
  'holdPointId', 'testResultId', 'commentId', 'attachmentId',
  'companyId', 'userId', 'notificationId', 'webhookId',
  'subcontractorId', 'employeeId', 'plantId', 'assignmentId',
])

/**
 * Middleware to validate that specified route parameters are valid UUIDs.
 * Returns 400 if any parameter fails validation.
 *
 * Usage:
 *   router.get('/:projectId', validateUuidParams('projectId'), handler)
 *   router.get('/:projectId/:lotId', validateUuidParams('projectId', 'lotId'), handler)
 */
export function validateUuidParams(...paramNames: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const param of paramNames) {
      const value = req.params[param]
      if (value && !UUID_REGEX.test(value)) {
        throw AppError.badRequest(`Parameter '${param}' must be a valid UUID`)
      }
    }
    next()
  }
}

/**
 * Global middleware that validates all known UUID route params.
 * Apply once at the app level before route handlers.
 */
export function validateUuidRouteParams(req: Request, _res: Response, next: NextFunction) {
  for (const [param, value] of Object.entries(req.params)) {
    if (UUID_PARAM_NAMES.has(param) && value && !UUID_REGEX.test(value)) {
      throw AppError.badRequest(`Parameter '${param}' must be a valid UUID`)
    }
  }
  next()
}
