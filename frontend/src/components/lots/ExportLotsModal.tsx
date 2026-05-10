import { useState, useMemo } from 'react';
import { Download, Check, Calendar } from 'lucide-react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { downloadCsv } from '@/lib/csv';

interface ExportColumn {
  key: string;
  label: string;
  required?: boolean;
}

interface ExportLot {
  lotNumber?: string | null;
  description?: string | null;
  chainageStart?: number | string | null;
  chainageEnd?: number | string | null;
  activityType?: string | null;
  status?: string | null;
  budgetAmount?: number | string | null;
  createdAt?: string | null;
  assignedSubcontractor?: {
    companyName?: string | null;
  } | null;
}

interface ExportLotsModalProps {
  projectId: string;
  lots: ExportLot[];
  canViewBudgets: boolean;
  isSubcontractor: boolean;
  onClose: () => void;
}

// Helper to parse date from input
const parseDateFromInput = (value: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

const ALL_COLUMNS: ExportColumn[] = [
  { key: 'lotNumber', label: 'Lot Number', required: true },
  { key: 'description', label: 'Description' },
  { key: 'chainageStart', label: 'Chainage Start' },
  { key: 'chainageEnd', label: 'Chainage End' },
  { key: 'activityType', label: 'Activity Type' },
  { key: 'status', label: 'Status' },
  { key: 'budgetAmount', label: 'Budget' },
  { key: 'subcontractor', label: 'Subcontractor' },
];

export function ExportLotsModal({
  projectId,
  lots,
  canViewBudgets,
  isSubcontractor,
  onClose,
}: ExportLotsModalProps) {
  // Filter columns based on permissions
  const availableColumns = ALL_COLUMNS.filter((col) => {
    if (col.key === 'budgetAmount' && !canViewBudgets) return false;
    if (col.key === 'subcontractor' && isSubcontractor) return false;
    return true;
  });

  // Initialize selected columns (all selected by default except conditionally hidden ones)
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(availableColumns.map((col) => col.key)),
  );

  // Date range filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Filter lots by date range
  const filteredLots = useMemo(() => {
    let result = lots;

    if (startDate) {
      const start = parseDateFromInput(startDate);
      if (start) {
        // Set to start of day
        start.setHours(0, 0, 0, 0);
        result = result.filter((lot) => {
          if (!lot.createdAt) return false;
          const lotDate = new Date(lot.createdAt);
          return lotDate >= start;
        });
      }
    }

    if (endDate) {
      const end = parseDateFromInput(endDate);
      if (end) {
        // Set to end of day
        end.setHours(23, 59, 59, 999);
        result = result.filter((lot) => {
          if (!lot.createdAt) return false;
          const lotDate = new Date(lot.createdAt);
          return lotDate <= end;
        });
      }
    }

    return result;
  }, [lots, startDate, endDate]);

  const toggleColumn = (key: string) => {
    const column = availableColumns.find((c) => c.key === key);
    if (column?.required) return; // Can't deselect required columns

    const newSelected = new Set(selectedColumns);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedColumns(newSelected);
  };

  const selectAll = () => {
    setSelectedColumns(new Set(availableColumns.map((col) => col.key)));
  };

  const selectNone = () => {
    // Keep only required columns
    setSelectedColumns(
      new Set(availableColumns.filter((col) => col.required).map((col) => col.key)),
    );
  };

  const handleExport = () => {
    // Build headers based on selected columns
    const headers = availableColumns
      .filter((col) => selectedColumns.has(col.key))
      .map((col) => col.label);

    // Convert lots to CSV rows (using filtered lots)
    const rows = filteredLots.map((lot) => {
      const row: string[] = [];
      availableColumns.forEach((col) => {
        if (!selectedColumns.has(col.key)) return;

        switch (col.key) {
          case 'lotNumber':
            row.push(lot.lotNumber || '');
            break;
          case 'description':
            row.push(lot.description || '');
            break;
          case 'chainageStart':
            row.push(lot.chainageStart?.toString() || '');
            break;
          case 'chainageEnd':
            row.push(lot.chainageEnd?.toString() || '');
            break;
          case 'activityType':
            row.push(lot.activityType || '');
            break;
          case 'status':
            row.push(lot.status || '');
            break;
          case 'budgetAmount':
            row.push(lot.budgetAmount?.toString() || '');
            break;
          case 'subcontractor':
            row.push(lot.assignedSubcontractor?.companyName || '');
            break;
        }
      });
      return row;
    });

    downloadCsv(`lot-register-${projectId}-${new Date().toISOString().split('T')[0]}.csv`, [
      headers,
      ...rows,
    ]);

    onClose();
  };

  const selectedCount = selectedColumns.size;
  const totalCount = availableColumns.length;

  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>
        <span className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Lots to CSV
        </span>
      </ModalHeader>

      <ModalBody>
        {/* Column Selection */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Select columns to include:</p>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-primary hover:underline">
                Select All
              </button>
              <span className="text-muted-foreground">|</span>
              <button onClick={selectNone} className="text-primary hover:underline">
                Select None
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-auto border rounded-lg p-3">
            {availableColumns.map((column) => (
              <div
                key={column.key}
                onClick={() => toggleColumn(column.key)}
                className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted ${
                  column.required ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                <div
                  className={`w-5 h-5 rounded border flex items-center justify-center ${
                    selectedColumns.has(column.key)
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-input'
                  }`}
                >
                  {selectedColumns.has(column.key) && <Check className="h-3 w-3" />}
                </div>
                <span className="flex-1">{column.label}</span>
                {column.required && (
                  <span className="text-xs text-muted-foreground">(required)</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="mb-4">
          <p className="text-sm font-medium mb-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Filter by creation date (optional):
          </p>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs text-primary hover:underline mt-2"
            >
              Clear date filter
            </button>
          )}
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground">
          Exporting {filteredLots.length} lot{filteredLots.length !== 1 ? 's' : ''}{' '}
          {filteredLots.length !== lots.length && (
            <span className="text-amber-600">(filtered from {lots.length})</span>
          )}{' '}
          with {selectedCount} of {totalCount} columns
        </p>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleExport} disabled={selectedCount === 0 || filteredLots.length === 0}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </ModalFooter>
    </Modal>
  );
}
