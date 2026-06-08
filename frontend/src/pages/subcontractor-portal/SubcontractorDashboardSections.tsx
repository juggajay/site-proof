import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  Calendar,
  ClipboardList,
  FlaskConical,
  FolderOpen,
  Hand,
} from 'lucide-react';
import { isPortalModuleEnabled } from './portalAccessModel';
import type { Company } from './SubcontractorDashboard';

interface PortalQuickLinksProps {
  company?: Company;
  myCompanyLink: string;
}

export function PortalQuickLinks({ company, myCompanyLink }: PortalQuickLinksProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Link
        to={myCompanyLink}
        className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
      >
        <div className="p-4 flex items-center gap-3">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">My Company</p>
            <p className="text-xs text-muted-foreground">Manage roster & plant</p>
          </div>
        </div>
      </Link>
      <Link
        to="/subcontractor-portal/dockets"
        className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
      >
        <div className="p-4 flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">All Dockets</p>
            <p className="text-xs text-muted-foreground">View history</p>
          </div>
        </div>
      </Link>
      {isPortalModuleEnabled(company, 'itps') && (
        <Link
          to="/subcontractor-portal/itps"
          className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
        >
          <div className="p-4 flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">ITPs</p>
              <p className="text-xs text-muted-foreground">Inspection & Test Plans</p>
            </div>
          </div>
        </Link>
      )}
      {isPortalModuleEnabled(company, 'holdPoints') && (
        <Link
          to="/subcontractor-portal/holdpoints"
          className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
        >
          <div className="p-4 flex items-center gap-3">
            <Hand className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Hold Points</p>
              <p className="text-xs text-muted-foreground">View hold points</p>
            </div>
          </div>
        </Link>
      )}
      {isPortalModuleEnabled(company, 'testResults') && (
        <Link
          to="/subcontractor-portal/tests"
          className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
        >
          <div className="p-4 flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Test Results</p>
              <p className="text-xs text-muted-foreground">View test results</p>
            </div>
          </div>
        </Link>
      )}
      {isPortalModuleEnabled(company, 'ncrs') && (
        <Link
          to="/subcontractor-portal/ncrs"
          className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
        >
          <div className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">NCRs</p>
              <p className="text-xs text-muted-foreground">Non-conformance reports</p>
            </div>
          </div>
        </Link>
      )}
      {isPortalModuleEnabled(company, 'documents') && (
        <Link
          to="/subcontractor-portal/documents"
          className="border border-border rounded-lg bg-card hover:border-primary transition-colors cursor-pointer"
        >
          <div className="p-4 flex items-center gap-3">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">Documents</p>
              <p className="text-xs text-muted-foreground">Project documents</p>
            </div>
          </div>
        </Link>
      )}
    </div>
  );
}
