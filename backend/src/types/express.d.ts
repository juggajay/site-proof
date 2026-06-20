import type { DashboardRole } from '../lib/dashboardRole.js';

export {};

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        userId: string;
        email: string;
        fullName: string | null;
        roleInCompany: string;
        role: string;
        companyId: string | null;
        hasSubcontractorPortalAccess?: boolean;
        dashboardRole?: DashboardRole | null;
      };
      apiKey?: {
        id: string;
        scopes: string[];
      };
    }
  }
}
