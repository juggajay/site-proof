// Feature #777: Cookie consent banner
import { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  isRecord,
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/lib/storagePreferences';
import { useAuth } from '@/lib/auth';
import { recordCookiePolicyConsentDecision } from '@/lib/consentAudit';
import { cn } from '@/lib/utils';

const CONSENT_KEY = 'cookie_consent';
const CONSENT_VERSION = 'v1'; // Bump this to re-ask for consent after policy updates

interface ConsentState {
  version: string;
  accepted: boolean;
  timestamp: string;
}

function isConsentState(value: unknown): value is ConsentState {
  return (
    isRecord(value) &&
    typeof value.version === 'string' &&
    typeof value.accepted === 'boolean' &&
    typeof value.timestamp === 'string'
  );
}

function readStoredConsent(): ConsentState | null {
  const consentData = readLocalStorageItem(CONSENT_KEY);
  if (!consentData) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(consentData);
    return isConsentState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasCurrentConsent(consent: ConsentState | null): boolean {
  return consent?.version === CONSENT_VERSION;
}

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setShowBanner(!hasCurrentConsent(readStoredConsent()));
  }, []);

  const saveConsent = (accepted: boolean) => {
    const consent: ConsentState = {
      version: CONSENT_VERSION,
      accepted,
      timestamp: new Date().toISOString(),
    };
    writeLocalStorageItem(CONSENT_KEY, JSON.stringify(consent));
    setShowBanner(false);

    if (user) {
      void recordCookiePolicyConsentDecision(accepted);
    }
  };

  const handleAccept = () => {
    saveConsent(true);
  };

  const handleReject = () => {
    saveConsent(false);
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-40 bg-card border-t border-border px-3 py-2 shadow-lg sm:p-4',
        user ? 'bottom-16 md:bottom-0' : 'bottom-0',
      )}
      role="dialog"
      aria-label="Cookie consent"
      data-testid="cookie-consent-banner"
    >
      <div className="mx-auto flex max-w-4xl items-start gap-3 sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
          <Cookie className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground sm:h-6 sm:w-6" />
          <div>
            <p className="text-xs leading-snug text-foreground sm:hidden">
              We use cookies to improve CIVOS. See our{' '}
              <Link to="/privacy-policy" className="font-medium text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
            <p className="hidden text-sm text-foreground sm:block">
              We use cookies to enhance your experience and analyze site usage. By continuing to use
              CIVOS, you agree to our{' '}
              <Link to="/privacy-policy" className="text-primary hover:underline font-medium">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleReject}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 sm:px-4 sm:py-2 sm:text-sm"
            data-testid="cookie-reject-button"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:px-4 sm:py-2 sm:text-sm"
            data-testid="cookie-accept-button"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            className="p-1 hover:bg-muted rounded sm:hidden"
            aria-label="Close cookie banner"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Hook to check consent status
export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState | null>(null);

  useEffect(() => {
    const storedConsent = readStoredConsent();
    setConsent(hasCurrentConsent(storedConsent) ? storedConsent : null);
  }, []);

  return {
    hasConsent: consent !== null,
    accepted: consent?.accepted ?? false,
    timestamp: consent?.timestamp,
    clearConsent: () => {
      removeLocalStorageItem(CONSENT_KEY);
      setConsent(null);
    },
  };
}
