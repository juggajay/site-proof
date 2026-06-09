import { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { logError } from '@/lib/logger';
import { readSessionStorageItem, writeSessionStorageItem } from '@/lib/storagePreferences';

// Session-scoped so the nudge stays out of the way for the rest of the
// sign-in but quietly returns next time, until the account is verified.
const DISMISS_KEY = 'email_verification_banner_dismissed';

type ResendState = 'idle' | 'sending' | 'sent' | 'error';

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() => readSessionStorageItem(DISMISS_KEY) === 'true');
  const [resendState, setResendState] = useState<ResendState>('idle');

  // Only nudge signed-in users whose address is confirmed-not-verified.
  // `undefined` (older cached sessions without the field) is treated as
  // verified so we never show a false alarm.
  if (!user || user.emailVerified !== false || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    writeSessionStorageItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  const handleResend = async () => {
    if (resendState === 'sending' || resendState === 'sent') {
      return;
    }
    setResendState('sending');
    try {
      await apiFetch('/api/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email: user.email }),
      });
      setResendState('sent');
    } catch (err) {
      logError('Failed to resend verification email:', err);
      setResendState('error');
    }
  };

  return (
    <div
      className="mb-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-warning-foreground"
      role="status"
      data-testid="email-verification-banner"
    >
      <Mail className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Verify your email</p>
        <p className="text-sm">
          {resendState === 'sent'
            ? `We've sent a fresh verification link to ${user.email}. Check your inbox (and spam folder).`
            : 'Confirm your email address so you don’t miss important notifications.'}
        </p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-2">
        {resendState !== 'sent' && (
          <button
            type="button"
            onClick={handleResend}
            disabled={resendState === 'sending'}
            className="rounded-md border border-warning/30 bg-card px-3 py-1.5 text-xs font-medium text-warning-foreground transition-colors hover:bg-warning/10 disabled:opacity-50"
          >
            {resendState === 'sending'
              ? 'Sending…'
              : resendState === 'error'
                ? 'Try again'
                : 'Resend link'}
          </button>
        )}
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded p-1 hover:bg-warning/10"
          aria-label="Dismiss verification reminder"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
