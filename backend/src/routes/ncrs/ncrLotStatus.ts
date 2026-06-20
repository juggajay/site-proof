import { AppError } from '../../lib/AppError.js';

const TERMINAL_NCR_LOT_STATUSES = new Set(['conformed', 'claimed']);

export interface NcrLinkableLot {
  id: string;
  lotNumber: string;
  status: string;
}

export function isTerminalNcrLotStatus(status: string): boolean {
  return TERMINAL_NCR_LOT_STATUSES.has(status);
}

export function assertNcrLinkableLots(lots: NcrLinkableLot[]): void {
  const terminalLots = lots.filter((lot) => isTerminalNcrLotStatus(lot.status));
  if (terminalLots.length === 0) {
    return;
  }

  throw AppError.badRequest(
    `Cannot link NCRs to conformed or claimed lots: ${terminalLots
      .map((lot) => lot.lotNumber)
      .join(', ')}`,
  );
}

export function getLotStatusAfterNcrClosure(currentStatus: string): 'in_progress' | null {
  return currentStatus === 'ncr_raised' ? 'in_progress' : null;
}
