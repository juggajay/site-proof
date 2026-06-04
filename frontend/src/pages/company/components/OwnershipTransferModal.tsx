import { Crown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Modal,
  ModalHeader,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@/components/ui/Modal';
import type { CompanyMember } from '../companySettingsData';

// Extracted from CompanySettingsPage: the owner-only "Transfer Ownership"
// confirmation modal. The member fetch, transfer mutation, double-submit
// guard, and all state stay on the page; this component renders the
// loading/empty/error/select states and confirmation copy from props.
export function OwnershipTransferModal({
  members,
  loadingMembers,
  selectedNewOwner,
  onSelectedNewOwnerChange,
  transferring,
  transferError,
  onRetryLoadMembers,
  onClose,
  onTransfer,
}: {
  members: CompanyMember[];
  loadingMembers: boolean;
  selectedNewOwner: string;
  onSelectedNewOwnerChange: (value: string) => void;
  transferring: boolean;
  transferError: string;
  onRetryLoadMembers: () => Promise<void>;
  onClose: () => void;
  onTransfer: () => void;
}) {
  return (
    <Modal onClose={onClose} className="max-w-md">
      <ModalHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Crown className="h-6 w-6 text-amber-600" />
          </div>
          Transfer Ownership
        </div>
      </ModalHeader>
      <ModalDescription>Choose another company member to become the owner.</ModalDescription>
      <ModalBody>
        {transferError && (
          <div
            role="alert"
            className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
          >
            <p>{transferError}</p>
            {!loadingMembers && members.length === 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => void onRetryLoadMembers()}
              >
                Try again
              </Button>
            )}
          </div>
        )}

        {loadingMembers ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : members.length === 0 && !transferError ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">
              No other members in your company to transfer ownership to.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Invite team members first before transferring ownership.
            </p>
          </div>
        ) : members.length > 0 ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="company-transfer-new-owner" className="mb-2">
                Select New Owner
              </Label>
              <NativeSelect
                id="company-transfer-new-owner"
                value={selectedNewOwner}
                onChange={(e) => onSelectedNewOwnerChange(e.target.value)}
                disabled={transferring}
              >
                <option value="">Choose a team member...</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName || member.email} ({member.roleInCompany})
                  </option>
                ))}
              </NativeSelect>
            </div>

            {selectedNewOwner && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  You are about to transfer ownership to{' '}
                  <strong>
                    {members.find((m) => m.id === selectedNewOwner)?.fullName ||
                      members.find((m) => m.id === selectedNewOwner)?.email}
                  </strong>
                  . This action cannot be easily undone.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={transferring}>
          Cancel
        </Button>
        {members.length > 0 && (
          <Button
            type="button"
            onClick={onTransfer}
            disabled={transferring || !selectedNewOwner}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            {transferring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              'Transfer Ownership'
            )}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
