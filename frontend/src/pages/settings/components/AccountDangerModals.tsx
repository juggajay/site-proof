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
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              Delete Account
            </div>
          </AlertModalHeader>
          <AlertModalDescription>
            Confirm your account email before permanently deleting your SiteProof account and
            associated data.
          </AlertModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> This will permanently delete your account and all
                  associated data including:
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 mt-2 list-disc list-inside space-y-1">
                  <li>Your profile and settings</li>
                  <li>All project memberships</li>
                  <li>ITP completions you've made</li>
                  <li>Other user-created content</li>
                </ul>
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
                    className="text-sm text-red-600 dark:text-red-400 mt-1"
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
                  className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded"
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
              <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              Leave Company
            </div>
          </AlertModalHeader>
          <AlertModalDescription>
            Confirm before removing your company membership and access to company projects.
          </AlertModalDescription>
          <ModalBody>
            <div className="space-y-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Warning:</strong> Leaving <strong>{companyName}</strong> will:
                </p>
                <ul className="text-sm text-amber-700 dark:text-amber-300 mt-2 list-disc list-inside space-y-1">
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
                  className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded"
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
              className="bg-amber-600 text-white hover:bg-amber-700"
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
