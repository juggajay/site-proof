/**
 * ShellScreen — the foundational layout wrapper for every screen in the foreman
 * mobile shell.
 *
 * Back model (spec §3): each screen declares its `parent` path; the back button
 * navigates there explicitly (never `navigate(-1)`) so the back destination is
 * always predictable regardless of browser history.  Browser/PWA hardware back
 * still works via history — we only override the in-app chevron.
 *
 * Variants:
 *   - `variant="home"` — shows the SITEPROOF kicker, role chip, greeting, and
 *     project/date line. No back button.
 *   - `variant="inner"` — shows a back chevron + condensed title + a context
 *     sub-line. `parent` and `title` are required.
 *
 * The staggered rise-in animation for <main> children is applied via CSS only
 * (no JS animation library) and respects prefers-reduced-motion.
 */

import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { SyncChip } from './SyncChip';
import { useTimeGreeting } from '../hooks/useTimeGreeting';
import { useAuth } from '@/lib/auth';
import { useEffectiveProjectId } from '@/hooks/useEffectiveProjectId';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';

// ── Types ────────────────────────────────────────────────────────────────────

interface ShellScreenHomeProps {
  variant: 'home';
  children: ReactNode;
  /** Bottom bar slot — camera bar or primary action. */
  bottom?: ReactNode;
  /** Optional role label override; defaults to user's role. */
  roleLabel?: string;
}

interface ShellScreenInnerProps {
  variant: 'inner';
  /** Condensed title shown in the header. */
  title: string;
  /** Path the back chevron navigates to. Must be an absolute path. */
  parent: string;
  /** Sub-line below the title — context text (e.g. "Daily Diary  STEP 3/4"). */
  sub?: ReactNode;
  children: ReactNode;
  /** Bottom bar slot. */
  bottom?: ReactNode;
}

type ShellScreenProps = ShellScreenHomeProps | ShellScreenInnerProps;

// ── Role chip label map ───────────────────────────────────────────────────────

const ROLE_CHIP_LABELS: Record<string, string> = {
  owner: 'OWNER',
  admin: 'ADMIN',
  project_manager: 'PM',
  quality_manager: 'QM',
  site_manager: 'SITE MGR',
  foreman: 'FOREMAN',
  site_engineer: 'SITE ENG',
};

function getRoleChipLabel(role: string | undefined): string {
  if (!role) return 'FIELD';
  return ROLE_CHIP_LABELS[role] ?? role.toUpperCase();
}

// ── Home header ───────────────────────────────────────────────────────────────

function HomeHeader({ roleLabel }: { roleLabel?: string }) {
  const { user } = useAuth();
  const greeting = useTimeGreeting(user?.fullName ?? user?.name);
  const { projectId } = useEffectiveProjectId();

  const role = user?.roleInCompany ?? user?.role;
  const chipLabel = roleLabel ?? getRoleChipLabel(role);

  // Today's date — short format matching the mock (e.g. "WED 11 JUN")
  const dateStr = new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
    .format(new Date())
    .toUpperCase();

  // Project NAME, resolved from the same cached projects query the app
  // header uses (queryKeys.projects) — shared cache, so no extra fetch in
  // practice. Falls back to a neutral label while loading.
  const { data: projectsData } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<{ projects: { id: string; name: string }[] }>('/api/projects'),
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
  const projectName = projectsData?.projects?.find((p) => p.id === projectId)?.name;
  const projectLabel = projectId ? (projectName ?? '…') : 'No project';

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background px-5 pb-[14px] pt-3">
      {/* Kicker row: SITEPROOF wordmark + role chip */}
      <div className="mb-0.5 flex items-center gap-2">
        <span
          className="font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground"
          aria-label="SiteProof"
        >
          SITEPROOF
        </span>
        <span className="shell-chip text-[10.5px]">{chipLabel}</span>
      </div>

      {/* Main greeting row */}
      <div className="flex min-h-[40px] items-center gap-1.5">
        <h1 className="shell-display-title flex-1">{greeting}</h1>
        <SyncChip />
      </div>

      {/* Project + date row */}
      <div className="mt-[3px] flex items-center gap-2 text-[13px] text-muted-foreground">
        <span>{projectLabel}</span>
        <span className="font-mono text-[12px] font-[500]">{dateStr}</span>
      </div>
    </header>
  );
}

// ── Inner header ─────────────────────────────────────────────────────────────

function InnerHeader({ title, parent, sub }: { title: string; parent: string; sub?: ReactNode }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background px-5 pb-[14px] pt-3">
      <div className="flex min-h-[40px] items-center gap-1.5">
        {/* Back button — ≥44 px touch target, navigates to declared parent */}
        <button
          type="button"
          aria-label="Go back"
          onClick={() => navigate(parent)}
          className={[
            '-ml-2.5 flex h-10 w-10 items-center justify-center',
            'rounded-[10px] border-none bg-transparent text-foreground',
            'transition-[transform,background] duration-150',
            'active:translate-x-[-3px] active:bg-secondary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          ].join(' ')}
        >
          <ChevronLeft size={22} strokeWidth={2.2} aria-hidden="true" />
        </button>

        <h1 className="shell-display-title flex-1">{title}</h1>
        <SyncChip />
      </div>

      {sub && (
        <div className="mt-[3px] flex items-center gap-2 text-[13px] text-muted-foreground">
          {sub}
        </div>
      )}
    </header>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ShellScreen(props: ShellScreenProps) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      {props.variant === 'home' ? (
        <HomeHeader roleLabel={props.roleLabel} />
      ) : (
        <InnerHeader title={props.title} parent={props.parent} sub={props.sub} />
      )}

      {/* stagger-rise class triggers the CSS stagger animation on direct children */}
      <main className="stagger-rise flex flex-1 flex-col gap-3 px-5 pb-[128px] pt-4">
        {props.children}
      </main>

      {props.bottom && props.bottom}
    </div>
  );
}
