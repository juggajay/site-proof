import { Loader2, MapPin, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import type { Employee, Lot, Plant } from '../docketEditData';
import { formatCurrency } from '../docketEditDisplay';

// Common time presets
const TIME_PRESETS = [
  { label: '6am-2pm', start: '06:00', finish: '14:00' },
  { label: '7am-3pm', start: '07:00', finish: '15:00' },
  { label: '7am-5pm', start: '07:00', finish: '17:00' },
  { label: '6am-6pm', start: '06:00', finish: '18:00' },
];

// Extracted from DocketEditPage: the labour/plant add-entry bottom sheet.
// Data fetching, entry mutations, validation, preview math, and all sheet
// state stay in the page; this component is prop-driven and presentation-only.
export function DocketEntrySheet({
  sheetType,
  selectedEmployee,
  selectedPlant,
  startTime,
  finishTime,
  hoursOperated,
  wetOrDry,
  selectedLotId,
  assignedLots,
  labourHoursError,
  plantHoursError,
  previewHours,
  previewCost,
  saving,
  onStartTimeChange,
  onFinishTimeChange,
  onHoursOperatedChange,
  onWetOrDryChange,
  onSelectedLotIdChange,
  onClose,
  onAddLabourEntry,
  onAddPlantEntry,
}: {
  sheetType: 'labour' | 'plant';
  selectedEmployee: Employee | null;
  selectedPlant: Plant | null;
  startTime: string;
  finishTime: string;
  hoursOperated: string;
  wetOrDry: 'dry' | 'wet';
  selectedLotId: string;
  assignedLots: Lot[];
  labourHoursError: string | null;
  plantHoursError: string | null;
  previewHours: number;
  previewCost: number;
  saving: boolean;
  onStartTimeChange: (value: string) => void;
  onFinishTimeChange: (value: string) => void;
  onHoursOperatedChange: (value: string) => void;
  onWetOrDryChange: (value: 'dry' | 'wet') => void;
  onSelectedLotIdChange: (value: string) => void;
  onClose: () => void;
  onAddLabourEntry: () => void;
  onAddPlantEntry: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-12 h-1.5 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              {sheetType === 'labour' ? 'Add Labour Hours' : 'Add Plant Hours'}
            </h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {sheetType === 'labour' && selectedEmployee && (
              <span>
                {selectedEmployee.name} - {selectedEmployee.role} ($
                {selectedEmployee.hourlyRate}/hr)
              </span>
            )}
            {sheetType === 'plant' && selectedPlant && (
              <span>
                {selectedPlant.type} - {selectedPlant.description}
              </span>
            )}
          </p>
        </div>

        <div className="px-4 py-4 space-y-6">
          {sheetType === 'labour' && (
            <>
              {/* Time inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => onStartTimeChange(e.target.value)}
                    className="mt-1 h-12 text-lg"
                  />
                </div>
                <div>
                  <Label htmlFor="finishTime">Finish Time</Label>
                  <Input
                    id="finishTime"
                    type="time"
                    value={finishTime}
                    onChange={(e) => onFinishTimeChange(e.target.value)}
                    className="mt-1 h-12 text-lg"
                  />
                </div>
              </div>
              {labourHoursError && (
                <p className="-mt-4 text-sm text-destructive">{labourHoursError}</p>
              )}

              {/* Quick presets */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Quick presets</p>
                <div className="flex flex-wrap gap-2">
                  {TIME_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onStartTimeChange(preset.start);
                        onFinishTimeChange(preset.finish);
                      }}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Lot selection */}
              <div>
                <Label>Allocate to Lot</Label>
                {assignedLots.length === 1 ? (
                  <div className="flex items-center gap-2 p-3 bg-muted rounded-lg mt-1">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{assignedLots[0].lotNumber}</span>
                    <Check className="h-4 w-4 text-success ml-auto" />
                  </div>
                ) : (
                  <NativeSelect
                    value={selectedLotId}
                    onChange={(e) => onSelectedLotIdChange(e.target.value)}
                    className="mt-1 h-12"
                  >
                    <option value="">Select a lot</option>
                    {assignedLots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.lotNumber} {lot.activity && `- ${lot.activity}`}
                      </option>
                    ))}
                  </NativeSelect>
                )}
              </div>
            </>
          )}

          {sheetType === 'plant' && (
            <>
              {/* Hours input */}
              <div>
                <Label htmlFor="hours">Hours Operated</Label>
                <Input
                  id="hours"
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={hoursOperated}
                  onChange={(e) => onHoursOperatedChange(e.target.value)}
                  className="mt-1 h-12 text-lg"
                />
                {plantHoursError && (
                  <p className="mt-1 text-sm text-destructive">{plantHoursError}</p>
                )}
              </div>

              {/* Wet/Dry toggle */}
              {selectedPlant && selectedPlant.wetRate > 0 && (
                <div>
                  <Label>Condition</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      className={cn(
                        'p-3 rounded-lg border text-center transition-colors',
                        wetOrDry === 'dry'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-border',
                      )}
                      onClick={() => onWetOrDryChange('dry')}
                    >
                      <p className="font-medium text-foreground">Dry</p>
                      <p className="text-sm text-muted-foreground">${selectedPlant.dryRate}/hr</p>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'p-3 rounded-lg border text-center transition-colors',
                        wetOrDry === 'wet'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-border',
                      )}
                      onClick={() => onWetOrDryChange('wet')}
                    >
                      <p className="font-medium text-foreground">Wet</p>
                      <p className="text-sm text-muted-foreground">${selectedPlant.wetRate}/hr</p>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Preview */}
          <div className="bg-muted rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-medium text-foreground">{previewHours} hours</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Cost</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(previewCost)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-8 pt-2">
          <Button
            onClick={sheetType === 'labour' ? onAddLabourEntry : onAddPlantEntry}
            disabled={
              saving ||
              (sheetType === 'labour' && Boolean(labourHoursError)) ||
              (sheetType === 'labour' && !selectedLotId) ||
              (sheetType === 'plant' && Boolean(plantHoursError))
            }
            className={cn(
              'w-full h-12',
              saving ||
                (sheetType === 'labour' && Boolean(labourHoursError)) ||
                (sheetType === 'labour' && !selectedLotId) ||
                (sheetType === 'plant' && Boolean(plantHoursError))
                ? ''
                : 'bg-primary hover:bg-primary/90 text-primary-foreground',
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              'Add to Docket'
            )}
          </Button>
        </div>
      </div>
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
