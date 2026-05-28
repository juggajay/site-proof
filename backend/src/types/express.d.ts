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
        dashboardRole?: 'project_manager' | 'quality_manager' | 'foreman' | null;
      };
      apiKey?: {
        id: string;
        scopes: string[];
      };
    }
  }
}
