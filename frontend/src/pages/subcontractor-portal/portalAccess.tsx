import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export function PortalAccessDenied({ moduleName }: { moduleName: string }) {
  return (
    <div className="container max-w-2xl mx-auto p-4">
      <div
        role="alert"
        className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200"
      >
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <p>{moduleName} portal access is not enabled for your company.</p>
      </div>
      <Link
        to="/subcontractor-portal"
        className="inline-flex items-center gap-2 mt-4 px-4 py-2 border border-border rounded-lg hover:bg-muted/50 transition-colors text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Portal
      </Link>
    </div>
  );
}
