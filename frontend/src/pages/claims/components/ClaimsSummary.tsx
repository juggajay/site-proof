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
    <div className="grid gap-4 md:grid-cols-4">
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Total Claimed</p>
        <p className="text-2xl font-bold">{formatCurrency(totalClaimed)}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Total Certified</p>
        <p className="text-2xl font-bold">{formatCurrency(totalCertified)}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Total Paid</p>
        <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
      </div>
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm text-muted-foreground">Outstanding</p>
        <p className="text-2xl font-bold text-warning">{formatCurrency(outstanding)}</p>
      </div>
    </div>
  );
});
