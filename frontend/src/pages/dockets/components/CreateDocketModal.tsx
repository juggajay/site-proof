import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { ResponsiveSheet } from '@/components/ui/ResponsiveSheet';

// Extracted from DocketApprovalsPage: the subcontractor "Create Docket" modal.
// The create mutation (handleCreateDocket), the open/close trigger, and all
// field state stay on the page; this component renders the controlled form and
// computes the display-only hours validation warnings from the same
// validateHours helper the page previously called inline.
export function CreateDocketModal({
  date,
  onDateChange,
  notes,
  onNotesChange,
  creating,
  onClose,
  onSubmit,
}: {
  date: string;
  onDateChange: (value: string) => void;
  notes: string;
  onNotesChange: Dispatch<SetStateAction<string>>;
  creating: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const footer = (
    <>
      <Button variant="outline" className="min-h-[44px]" onClick={onClose}>
        Cancel
      </Button>
      <Button className="min-h-[44px]" onClick={onSubmit} disabled={creating || !date}>
        {creating ? 'Creating...' : 'Create Docket'}
      </Button>
    </>
  );

  return (
    <ResponsiveSheet open={true} onClose={onClose} title="Create Docket" footer={footer}>
      <div className="space-y-4">
        <div>
          <label htmlFor="new-docket-date" className="block text-sm font-medium mb-1">
            Date *
          </label>
          <input
            id="new-docket-date"
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
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
    </ResponsiveSheet>
  );
}
