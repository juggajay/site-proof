import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { portfolioDashboardRouter } from './dashboard/portfolio.js';
import { dashboardRoleDashboardsRouter } from './dashboard/roleDashboards.js';
import { dashboardOperationalRouter } from './dashboard/operationalRoutes.js';

export const dashboardRouter = Router();

// Apply authentication middleware to all dashboard routes
dashboardRouter.use(requireAuth);

// Portfolio / commercial dashboard read routes (cash flow, critical NCRs,
// projects at risk) live in ./dashboard/portfolio.ts and are mounted here, after
// the route-wide requireAuth above, so the child router inherits authentication
// (see parentProtectedRoutePrefixes in routeAuthCoverage.test.ts).
dashboardRouter.use(portfolioDashboardRouter);

// Role-specific dashboard read routes (foreman, quality-manager, project-manager)
// live in ./dashboard/roleDashboards.ts and are mounted here, after the route-wide
// requireAuth above (and after the portfolio routes), so the child router inherits
// authentication. See parentProtectedRoutePrefixes in routeAuthCoverage.test.ts.
dashboardRouter.use(dashboardRoleDashboardsRouter);

// Operational dashboard routes (stats, cost-trend, and the foreman "today"
// worklist) live in ./dashboard/operationalRoutes.ts and are mounted here, after
// the route-wide requireAuth above, so the child router inherits authentication
// (see parentProtectedRoutePrefixes in routeAuthCoverage.test.ts). All dashboard
// route paths are non-overlapping, so child-router mount order is behavior-neutral.
dashboardRouter.use(dashboardOperationalRouter);
