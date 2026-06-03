import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { writeLocalStorageItem } from '@/lib/storagePreferences';
import {
  COLUMN_CONFIG,
  COLUMN_ORDER_STORAGE_KEY,
  COLUMN_STORAGE_KEY,
  type ColumnId,
} from './lotFilterConfig';

interface LotColumnSettingsMenuProps {
  isSubcontractor: boolean;
  canViewBudgets: boolean;
  visibleColumns: ColumnId[];
  onSetVisibleColumns: React.Dispatch<React.SetStateAction<ColumnId[]>>;
  columnOrder: ColumnId[];
  onSetColumnOrder: React.Dispatch<React.SetStateAction<ColumnId[]>>;
}

export function LotColumnSettingsMenu({
  isSubcontractor,
  canViewBudgets,
  visibleColumns,
  onSetVisibleColumns,
  columnOrder,
  onSetColumnOrder,
}: LotColumnSettingsMenuProps) {
  const [open, setOpen] = useState(false);

  const toggleColumn = (columnId: ColumnId) => {
    const column = COLUMN_CONFIG.find((candidate) => candidate.id === columnId);
    if (column?.required) return;

    onSetVisibleColumns((previousColumns) => {
      const newColumns = previousColumns.includes(columnId)
        ? previousColumns.filter((column) => column !== columnId)
        : [...previousColumns, columnId];

      writeLocalStorageItem(COLUMN_STORAGE_KEY, JSON.stringify(newColumns));
      return newColumns;
    });
  };

  const moveColumnUp = (columnId: ColumnId) => {
    onSetColumnOrder((previousOrder) => {
      const index = previousOrder.indexOf(columnId);
      if (index <= 0) return previousOrder;
      if (previousOrder[index - 1] === 'lotNumber') return previousOrder;

      const newOrder = [...previousOrder];
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
      writeLocalStorageItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(newOrder));
      return newOrder;
    });
  };

  const moveColumnDown = (columnId: ColumnId) => {
    onSetColumnOrder((previousOrder) => {
      const index = previousOrder.indexOf(columnId);
      if (index < 0 || index >= previousOrder.length - 1) return previousOrder;
      if (columnId === 'lotNumber') return previousOrder;

      const newOrder = [...previousOrder];
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
      writeLocalStorageItem(COLUMN_ORDER_STORAGE_KEY, JSON.stringify(newOrder));
      return newOrder;
    });
  };

  const isColumnVisible = (columnId: ColumnId) => visibleColumns.includes(columnId);

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(!open)} title="Customize columns">
        <Settings2 className="h-4 w-4" />
        Columns
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-20 w-64 rounded-lg border bg-card shadow-lg">
            <div className="p-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">
                Show/Hide & Reorder Columns
              </span>
            </div>
            <div className="p-1">
              {columnOrder.map((columnId, index) => {
                const column = COLUMN_CONFIG.find((candidate) => candidate.id === columnId);
                if (!column) return null;
                if (column.id === 'subcontractor' && isSubcontractor) return null;
                if (column.id === 'budget' && !canViewBudgets) return null;

                const isFirst = index === 0 || columnOrder[index - 1] === 'lotNumber';
                const isLast = index === columnOrder.length - 1;

                return (
                  <div
                    key={column.id}
                    className="flex items-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-muted"
                  >
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleColumn(column.id);
                      }}
                      disabled={column.required}
                      className={`flex items-center gap-2 flex-1 text-left ${
                        column.required ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center ${
                          isColumnVisible(column.id) ? 'bg-primary border-primary' : 'border-border'
                        }`}
                      >
                        {isColumnVisible(column.id) && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="truncate">{column.label}</span>
                      {column.required && (
                        <span className="text-xs text-muted-foreground">(req)</span>
                      )}
                    </button>
                    {!column.required && (
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            moveColumnUp(column.id);
                          }}
                          disabled={isFirst}
                          className={`p-0.5 rounded hover:bg-muted ${
                            isFirst ? 'opacity-30 cursor-not-allowed' : ''
                          }`}
                          title="Move up"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            moveColumnDown(column.id);
                          }}
                          disabled={isLast}
                          className={`p-0.5 rounded hover:bg-muted ${
                            isLast ? 'opacity-30 cursor-not-allowed' : ''
                          }`}
                          title="Move down"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
