// The "Add HP Recipient" modal moved out of NotificationsTab. The JSX below
// is moved verbatim; prop names intentionally match the tab's variable names
// so the markup stays byte-identical with the pre-extraction tab. State,
// validation, and persistence stay owned by NotificationsTab.
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';

interface AddHpRecipientModalProps {
  newRecipientRole: string;
  setNewRecipientRole: (value: string) => void;
  newRecipientEmail: string;
  setNewRecipientEmail: (value: string) => void;
  recipientError: string;
  savingRecipients: boolean;
  /** The tab's closeRecipientModal — a no-arg call respects the saving guard. */
  closeRecipientModal: (force?: boolean) => void;
  handleAddRecipient: () => Promise<void>;
}

export function AddHpRecipientModal({
  newRecipientRole,
  setNewRecipientRole,
  newRecipientEmail,
  setNewRecipientEmail,
  recipientError,
  savingRecipients,
  closeRecipientModal,
  handleAddRecipient,
}: AddHpRecipientModalProps) {
  return (
    <Modal onClose={closeRecipientModal}>
      <ModalHeader>Add HP Recipient</ModalHeader>
      <ModalDescription>
        Add a default recipient for hold point release notifications.
      </ModalDescription>
      <ModalBody>
        {recipientError && (
          <div
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4"
          >
            {recipientError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="hp-recipient-role" className="mb-1">
              Role/Title
            </Label>
            <Input
              id="hp-recipient-role"
              type="text"
              value={newRecipientRole}
              onChange={(e) => setNewRecipientRole(e.target.value)}
              placeholder="e.g., Superintendent, Quality Manager"
              disabled={savingRecipients}
            />
          </div>
          <div>
            <Label htmlFor="hp-recipient-email" className="mb-1">
              Email Address
            </Label>
            <Input
              id="hp-recipient-email"
              type="email"
              value={newRecipientEmail}
              onChange={(e) => setNewRecipientEmail(e.target.value)}
              placeholder="email@example.com"
              disabled={savingRecipients}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={() => closeRecipientModal()}
          disabled={savingRecipients}
        >
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => void handleAddRecipient()}
          disabled={savingRecipients || !newRecipientRole.trim() || !newRecipientEmail.trim()}
        >
          {savingRecipients ? 'Adding...' : 'Add Recipient'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
