/**
 * NCRs tab content for LotDetailPage.
 * Displays non-conformance reports linked to a lot.
 * On mobile (isMobile=true) renders tap-friendly cards; desktop rendering is
 * unchanged.
 */

import { useNavigate } from 'react-router-dom';
import type { NCR } from '@/pages/lots/types';
import { ncrStatusColors, severityColors } from '@/pages/lots/constants';
import { formatStatusLabel } from '@/lib/statusLabels';
import { MobileDataCard } from '@/components/ui/MobileDataCard';

interface NCRsTabContentProps {
  projectId: string;
  /** Lot this tab belongs to — enables the pre-filled "Raise NCR" deep link. */
  lotId?: string;
  ncrs: NCR[];
  loading: boolean;
  /** When true, renders mobile card layout instead of the desktop table. */
  isMobile?: boolean;
}

export function NCRsTabContent({
  projectId,
  lotId,
  ncrs,
  loading,
  isMobile = false,
}: NCRsTabContentProps) {
  const navigate = useNavigate();

  // Deep-link a single NCR open in the register (?ncr=<id> scrolls to + highlights
  // it). Used by both desktop rows and mobile cards so a lot's NCR is one tap from
  // its full record.
  const openNcr = (ncrId: string) =>
    navigate(`/projects/${encodeURIComponent(projectId)}/ncr?ncr=${encodeURIComponent(ncrId)}`);

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (ncrs.length === 0) {
    return (
      <div className="rounded-lg border p-6 text-center">
        <div className="text-4xl mb-2">✅</div>
        <h3 className="text-lg font-semibold mb-2">No NCRs</h3>
        <p className="text-muted-foreground mb-4">
          No non-conformance reports have been raised for this lot.
        </p>
        <button
          onClick={() =>
            navigate(
              lotId
                ? `/projects/${encodeURIComponent(projectId)}/ncr?create=1&lot=${encodeURIComponent(lotId)}`
                : `/projects/${encodeURIComponent(projectId)}/ncr`,
            )
          }
          className="rounded-lg border border-primary px-4 py-2 text-sm text-primary hover:bg-primary/10"
        >
          {lotId ? 'Raise NCR' : 'Go to NCR Register'}
        </button>
      </div>
    );
  }

  // Mobile card list — one card per NCR
  if (isMobile) {
    return (
      <div className="space-y-3" data-testid="ncrs-mobile-cards">
        {ncrs.map((ncr) => {
          // Map NCR status to a MobileDataCard status variant
          const statusVariant =
            ncr.status === 'open'
              ? ('error' as const)
              : ncr.status === 'investigating' || ncr.status === 'rectification'
                ? ('warning' as const)
                : ('default' as const);

          return (
            <MobileDataCard
              key={ncr.id}
              title={ncr.ncrNumber}
              subtitle={ncr.description}
              status={{ label: formatStatusLabel(ncr.status), variant: statusVariant }}
              fields={[
                {
                  label: 'Severity',
                  value: (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[ncr.severity] || 'bg-muted text-muted-foreground'}`}
                    >
                      {ncr.severity.toUpperCase()}
                    </span>
                  ),
                  priority: 'primary',
                },
                {
                  label: 'Category',
                  value: <span className="capitalize">{ncr.category}</span>,
                  priority: 'primary',
                },
                {
                  label: 'Raised By',
                  value: ncr.raisedBy?.fullName || ncr.raisedBy?.email || '—',
                  priority: 'secondary',
                },
              ]}
              onClick={() => openNcr(ncr.id)}
              data-testid={`ncr-card-${ncr.id}`}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium">NCR #</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Category</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Severity</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
            <th className="px-4 py-3 text-left text-sm font-medium">Raised By</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ncrs.map((ncr) => (
            <tr
              key={ncr.id}
              className="cursor-pointer hover:bg-muted/30"
              onClick={() => openNcr(ncr.id)}
            >
              <td className="px-4 py-3 text-sm font-mono">{ncr.ncrNumber}</td>
              <td className="px-4 py-3 text-sm max-w-xs truncate">{ncr.description}</td>
              <td className="px-4 py-3 text-sm capitalize">{ncr.category}</td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${severityColors[ncr.severity] || 'bg-muted text-muted-foreground'}`}
                >
                  {ncr.severity.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${ncrStatusColors[ncr.status] || 'bg-muted text-muted-foreground'}`}
                >
                  {formatStatusLabel(ncr.status)}
                </span>
              </td>
              <td className="px-4 py-3 text-sm">
                {ncr.raisedBy?.fullName || ncr.raisedBy?.email || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
