import { Calendar, Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DATE_RANGE_PRESETS, type DateRangePreset } from '@/lib/dashboardDateRanges';

interface DashboardDateRangePickerProps {
  selectedPreset: DateRangePreset;
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSelectPreset: (preset: DateRangePreset) => void;
}

export function DashboardDateRangePicker({
  selectedPreset,
  label,
  isOpen,
  onToggle,
  onClose,
  onSelectPreset,
}: DashboardDateRangePickerProps) {
  return (
    <div className="relative min-w-0">
      <Button
        variant="outline"
        onClick={onToggle}
        title="Filter by date range"
        className="w-full justify-between sm:w-auto sm:justify-center"
      >
        <Calendar className="h-4 w-4" />
        <span>{label}</span>
        <ChevronDown className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute right-0 top-full mt-2 w-48 bg-card border rounded-lg shadow-lg z-20 p-1">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground border-b mb-1">
              Select Date Range
            </div>
            {DATE_RANGE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  onSelectPreset(preset.value);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-muted rounded ${
                  selectedPreset === preset.value ? 'bg-muted font-medium' : ''
                }`}
                type="button"
              >
                <span>{preset.label}</span>
                {selectedPreset === preset.value && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
