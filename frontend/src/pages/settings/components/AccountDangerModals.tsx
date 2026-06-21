import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalBody,
  AlertModalHeader,
  AlertModalDescription,
  AlertModalFooter,
} from '@/components/ui/Modal';

type AccountDangerModalsProps = {
  userEmail: string | undefined;
  companyName: string | null | undefined;
  showDeleteModal: boolean;
  deleteConfirmEmail: string;
  deletePassword: string;
  isDeleting: boolean;
  deleteError: string | null;
  deletePasswordRequired: boolean;
  deleteConfirmationMatches: boolean;
  canDeleteAccount: boolean;
  showLeaveCompanyModal: boolean;
  isLeavingCompany: boolean;
  leaveCompanyError: string | null;
  onDeleteConfirmEmailChange: (value: string) => void;
  onDeletePasswordChange: (value: string) => void;
  onDeleteModalClose: () => void;
  onDeleteAccount: () => void;
  onLeaveCompanyModalClose: () => void;
  onLeaveCompany: () => void;
};

// Delete-account and leave-company confirmation modals. Presentation only:
// all state, validation flags, and side-effect handlers stay in SettingsPage.
export function AccountDangerModals({
  userEmail,
  companyName,
  showDeleteModal,
  deleteConfirmEmail,
  deletePassword,
  isDeleting,
  deleteError,
  deletePasswordRequired,
  deleteConfirmationMatches,
  canDeleteAccount,
  showLeaveCompanyModal,
  isLeavingCompany,
  leaveCompanyError,
  onDeleteConfirmEmailChange,
  onDeletePasswordChange,
  onDeleteModalClose,
  onDeleteAccount,
  onLeaveCompanyModalClose,
  onLeaveCompany,
}: AccountDangerModalsProps) {
  return (
    <>
      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <Modal alert onClose={onDeleteModalClose}>
          <AlertModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              Delete Account
            </div>
          </AlertModalHeader>
          <AlertModalDescription>
            Confirm your account email before permanently deleting your SiteProof account.
          </AlertModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  <strong>Warning:</strong> This will permanently delete your account access and
                  personal account data including:
                </p>
                <ul className="text-sm text-destructive/90 mt-2 list-disc list-inside space-y-1">
                  <li>Your profile and settings</li>
                  <li>Your credentials, sessions, and security tokens</li>
                  <li>All project memberships</li>
                  <li>Your avatar and notification preferences</li>
                </ul>
                <p className="text-sm text-destructive/90 mt-3">
                  Project records retained for compliance, including inspections, documents,
                  comments, and audit history, may stay in the project with your attribution
                  anonymised where records must be kept.
                </p>
              </div>

              <div>
                <Label htmlFor="delete-account-email" className="block mb-1">
                  Type your email to confirm:{' '}
                  <span className="text-muted-foreground">{userEmail}</span>
                </Label>
                <Input
                  id="delete-account-email"
                  type="email"
                  value={deleteConfirmEmail}
                  onChange={(e) => onDeleteConfirmEmailChange(e.target.value)}
                  placeholder="Enter your email"
                  aria-describedby={
                    deleteConfirmEmail && !deleteConfirmationMatches
                      ? 'delete-account-email-error'
                      : undefined
                  }
                  disabled={isDeleting}
                />
                {deleteConfirmEmail && !deleteConfirmationMatches && (
                  <p
                    id="delete-account-email-error"
                    role="alert"
                    className="text-sm text-destructive mt-1"
                  >
                    Email must match your account email exactly.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="delete-account-password" className="block mb-1">
                  {deletePasswordRequired ? 'Enter your password' : 'Password'}
                </Label>
                <Input
                  id="delete-account-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => onDeletePasswordChange(e.target.value)}
                  placeholder="Enter your password"
                  aria-describedby="delete-account-password-help"
                  disabled={isDeleting}
                />
                <p id="delete-account-password-help" className="mt-1 text-sm text-muted-foreground">
                  {deletePasswordRequired
                    ? 'Required for password-based accounts.'
                    : 'Not required for this sign-in method.'}
                </p>
              </div>

              {deleteError && (
                <div
                  role="alert"
                  className="text-sm text-destructive p-2 bg-destructive/10 rounded"
                >
                  {deleteError}
                </div>
              )}
            </div>
          </ModalBody>
          <AlertModalFooter>
            <Button variant="outline" onClick={onDeleteModalClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onDeleteAccount}
              disabled={isDeleting || !canDeleteAccount}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Permanently Delete'
              )}
            </Button>
          </AlertModalFooter>
        </Modal>
      )}

      {/* Leave Company Confirmation Modal */}
      {showLeaveCompanyModal && (
        <Modal alert onClose={onLeaveCompanyModalClose}>
          <AlertModalHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-warning/10">
                <AlertTriangle className="h-6 w-6 text-warning" />
              </div>
              Leave Company
            </div>
          </AlertModalHeader>
          <AlertModalDescription>
            Confirm before removing your company membership and access to company projects.
          </AlertModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-warning/10 border border-warning/20 rounded-lg">
                <p className="text-sm text-warning">
                  <strong>Warning:</strong> Leaving <strong>{companyName}</strong> will:
                </p>
                <ul className="text-sm text-warning/90 mt-2 list-disc list-inside space-y-1">
                  <li>Remove your access to all company projects</li>
                  <li>Remove you from all project teams</li>
                  <li>Revoke access to company documents</li>
                </ul>
              </div>

              <p className="text-sm text-muted-foreground">
                Are you sure you want to leave this company? You will need to be re-invited to
                rejoin.
              </p>

              {leaveCompanyError && (
                <div
                  role="alert"
                  className="text-sm text-destructive p-2 bg-destructive/10 rounded"
                >
                  {leaveCompanyError}
                </div>
              )}
            </div>
          </ModalBody>
          <AlertModalFooter>
            <Button
              variant="outline"
              onClick={onLeaveCompanyModalClose}
              disabled={isLeavingCompany}
            >
              Cancel
            </Button>
            <Button
              onClick={onLeaveCompany}
              disabled={isLeavingCompany}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {isLeavingCompany ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Leaving...
                </>
              ) : (
                'Leave Company'
              )}
            </Button>
          </AlertModalFooter>
        </Modal>
      )}
    </>
  );
}
