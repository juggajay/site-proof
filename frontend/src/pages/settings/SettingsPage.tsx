import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/lib/theme';
import { useDateFormat } from '@/lib/dateFormat';
import { useTimezone } from '@/lib/timezone';
import { getAuthToken, useAuth } from '@/lib/auth';
import { ApiError, apiFetch, authFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { formatDateKey } from '@/lib/localDate';
import { PushNotificationSettings } from '@/components/settings/PushNotificationSettings';
import { MfaSettingsSection } from './components/MfaSettingsSection';
import { EmailPreferencesSection } from './components/EmailPreferencesSection';
import { AccountDangerModals } from './components/AccountDangerModals';
import {
  AboutSection,
  AppearanceSection,
  CompanyMembershipSection,
  PrivacyDataSection,
  RegionalSettingsSection,
} from './components/SettingsSections';
import { downloadBlob } from '@/lib/downloads';
import { logError } from '@/lib/logger';

const INVALID_DOWNLOAD_FILENAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

function sanitizeJsonExportFilename(filename: string | null | undefined, fallback: string) {
  const sanitized = Array.from(filename ?? '')
    .map((char) =>
      INVALID_DOWNLOAD_FILENAME_CHARS.has(char) || char.charCodeAt(0) < 32 ? '-' : char,
    )
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/^[.\-\s]+/, '')
    .trim();

  const safeFilename = sanitized || fallback;
  return safeFilename.toLowerCase().endsWith('.json') ? safeFilename : `${safeFilename}.json`;
}

function getContentDispositionFilename(contentDisposition: string | null) {
  if (!contentDisposition) return null;

  const encodedMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (encodedMatch) {
    try {
      return decodeURIComponent(encodedMatch[1]);
    } catch {
      return encodedMatch[1];
    }
  }

  return (
    contentDisposition.match(/filename="([^"]+)"/i)?.[1] ??
    contentDisposition.match(/filename=([^;]+)/i)?.[1]?.trim() ??
    null
  );
}

function emailMatchesConfirmation(input: string, expectedEmail?: string | null): boolean {
  if (!expectedEmail) return false;
  return input.trim().toLowerCase() === expectedEmail.trim().toLowerCase();
}

