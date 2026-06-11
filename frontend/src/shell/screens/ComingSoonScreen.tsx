/**
 * ComingSoonScreen — styled placeholder for shell routes not yet built in PR-1.
 *
 * Renders the full shell header + back navigation so the navigation feel is
 * testable now without implementing the full flow.  Each screen receives its
 * own `title`, `sub`, and `parent` via props.
 */

import { ShellScreen } from '../components/ShellScreen';

interface ComingSoonScreenProps {
  title: string;
  parent: string;
  sub?: string;
}

export function ComingSoonScreen({ title, parent, sub }: ComingSoonScreenProps) {
  return (
    <ShellScreen
      variant="inner"
      title={title}
      parent={parent}
      sub={sub ? <span className="text-muted-foreground">{sub}</span> : undefined}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        {/* "Under construction" visual — amber hazard stripe accent */}
        <div
          aria-hidden="true"
          className="h-1.5 w-24 rounded-full"
          style={{
            background:
              'repeating-linear-gradient(-55deg, hsl(var(--warning)) 0 6px, transparent 6px 12px)',
          }}
        />

        <div>
          <p
            className="text-[15px] font-semibold text-foreground"
            style={{
              fontFamily: "'IBM Plex Sans Condensed', 'IBM Plex Sans', sans-serif",
            }}
          >
            Coming next
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            This screen ships in a later PR.
            <br />
            Navigation and the back model work now.
          </p>
        </div>
      </div>
    </ShellScreen>
  );
}
