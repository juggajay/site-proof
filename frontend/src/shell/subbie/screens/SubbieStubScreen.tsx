/**
 * SubbieStubScreen — parameterized placeholder for the subbie shell screens that
 * ship in PRs B/C/D. ONE component, not ten copies.
 *
 * Renders the real shell header (inner variant, declared parent /p) so the
 * navigation + back model are exercised now, and offers an explicit link to the
 * equivalent classic portal page so no functionality is lost while the screen is
 * rebuilt. The classic pages stay fully reachable (the SubbieShellGuard only
 * redirects the dashboard entry point, never the other /subcontractor-portal/*
 * routes).
 */
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ShellScreen } from '@/shell/components/ShellScreen';

interface SubbieStubScreenProps {
  /** Header title for the screen being rebuilt. */
  title: string;
  /** Optional sub-line context. */
  sub?: string;
  /** The classic portal route this screen will replace (link target). */
  classicHref: string;
  /** Label for the classic-page link button. */
  classicLabel: string;
}

export function SubbieStubScreen({ title, sub, classicHref, classicLabel }: SubbieStubScreenProps) {
  return (
    <ShellScreen
      variant="inner"
      title={title}
      parent="/p"
      sub={sub ? <span className="text-muted-foreground">{sub}</span> : undefined}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
        <div
          aria-hidden="true"
          className="h-1.5 w-24 rounded-full"
          style={{
            background:
              'repeating-linear-gradient(-55deg, hsl(var(--warning)) 0 6px, transparent 6px 12px)',
          }}
        />

        <p className="max-w-[280px] text-[14px] leading-relaxed text-muted-foreground">
          This screen is being rebuilt — tap below to use the classic page for now.
        </p>

        <Link
          to={classicHref}
          className="shell-card flex items-center justify-center gap-2 !w-auto px-5 py-3 text-[15px] font-semibold text-foreground"
        >
          {classicLabel}
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </ShellScreen>
  );
}
