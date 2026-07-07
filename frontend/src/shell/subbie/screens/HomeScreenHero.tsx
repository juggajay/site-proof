/**
 * HomeScreenHero — the subbie Home "Today's Docket" hero tile and its state
 * machine, extracted from HomeScreen so the screen file stays under the 500-line
 * guideline. Pure presentation over the existing docket contract — no data
 * fetching lives here.
 */
import { formatCurrency } from '@/pages/subcontractor-portal/subcontractorDashboardHelpers';

// Minimal docket shape from the existing portal contract.
export interface Docket {
  id: string;
  date: string;
  status: string;
  totalLabourSubmitted: number;
  totalPlantSubmitted: number;
  totalLabourApprovedCost?: number | null;
  totalPlantApprovedCost?: number | null;
  // Entry counts from the list endpoint — the honest "has this docket been
  // started?" signal (independent of whether rates make the totals non-zero).
  labourEntryCount?: number;
  plantEntryCount?: number;
  foremanNotes?: string;
}

export type HeroState =
  | { kind: 'none' }
  // Docket prerequisites unmet (no approved crew/plant, or no lots) — the hero
  // carries the setup call-to-action instead of contradicting it with "Start
  // today's docket"; tap goes to My Company.
  | { kind: 'setup' }
  | {
      kind: 'draft' | 'pending_approval' | 'approved' | 'queried' | 'rejected';
      docketId: string;
      total: number;
      entryHint: string;
    };

const HERO_COPY: Record<
  Exclude<HeroState['kind'], 'none' | 'setup'>,
  { kicker: string; big: string; small: string }
> = {
  draft: {
    kicker: "TODAY'S DOCKET — DRAFT",
    big: 'Keep adding hours',
    small: "Submit when the day's done.",
  },
  pending_approval: {
    kicker: "TODAY'S DOCKET — SENT",
    big: 'Sent — waiting on approval',
    small: "You'll be notified when it's approved.",
  },
  approved: {
    kicker: "TODAY'S DOCKET — APPROVED",
    big: 'Approved',
    small: "Today's docket is approved.",
  },
  queried: {
    kicker: "TODAY'S DOCKET — QUERIED",
    big: 'Answer the foreman',
    small: 'There’s a question to answer before this can be approved.',
  },
  rejected: {
    kicker: "TODAY'S DOCKET — REJECTED",
    big: 'Fix & resubmit',
    small: 'The foreman sent this back — fix it and resubmit.',
  },
};

export function DocketHero({ state, onPress }: { state: HeroState; onPress: () => void }) {
  if (state.kind === 'setup') {
    return (
      <button
        type="button"
        className="shell-hero"
        onClick={onPress}
        aria-label="Set up your company"
      >
        <span className="shell-hazard-stripe" aria-hidden="true" />
        <div className="relative font-mono text-[11.5px] font-semibold tracking-[0.14em] text-warning">
          GET SET UP
        </div>
        <div className="shell-hero-big relative mt-2">Set up your company</div>
        <div className="relative mt-[5px] text-[13.5px] opacity-80">
          Add your crew & plant in My Company and wait for rate approval — then dockets unlock.
        </div>
      </button>
    );
  }

  if (state.kind === 'none') {
    return (
      <button
        type="button"
        className="shell-hero"
        onClick={onPress}
        aria-label="Start today's docket"
      >
        <span className="shell-hazard-stripe" aria-hidden="true" />
        <div className="relative font-mono text-[11.5px] font-semibold tracking-[0.14em] text-warning">
          TODAY'S DOCKET
        </div>
        <div className="shell-hero-big relative mt-2">Start today's docket</div>
        <div className="relative mt-[5px] text-[13.5px] opacity-80">
          Log crew & plant hours, then submit at knock-off.
        </div>
      </button>
    );
  }

  const copy = HERO_COPY[state.kind];
  return (
    <button
      type="button"
      className="shell-hero"
      onClick={onPress}
      aria-label={`Today's docket — ${copy.big}`}
    >
      <span className="shell-hazard-stripe" aria-hidden="true" />
      <div className="relative font-mono text-[11.5px] font-semibold tracking-[0.14em] text-warning">
        {copy.kicker}
      </div>
      <div className="shell-hero-big relative mt-2">{copy.big}</div>
      <div className="relative mt-[5px] text-[13.5px] opacity-80">{copy.small}</div>
      <div className="relative mt-4 flex items-baseline gap-2.5">
        <span className="shell-hero-money">{formatCurrency(state.total)}</span>
        <span className="text-[12px] opacity-65">
          {state.kind === 'approved' ? 'approved today' : 'so far today'}
        </span>
      </div>
    </button>
  );
}
