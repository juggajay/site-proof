import type { Dispatch, SetStateAction } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { validateHours } from '../docketActionData';

// Extracted from DocketApprovalsPage: the subcontractor "Create Docket" modal.
// The create mutation (handleCreateDocket), the open/close trigger, and all
// field state stay on the page; this component renders the controlled form and
// computes the display-only hours validation warnings from the same
// validateHours helper the page previously called inline.
export function CreateDocketModal({
  date,
  onDateChange,
  labourHours,
  onLabourHoursChange,
  plantHours,
  onPlantHoursChange,
  notes,
  onNotesChange,
  creating,
  onClose,
  onSubmit,
}: {
  date: string;
  onDateChange: (value: string) => void;
  labourHours: string;
  onLabourHoursChange: (value: string) => void;
  plantHours: string;
  onPlantHoursChange: (value: string) => void;
  notes: string;
  onNotesChange: Dispatch<SetStateAction<string>>;
  creating: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  // Validation state for the create-docket hours inputs
  const labourHoursValidation = validateHours(labourHours);
  const plantHoursValidation = validateHours(plantHours);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-background rounded-lg shadow-xl w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-docket-title"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 id="create-docket-title" className="text-xl font-semibold">
            Create Docket
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close create docket">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="new-docket-date" className="block text-sm font-medium mb-1">
              Date *
            </label>
            <input
              id="new-docket-date"
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="new-docket-labour-hours" className="block text-sm font-medium mb-1">
              Labour Hours
            </label>
            <input
              id="new-docket-labour-hours"
              type="number"
              value={labourHours}
              onChange={(e) => onLabourHoursChange(e.target.value)}
              className={`w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                labourHoursValidation.warning ? 'border-warning' : ''
              }`}
              placeholder="0"
              min="0"
              step="0.5"
            />
            {labourHoursValidation.warning && (
              <p className="mt-1 text-sm text-warning flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                {labourHoursValidation.warning}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="new-docket-plant-hours" className="block text-sm font-medium mb-1">
              Plant Hours
            </label>
            <input
              id="new-docket-plant-hours"
              type="number"
              value={plantHours}
              onChange={(e) => onPlantHoursChange(e.target.value)}
              className={`w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                plantHoursValidation.warning ? 'border-warning' : ''
              }`}
              placeholder="0"
              min="0"
              step="0.5"
            />
            {plantHoursValidation.warning && (
              <p className="mt-1 text-sm text-warning flex items-center gap-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                {plantHoursValidation.warning}
              </p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="new-docket-notes" className="block text-sm font-medium">
                Notes
              </label>
              {/* Feature #289: Voice-to-text for docket notes */}
              <VoiceInputButton
                onTranscript={(text) => onNotesChange((prev) => (prev ? prev + ' ' + text : text))}
                appendMode={true}
              />
            </div>
            <textarea
              id="new-docket-notes"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Enter any notes about this docket..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={creating || !date}>
            {creating ? 'Creating...' : 'Create Docket'}
          </Button>
        </div>
      </div>
    </div>
  );
}
