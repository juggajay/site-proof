import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

/**
 * The role dashboards' entry point to `/dashboard/needs-attention`.
 *
 * `DashboardPage` returns early for `quality_manager` and `project_manager`, and
 * the only other link to the screen lives in a widget mounted solely on the
 * DEFAULT dashboard — so until the 2026-07-28 review's M8 the two roles the
 * screen was built for could not reach it at all.
 *
 * Deliberately count-free and always rendered: the widget hid itself at
 * `total === 0`, which is exactly the state the A4R-B4 widening was built to
 * serve. An empty destination is fine; an invisible one is not.
 *
 * ponytail: no badge — a count would mean fetching dashboard stats on two more
 * dashboards. Add it if the roles ask for one.
 */
export function NeedsAttentionQuickLink() {
  return (
    <Link
      to="/dashboard/needs-attention"
      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
    >
      <AlertCircle className="h-5 w-5 text-muted-foreground" />
      <span className="font-medium">Needs Attention</span>
    </Link>
  );
}
