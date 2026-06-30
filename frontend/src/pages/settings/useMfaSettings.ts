/**
 * State + handlers behind the Settings page's MFA/security section
 * (Features #22, #420, #421). Owns MFA status loading, the setup/verify and
 * disable flows, backup-code presentation, and the copy-secret affordance —
 * preserving the exact behavior the inline SettingsPage implementation had:
 *
 * - A synchronous `mfaActionRef` guard blocks duplicate setup/verify/disable
 *   submissions fired within the same tick (before `isMfaLoading` re-renders),
 *   so a double click still results in a single request.
 * - The setup and disable dialogs refuse to close while a request is in flight.
 * - The copied-secret indicator resets after 2 seconds; its timer is cleared
 *   on unmount.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';

export interface MfaMessage {
  type: 'success' | 'error';
  text: string;
}

export interface MfaSetupData {
  secret: string;
  qrCode: string;
}

export interface UseMfaSettingsResult {
  mfaEnabled: boolean;
  isLoadingMfa: boolean;
  mfaLoadError: string;
  mfaMessage: MfaMessage | null;
  showMfaSetup: boolean;
  mfaSetupData: MfaSetupData | null;
  mfaVerifyCode: string;
  isMfaLoading: boolean;
  backupCodes: string[];
  showBackupCodes: boolean;
  showDisableMfa: boolean;
  disableMfaCredential: string;
  showSecret: boolean;
  copiedSecret: boolean;
  loadMfaStatus: () => Promise<void>;
  handleMfaSetup: () => Promise<void>;
  handleMfaVerify: () => Promise<void>;
  handleMfaDisable: () => Promise<void>;
  copySecret: () => Promise<void>;
  closeMfaSetup: () => void;
  closeBackupCodes: () => void;
  copyBackupCodes: () => void;
  closeDisableMfa: () => void;
  openDisableMfa: () => void;
  toggleShowSecret: () => void;
  setMfaVerifyCode: (code: string) => void;
  setDisableMfaCredential: (credential: string) => void;
}

function buildDisableMfaPayload(credential: string) {
  const trimmedCredential = credential.trim();

  if (/^(?:\d{6}|[A-Za-z0-9]{10})$/.test(trimmedCredential)) {
    return { code: trimmedCredential };
  }

  return { password: credential };
}

export function useMfaSettings(): UseMfaSettingsResult {
  // MFA state (Feature #22, #420, #421)
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [isLoadingMfa, setIsLoadingMfa] = useState(true);
  const [mfaLoadError, setMfaLoadError] = useState('');
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupData | null>(null);
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [isMfaLoading, setIsMfaLoading] = useState(false);
  const [mfaMessage, setMfaMessage] = useState<MfaMessage | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [showDisableMfa, setShowDisableMfa] = useState(false);
  const [disableMfaCredential, setDisableMfaCredential] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const mfaActionRef = useRef(false);
  const copiedSecretTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedSecretTimeoutRef.current) {
        clearTimeout(copiedSecretTimeoutRef.current);
      }
    };
  }, []);

  const loadMfaStatus = useCallback(async () => {
    setIsLoadingMfa(true);
    setMfaLoadError('');

    try {
      const data = await apiFetch<{ mfaEnabled: boolean }>('/api/mfa/status');
      setMfaEnabled(data.mfaEnabled);
    } catch (err) {
      logError('Failed to load MFA status:', err);
      setMfaLoadError(extractErrorMessage(err, 'Failed to load security settings'));
    } finally {
      setIsLoadingMfa(false);
    }
  }, []);

  // Load MFA status (Feature #22)
  useEffect(() => {
    void loadMfaStatus();
  }, [loadMfaStatus]);

  // MFA setup handler (Feature #420)
  const handleMfaSetup = async () => {
    if (mfaActionRef.current) return;

    mfaActionRef.current = true;
    setIsMfaLoading(true);
    setMfaMessage(null);

    try {
      const data = await apiFetch<{ secret: string; qrCode: string; message?: string }>(
        '/api/mfa/setup',
        {
          method: 'POST',
        },
      );
      setMfaSetupData({ secret: data.secret, qrCode: data.qrCode });
      setShowMfaSetup(true);
    } catch (error) {
      setMfaMessage({
        type: 'error',
        text: extractErrorMessage(error, 'Failed to start MFA setup'),
      });
    } finally {
      mfaActionRef.current = false;
      setIsMfaLoading(false);
    }
  };

  // MFA verify setup handler (Feature #420)
  const handleMfaVerify = async () => {
    if (mfaActionRef.current) return;

    if (!mfaVerifyCode || mfaVerifyCode.length !== 6) {
      setMfaMessage({ type: 'error', text: 'Please enter a 6-digit code' });
      return;
    }

    mfaActionRef.current = true;
    setIsMfaLoading(true);
    setMfaMessage(null);

    try {
      const data = await apiFetch<{ backupCodes?: string[]; message?: string }>(
        '/api/mfa/verify-setup',
        {
          method: 'POST',
          body: JSON.stringify({ code: mfaVerifyCode }),
        },
      );
      setMfaEnabled(true);
      setBackupCodes(data.backupCodes || []);
      setShowBackupCodes(true);
      setShowMfaSetup(false);
      setMfaSetupData(null);
      setMfaVerifyCode('');
      setMfaMessage({ type: 'success', text: 'Two-factor authentication enabled!' });
    } catch (error) {
      setMfaMessage({ type: 'error', text: extractErrorMessage(error, 'Failed to verify code') });
    } finally {
      mfaActionRef.current = false;
      setIsMfaLoading(false);
    }
  };

  // MFA disable handler (Feature #22)
  const handleMfaDisable = async () => {
    if (mfaActionRef.current) return;

    if (!disableMfaCredential.trim()) {
      setMfaMessage({
        type: 'error',
        text: 'Enter your password, authenticator code, or backup code',
      });
      return;
    }

    mfaActionRef.current = true;
    setIsMfaLoading(true);
    setMfaMessage(null);

    try {
      await apiFetch('/api/mfa/disable', {
        method: 'POST',
        body: JSON.stringify(buildDisableMfaPayload(disableMfaCredential)),
      });
      setMfaEnabled(false);
      setShowDisableMfa(false);
      setDisableMfaCredential('');
      setMfaMessage({ type: 'success', text: 'Two-factor authentication disabled' });
    } catch (error) {
      setMfaMessage({ type: 'error', text: extractErrorMessage(error, 'Failed to disable MFA') });
    } finally {
      mfaActionRef.current = false;
      setIsMfaLoading(false);
    }
  };

  // Copy secret to clipboard
  const copySecret = async () => {
    if (mfaSetupData?.secret && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(mfaSetupData.secret);
        setMfaMessage(null);
      } catch (error) {
        setMfaMessage({
          type: 'error',
          text: extractErrorMessage(error, 'Could not copy the setup secret'),
        });
        return;
      }
      setCopiedSecret(true);
      if (copiedSecretTimeoutRef.current) {
        clearTimeout(copiedSecretTimeoutRef.current);
      }
      copiedSecretTimeoutRef.current = setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setMfaMessage({ type: 'error', text: 'Clipboard is not available in this browser' });
    }
  };

  const closeMfaSetup = useCallback(() => {
    if (!isMfaLoading) {
      setShowMfaSetup(false);
      setMfaSetupData(null);
      setMfaVerifyCode('');
      setMfaMessage(null);
    }
  }, [isMfaLoading]);

  const closeBackupCodes = useCallback(() => {
    setShowBackupCodes(false);
    setBackupCodes([]);
  }, []);

  const copyBackupCodes = useCallback(() => {
    void navigator.clipboard.writeText(backupCodes.join('\n'));
  }, [backupCodes]);

  const closeDisableMfa = useCallback(() => {
    if (!isMfaLoading) {
      setShowDisableMfa(false);
      setDisableMfaCredential('');
      setMfaMessage(null);
    }
  }, [isMfaLoading]);

  // These mirror the inline closures SettingsPage previously passed as props.
  const openDisableMfa = () => setShowDisableMfa(true);
  const toggleShowSecret = () => setShowSecret(!showSecret);

  return {
    mfaEnabled,
    isLoadingMfa,
    mfaLoadError,
    mfaMessage,
    showMfaSetup,
    mfaSetupData,
    mfaVerifyCode,
    isMfaLoading,
    backupCodes,
    showBackupCodes,
    showDisableMfa,
    disableMfaCredential,
    showSecret,
    copiedSecret,
    loadMfaStatus,
    handleMfaSetup,
    handleMfaVerify,
    handleMfaDisable,
    copySecret,
    closeMfaSetup,
    closeBackupCodes,
    copyBackupCodes,
    closeDisableMfa,
    openDisableMfa,
    toggleShowSecret,
    setMfaVerifyCode,
    setDisableMfaCredential,
  };
}
