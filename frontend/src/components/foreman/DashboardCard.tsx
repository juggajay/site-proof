// DashboardCard - Reusable card component for mobile dashboard
import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardCardProps {
  title: string;
  icon?: ReactNode;
  badge?: string | number;
  badgeVariant?: 'default' | 'warning' | 'success' | 'error';
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  headerAction?: ReactNode;
}

const badgeColors = {
  default: 'bg-muted text-muted-foreground',
  warning: 'bg-warning text-warning-foreground',
  success: 'bg-success text-success-foreground',
  error: 'bg-destructive text-destructive-foreground',
};

export function DashboardCard({
  title,
  icon,
  badge,
  badgeVariant = 'default',
  children,
  onClick,
  className,
  headerAction,
}: DashboardCardProps) {
  const isClickable = !!onClick;
  const Component = isClickable ? 'button' : 'div';

  return (
    <Component
      className={cn(
        'bg-card rounded-lg border overflow-hidden text-left w-full',
        isClickable && 'cursor-pointer active:bg-muted/50 transition-colors touch-manipulation',
        className,
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <h3 className="font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {badge !== undefined && (
            <span
              className={cn(
                'text-xs font-medium px-2.5 py-0.5 rounded-full',
                badgeColors[badgeVariant],
              )}
            >
              {badge}
            </span>
          )}
          {headerAction}
          {isClickable && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">{children}</div>
    </Component>
  );
}

// Stat component for dashboard cards
interface DashboardStatProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
}

export function DashboardStat({ label, value, icon, className }: DashboardStatProps) {
  return (
    <div className={cn('bg-muted rounded-lg p-3', className)}>
      <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-semibold font-mono tabular-nums">{value}</p>
    </div>
  );
}
