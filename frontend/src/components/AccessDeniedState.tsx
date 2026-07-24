import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRoleDisplayList } from '@/lib/roles';

interface AccessDeniedStateProps {
  message?: string;
  backTo?: string;
  backLabel?: string;
  /** When provided, names the role(s) that would grant access. */
  requiredRoles?: readonly string[];
}

export function AccessDeniedState({
  message = 'You do not have access to this project. Ask a project admin to add you before opening this workspace.',
  backTo = '/projects',
  backLabel = 'Back to Projects',
  requiredRoles,
}: AccessDeniedStateProps) {
  return (
    <div className="flex min-h-[320px] items-center justify-center p-6">
      <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ShieldAlert className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {requiredRoles && requiredRoles.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Requires {formatRoleDisplayList(requiredRoles)}.
          </p>
        )}
        <Button asChild className="mt-5">
          <Link to={backTo}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
