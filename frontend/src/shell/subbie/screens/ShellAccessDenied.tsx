/**
 * ShellAccessDenied — the dark-shell equivalent of the classic PortalAccessDenied.
 *
 * Rendered when a subbie navigates to a /p/* screen whose portal module is
 * disabled for their company (same `isPortalModuleEnabled` gate the classic pages
 * use). Keeps the user inside the shell — a quiet inner ShellScreen notice plus a
 * back-to-home link — rather than bouncing to the light-theme classic component.
 */
import { ShellScreen } from '@/shell/components/ShellScreen';
import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function ShellAccessDenied({
  title,
  moduleName,
}: {
  /** Header title for the screen being gated (e.g. "My Work"). */
  title: string;
  /** Human module name used in the notice copy (e.g. "Assigned work"). */
  moduleName: string;
}) {
  return (
    <ShellScreen variant="inner" title={title} parent="/p">
      <div
        role="alert"
        className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-warning"
      >
        <AlertCircle size={20} className="mt-px shrink-0" aria-hidden />
        <p className="text-[14px] leading-relaxed">
          {moduleName} portal access is not enabled for your company.
        </p>
      </div>
      <Link
        to="/p"
        className="shell-card mt-1 inline-flex w-auto items-center justify-center px-5 py-3 text-[15px] font-semibold text-foreground"
      >
        Back to home
      </Link>
    </ShellScreen>
  );
}