async function apiErrorFromResponse(
  response: Response,
  fallbackMessage: string,
): Promise<ApiError | Error> {
  try {
    return new ApiError(response.status, await response.text());
  } catch {
    return new Error(fallbackMessage);
  }
}

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut, refreshUser } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { dateFormat, setDateFormat, formatDate } = useDateFormat();
  const { timezone, setTimezone, formatTime } = useTimezone();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Leave company state
  const [showLeaveCompanyModal, setShowLeaveCompanyModal] = useState(false);
  const [isLeavingCompany, setIsLeavingCompany] = useState(false);
  const [leaveCompanyError, setLeaveCompanyError] = useState<string | null>(null);

  const exportingRef = useRef(false);
  const exportSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deletingAccountRef = useRef(false);
  const leavingCompanyRef = useRef(false);
  const isCompanyOwner = Boolean(
    user?.companyId && (user.roleInCompany === 'owner' || user.role === 'owner'),
  );
  const companyOwnerExitBlockReason = isCompanyOwner
    ? 'Transfer company ownership before leaving the company or deleting this account.'
    : undefined;

  const showExportSuccess = useCallback(() => {
    if (exportSuccessTimeoutRef.current) {
      clearTimeout(exportSuccessTimeoutRef.current);
    }

    setExportSuccess(true);
    exportSuccessTimeoutRef.current = setTimeout(() => setExportSuccess(false), 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (exportSuccessTimeoutRef.current) {
        clearTimeout(exportSuccessTimeoutRef.current);
      }
    };
  }, []);

  // GDPR Data Export function
  const handleExportData = async () => {
    if (exportingRef.current) return;

    exportingRef.current = true;
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(false);

    try {
      const token = getAuthToken();
      if (!token) {
        setExportError('You must be logged in to export data');
        return;
      }

      const response = await authFetch('/api/auth/export-data', {
        method: 'GET',
      });

      if (!response.ok) {
        throw await apiErrorFromResponse(response, 'Failed to export data');
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (!contentType.includes('application/json')) {
        throw new Error('Export returned an unexpected file type. Please try again.');
      }

      const fallbackFilename = `siteproof-data-export-${formatDateKey()}.json`;
      const filename = sanitizeJsonExportFilename(
        getContentDispositionFilename(response.headers.get('Content-Disposition')),
        fallbackFilename,
      );

      const blob = await response.blob();
      downloadBlob(blob, filename, fallbackFilename);

      showExportSuccess();
    } catch (error) {
      logError('Export error:', error);
      setExportError(extractErrorMessage(error, 'Failed to export data. Please try again.'));
    } finally {
      exportingRef.current = false;
      setIsExporting(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deletingAccountRef.current) return;

    if (companyOwnerExitBlockReason) {
      setDeleteError(companyOwnerExitBlockReason);
      return;
    }

    if (!emailMatchesConfirmation(deleteConfirmEmail, user?.email)) {
      setDeleteError('Type your account email exactly to confirm deletion');
      return;
    }

    if (deletePasswordRequired && !deletePassword.trim()) {
      setDeleteError('Enter your password to delete this account');
      return;
    }

    deletingAccountRef.current = true;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiFetch('/api/auth/delete-account', {
        method: 'DELETE',
        body: JSON.stringify({
          confirmEmail: deleteConfirmEmail,
          password: deletePassword,
        }),
      });

      // Account deleted successfully - sign out and redirect
      await signOut();
      navigate('/login', { state: { message: 'Your account has been successfully deleted.' } });
    } catch (error) {
      logError('Delete account error:', error);
      setDeleteError(extractErrorMessage(error, 'Failed to delete account. Please try again.'));
    } finally {
      deletingAccountRef.current = false;
      setIsDeleting(false);
    }
  };

  const deletePasswordRequired = user?.hasPassword !== false;
  const deleteConfirmationMatches = emailMatchesConfirmation(deleteConfirmEmail, user?.email);
  const canDeleteAccount =
    deleteConfirmationMatches && (!deletePasswordRequired || deletePassword.trim().length > 0);

  const closeDeleteModal = () => {
    if (!isDeleting) {
      setShowDeleteModal(false);
      setDeleteConfirmEmail('');
      setDeletePassword('');
      setDeleteError(null);
    }
  };

  // Handle leaving company
  const handleLeaveCompany = async () => {
    if (leavingCompanyRef.current) return;

    if (companyOwnerExitBlockReason) {
      setLeaveCompanyError(companyOwnerExitBlockReason);
      return;
    }

    leavingCompanyRef.current = true;
    setIsLeavingCompany(true);
    setLeaveCompanyError(null);

    try {
      await apiFetch('/api/company/leave', {
        method: 'POST',
      });

      setShowLeaveCompanyModal(false);
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (error) {
      logError('Leave company error:', error);
      setLeaveCompanyError(
        extractErrorMessage(error, 'Failed to leave company. Please try again.'),
      );
    } finally {
      leavingCompanyRef.current = false;
      setIsLeavingCompany(false);
    }
  };

  const closeLeaveCompanyModal = () => {
    if (!isLeavingCompany) {
      setShowLeaveCompanyModal(false);
      setLeaveCompanyError(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and application settings.</p>
      </div>

      <AppearanceSection theme={theme} resolvedTheme={resolvedTheme} onThemeChange={setTheme} />

      <RegionalSettingsSection
        dateFormat={dateFormat}
        onDateFormatChange={setDateFormat}
        formatDate={formatDate}
        timezone={timezone}
        onTimezoneChange={setTimezone}
        formatTime={formatTime}
      />

      {/* Email Notification Settings */}
      <EmailPreferencesSection />

      {/* Push Notification Settings (Feature #657) */}
      <PushNotificationSettings />

      <MfaSettingsSection />

      <PrivacyDataSection
        isExporting={isExporting}
        exportSuccess={exportSuccess}
        exportError={exportError}
        onExportData={handleExportData}
        onDeleteAccountClick={() => setShowDeleteModal(true)}
        deleteAccountBlockedReason={companyOwnerExitBlockReason}
      />

      {/* Company Membership Section - only show if user has a company */}
      {user?.companyId && (
        <CompanyMembershipSection
          companyName={user.companyName}
          onLeaveCompanyClick={() => setShowLeaveCompanyModal(true)}
          leaveCompanyBlockedReason={companyOwnerExitBlockReason}
        />
      )}

      <AboutSection />

      <AccountDangerModals
        userEmail={user?.email}
        companyName={user?.companyName}
        showDeleteModal={showDeleteModal}
        deleteConfirmEmail={deleteConfirmEmail}
        deletePassword={deletePassword}
        isDeleting={isDeleting}
        deleteError={deleteError}
        deletePasswordRequired={deletePasswordRequired}
        deleteConfirmationMatches={deleteConfirmationMatches}
        canDeleteAccount={canDeleteAccount}
        showLeaveCompanyModal={showLeaveCompanyModal}
        isLeavingCompany={isLeavingCompany}
        leaveCompanyError={leaveCompanyError}
        onDeleteConfirmEmailChange={setDeleteConfirmEmail}
        onDeletePasswordChange={setDeletePassword}
        onDeleteModalClose={closeDeleteModal}
        onDeleteAccount={handleDeleteAccount}
        onLeaveCompanyModalClose={closeLeaveCompanyModal}
        onLeaveCompany={handleLeaveCompany}
      />
    </div>
  );
}
