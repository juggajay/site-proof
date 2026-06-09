import { CheckCircle, Clock, X } from 'lucide-react';

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
          <Clock className="h-3 w-3" /> Pending Approval
        </span>
      );
    case 'approved':
    case 'active':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          <CheckCircle className="h-3 w-3" /> Approved
        </span>
      );
    case 'inactive':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          <X className="h-3 w-3" /> Inactive
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-muted text-foreground">
          {status}
        </span>
      );
  }
}
