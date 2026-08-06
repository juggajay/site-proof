import { NCR_GATE_DOT_CLASSES } from '@/lib/statusColors';
import { deriveNcrGates } from '../ncrGateStrip';
import type { NCR } from '../types';

/**
 * Four dots — Responded · Reviewed · Rectified · Closed — beside the status
 * chip, so a register row says which party still owes something without being
 * opened. Each dot carries its own tooltip and accessible name; state is
 * encoded by shape (filled / hollow / dash) as well as colour.
 */
export function NCRGateStrip({ ncr }: { ncr: NCR }) {
  const gates = deriveNcrGates(ncr);

  return (
    <div
      className="flex items-center gap-1"
      data-testid={`ncr-gate-strip-${ncr.id}`}
      aria-label={`Progress: ${gates.map((gate) => gate.detail).join('; ')}`}
      role="img"
    >
      {gates.map((gate) => (
        <span
          key={gate.key}
          title={gate.detail}
          data-testid={`ncr-gate-${gate.key}`}
          data-state={gate.state}
          className={NCR_GATE_DOT_CLASSES[gate.state]}
        />
      ))}
    </div>
  );
}
