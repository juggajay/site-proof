// Feature #777: Cookie consent banner
import { useState, useEffect } from 'react'
import { Cookie, X } from 'lucide-react'
import { Link } from 'react-router-dom'

const CONSENT_KEY = 'cookie_consent'
const CONSENT_VERSION = 'v1' // Bump this to re-ask for consent after policy updates

interface ConsentState {
  version: string
  accepted: boolean
  timestamp: string
}

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    // Check if consent has already been given
    const consentData = localStorage.getItem(CONSENT_KEY)

    if (!consentData) {
      // First visit - show banner
      setShowBanner(true)
      return
    }

    try {
      const consent: ConsentState = JSON.parse(consentData)
      // If consent version is outdated, show banner again
      if (consent.version !== CONSENT_VERSION) {
        setShowBanner(true)
      }
    } catch {
      // Invalid consent data - show banner
      setShowBanner(true)
    }
  }, [])

  const saveConsent = (accepted: boolean) => {
    const consent: ConsentState = {
      version: CONSENT_VERSION,
      accepted,
      timestamp: new Date().toISOString()
    }
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    setShowBanner(false)
  }

  const handleAccept = () => {
    saveConsent(true)
  }

  const handleReject = () => {
    saveConsent(false)
  }

  if (!showBanner) {
    return null
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg"
      role="dialog"
      aria-label="Cookie consent"
      data-testid="cookie-consent-banner"
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1">
          <Cookie className="h-6 w-6 text-orange-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              We use cookies to enhance your experience and analyze site usage.
              By continuing to use SiteProof, you agree to our{' '}
              <Link
                to="/privacy-policy"
                className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
          <button
            onClick={handleReject}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            data-testid="cookie-reject-button"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors"
            data-testid="cookie-accept-button"
          >
            Accept
          </button>
          <button
            onClick={handleReject}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded sm:hidden"
            aria-label="Close cookie banner"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook to check consent status
export function useCookieConsent() {
  const [consent, setConsent] = useState<ConsentState | null>(null)

  useEffect(() => {
    const consentData = localStorage.getItem(CONSENT_KEY)
    if (consentData) {
      try {
        setConsent(JSON.parse(consentData))
      } catch {
        setConsent(null)
      }
    }
  }, [])

  return {
    hasConsent: consent !== null,
    accepted: consent?.accepted ?? false,
    timestamp: consent?.timestamp,
    clearConsent: () => {
      localStorage.removeItem(CONSENT_KEY)
      setConsent(null)
    }
  }
}
