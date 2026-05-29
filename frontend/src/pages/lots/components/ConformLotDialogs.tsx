import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface ConformLotDialogsProps {
  lotNumber: string | undefined;
  showConformConfirm: boolean;
  onConformCancel: () => void;
  onConformConfirm: () => void;
  showForceConformConfirm: boolean;
  forceConformReason: string;
  onForceConformReasonChange: (value: string) => void;
  onForceConformCancel: () => void;
  onForceConformConfirm: () => void;
  isConforming: boolean;
}

/**
 * Conform Lot and Force Conform Lot confirmation dialogs.
 *
 * Verbatim extraction from LotDetailPage.tsx — titles, copy, the force-conform
 * reason field, its validation (>= 5 non-whitespace chars), disabled states, and
 * the destructive styling are unchanged. All state (showConformConfirm,
 * showForceConformConfirm, forceConformReason, conforming) and handleConformLot
 * stay in LotDetailPage and are passed in as props. This only relocates the JSX;
 * it does not touch conformance rules, API calls, or permissions.
 */
export function ConformLotDialogs({
  lotNumber,
  showConformConfirm,
  onConformCancel,
  onConformConfirm,
  showForceConformConfirm,
  forceConformReason,
  onForceConformReasonChange,
  onForceConformCancel,
  onForceConformConfirm,
  isConforming,
}: ConformLotDialogsProps) {
  return (
    <>
      <ConfirmDialog
        open={showConformConfirm}
        title="Conform Lot"
        description={
          <>
            <p>Mark {lotNumber || 'this lot'} as quality-approved?</p>
            <p>This changes the lot status to conformed.</p>
          </>
        }
        confirmLabel="Conform Lot"
        onCancel={onConformCancel}
        onConfirm={onConformConfirm}
      />

      <ConfirmDialog
        open={showForceConformConfirm}
        title="Force Conform Lot"
        description={
          <>
            <p>Force conform {lotNumber || 'this lot'}?</p>
            <p>
              This bypasses incomplete prerequisites and records the override in the audit trail.
            </p>
            <label
              htmlFor="force-conform-reason"
              className="block pt-2 text-sm font-medium text-foreground"
            >
              Reason for force conforming
            </label>
            <p className="text-xs text-muted-foreground">
              Explain why this lot is being quality-approved before all blockers are cleared.
            </p>
            <textarea
              id="force-conform-reason"
              value={forceConformReason}
              onChange={(event) => onForceConformReasonChange(event.target.value)}
              rows={3}
              maxLength={1000}
              className="mt-2 min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Example: QA manager reviewed field evidence and approved the exception."
            />
          </>
        }
        confirmLabel="Force Conform Lot"
        variant="destructive"
        confirmDisabled={forceConformReason.trim().length < 5 || isConforming}
        onCancel={onForceConformCancel}
        onConfirm={onForceConformConfirm}
      />
    </>
  );
}
