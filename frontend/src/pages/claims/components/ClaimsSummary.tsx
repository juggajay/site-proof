import React from 'react';
import { formatCurrency } from '../utils';

interface ClaimsSummaryProps {
  totalClaimed: number;
  totalCertified: number;
  totalPaid: number;
  outstanding: number;
}

export const ClaimsSummary = React.memo(function ClaimsSummary({
  totalClaimed,
  totalCertified,
  totalPaid,
  outstanding,
}: ClaimsSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      <div className="rounded-lg border bg-card p-3 md:p-4">
        <p className="text-sm text-muted-foreground">Total Claimed</p>
        <p className="text-lg font-bold tabular-nums md:text-2xl">{formatCurrency(totalClaimed)}</p>
      </div>
      <div className="rounded-lg border bg-card p-3 md:p-4">
        <p className="text-sm text-muted-foreground">Total Certified</p>
        <p className="text-lg font-bold tabular-nums md:text-2xl">
          {formatCurrency(totalCertified)}
        </p>
      </div>
      <div className="rounded-lg border bg-card p-3 md:p-4">
        <p className="text-sm text-muted-foreground">Total Paid</p>
        <p className="text-lg font-bold tabular-nums md:text-2xl">{formatCurrency(totalPaid)}</p>
      </div>
      <div className="rounded-lg border bg-card p-3 md:p-4">
        <p className="text-sm text-muted-foreground">Outstanding</p>
        <p className="text-lg font-bold tabular-nums text-warning md:text-2xl">
          {formatCurrency(outstanding)}
        </p>
      </div>
    </div>
  );
});
