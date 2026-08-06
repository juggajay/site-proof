// One rendered cell of a lot register row. Split out of LotTable so the table
// component is about virtualization, selection and grouping, and the per-column
// formatting lives in one place a new column can be added to.
import { formatActivityLabel } from '@/lib/activityTaxonomy';
import { formatStatusLabel } from '@/lib/statusLabels';
import { getLotStatusBadgeClass } from '@/lib/lotStatusOverview';
import { formatChainage, highlightSearchTerm } from './lotTableDisplay';
import { lotDaysOpen } from './lotRegisterQueue';
import type { ColumnId } from './lotFilterConfig';
import type { Lot } from '../lotsPageTypes';

const EM_DASH = '—';

interface LotTableCellProps {
  columnId: ColumnId;
  lot: Lot;
  searchQuery: string;
}

export function LotTableCell({ columnId, lot, searchQuery }: LotTableCellProps) {
  switch (columnId) {
    case 'lotNumber':
      return <td className="p-3 font-medium">{highlightSearchTerm(lot.lotNumber, searchQuery)}</td>;

    case 'description':
      return (
        <td className="p-3 max-w-xs">
          <span className="block truncate" title={lot.description || ''}>
            {lot.description ? highlightSearchTerm(lot.description, searchQuery) : EM_DASH}
          </span>
        </td>
      );

    case 'chainage':
      return <td className="p-3 whitespace-nowrap">{formatChainage(lot)}</td>;

    case 'activityType': {
      const activityLabel = formatActivityLabel(lot.activityType) || EM_DASH;
      return (
        <td className="p-3">
          <span className="block truncate" title={activityLabel}>
            {activityLabel}
          </span>
        </td>
      );
    }

    case 'status':
      return (
        <td className="p-3">
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${getLotStatusBadgeClass(lot.status)}`}
          >
            {formatStatusLabel(lot.status)}
          </span>
        </td>
      );

    case 'daysOpen': {
      // Counts to conformance where the lot has closed, otherwise to today — an
      // ageing number, not a stopwatch that keeps running after handover.
      const daysOpen = lotDaysOpen(lot);
      return (
        <td className="p-3 tabular-nums" data-testid={`lot-days-open-${lot.id}`}>
          {daysOpen === null ? EM_DASH : daysOpen}
        </td>
      );
    }

    case 'subcontractor': {
      const subcontractorName = lot.assignedSubcontractor?.companyName || EM_DASH;
      return (
        <td className="p-3">
          <span className="block truncate" title={subcontractorName}>
            {subcontractorName}
          </span>
        </td>
      );
    }

    case 'budget':
      return (
        <td className="p-3">
          {lot.budgetAmount ? `$${lot.budgetAmount.toLocaleString('en-AU')}` : EM_DASH}
        </td>
      );

    default:
      return null;
  }
}
