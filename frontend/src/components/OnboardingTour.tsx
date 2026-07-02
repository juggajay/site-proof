import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { hasCommercialAccess } from '@/lib/roles';
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/lib/storagePreferences';
import { getCompanyRole } from '@/lib/subcontractorIdentity';

interface TourStep {
  title: string;
  content: string;
  target?: string; // CSS selector for element to highlight (optional)
  route?: string; // Route to navigate to for this step
  commercial?: boolean; // Uses commercial vocabulary (claims/costs) — hidden from non-commercial roles
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to CIVOS!',
    content:
      "CIVOS helps you manage construction quality, track lots, inspections, and maintain compliance. Let's take a quick tour of the key features.",
  },
  {
    title: 'Dashboard Overview',
    content:
      "The Dashboard gives you a quick overview of your project's status, including lot progress, recent activity, and outstanding items.",
    route: '/dashboard',
  },
  {
    title: 'Projects',
    content:
      'Manage multiple projects from the Projects page. Each project contains its own lots, ITPs, NCRs, and other quality data.',
    route: '/projects',
  },
  {
    title: 'Lot Register',
    content:
      'The Lot Register is the heart of CIVOS. Create and track work lots through their lifecycle from Not Started to Conformed and Claimed.',
  },
  {
    title: 'Quality Management',
    content:
      'Track Inspection & Test Plans (ITPs), Hold Points, Test Results, and Non-Conformance Reports (NCRs) to maintain quality standards.',
  },
  {
    title: 'Daily Diary & Dockets',
    content:
      'Record daily site activities, weather conditions, and manage docket approvals for work verification.',
  },
  {
    title: 'Progress Claims & Costs',
    content:
      'Track progress claims for conformed work and manage project costs with budget tracking and variance analysis.',
    commercial: true,
  },
  {
    title: 'Quick Search',
    content:
      'Press Cmd+K (or Ctrl+K) anytime to quickly search across lots, NCRs, and test results. Press ? for keyboard shortcuts.',
  },
  {
    title: "You're all set!",
    content:
      "That's the basics! Explore the sidebar navigation to access all features. You can replay this tour anytime — open the user menu in the top-right corner and choose Take the tour.",
  },
];

// The pre-revival tour persisted one device-wide marker under this key. The
// marker is now scoped per user so each account gets its own first-run, but
// the legacy key is still honoured as "completed" so devices that already
// finished (or suppressed) the original tour are never re-interrupted.
const LEGACY_ONBOARDING_STORAGE_KEY = 'siteproof_onboarding_completed';

export function onboardingStorageKey(userId: string | null | undefined): string {
  return userId ? `${LEGACY_ONBOARDING_STORAGE_KEY}:${userId}` : LEGACY_ONBOARDING_STORAGE_KEY;
}

function hasCompletedOnboarding(userId: string | null | undefined): boolean {
  return (
    readLocalStorageItem(onboardingStorageKey(userId)) === 'true' ||
    readLocalStorageItem(LEGACY_ONBOARDING_STORAGE_KEY) === 'true'
  );
}

// Record the account-level completion so the tour is never re-shown on another
// device or after local storage is cleared. Fire-and-forget: the per-device
// marker already covers the current session, and a failed call is retried the
// next time the tour opens. The server records the first completion only, so
// calling this on every open/dismiss is idempotent.
function persistOnboardingCompletedAt(): void {
  void apiFetch('/api/auth/onboarding/complete', { method: 'POST' }).catch(() => {
    // Best-effort telemetry-style write — never block or surface tour UI on it.
  });
}

// Replay trigger: dispatched by the header user menu ("Take the tour") and
// handled by the single OnboardingTour instance mounted in ProtectedAppShell.
export const ONBOARDING_TOUR_EVENT = 'siteproof:start-onboarding-tour';

export function startOnboardingTour(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ONBOARDING_TOUR_EVENT));
  }
}

interface OnboardingTourProps {
  /** Audience gate: whether this user may see the tour at all (auto-show and replay). */
  enabled?: boolean;
  /** First-run gate: auto-open once per user per device. Only honoured when `enabled`. */
  autoShow?: boolean;
  forceShow?: boolean; // For testing - force show the tour
  onComplete?: () => void;
}

export function OnboardingTour({
  enabled = true,
  autoShow = true,
  forceShow = false,
  onComplete,
}: OnboardingTourProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.id;
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Foremen (and other roles without commercial access) never see commercial
  // vocabulary, so the claims/costs step is filtered out of their tour.
  const steps = TOUR_STEPS.filter(
    (step) => !step.commercial || hasCommercialAccess(getCompanyRole(user)),
  );

  // Auto-show at most once per user per device: the seen marker is persisted
  // the moment the tour opens (not only on dismissal), so reloads, remounts,
  // and auth refreshes can never re-trigger it. That recurrence is the bug
  // that originally got the tour disabled outright (PR #203).
  useEffect(() => {
    if (!enabled && !forceShow) {
      setIsVisible(false);
      return;
    }

    if (forceShow) {
      setIsVisible(true);
      return;
    }

    if (!autoShow || hasCompletedOnboarding(userId) || Boolean(user?.onboardingCompletedAt)) {
      return;
    }

    // Small delay to let the page render first
    const timer = setTimeout(() => {
      writeLocalStorageItem(onboardingStorageKey(userId), 'true');
      persistOnboardingCompletedAt();
      setIsVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [enabled, autoShow, forceShow, userId, user?.onboardingCompletedAt]);

  // Replay: reopen from the first step when the header entry point fires.
  // Opening also re-persists the seen marker so an abandoned replay never
  // turns back into an auto-show on the next load.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleReplay = () => {
      writeLocalStorageItem(onboardingStorageKey(userId), 'true');
      setCurrentStep(0);
      setIsVisible(true);
    };
    window.addEventListener(ONBOARDING_TOUR_EVENT, handleReplay);
    return () => window.removeEventListener(ONBOARDING_TOUR_EVENT, handleReplay);
  }, [enabled, userId]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);

      // Navigate to the route if specified
      if (steps[nextStep].route && location.pathname !== steps[nextStep].route) {
        navigate(steps[nextStep].route);
      }
    } else {
      completeTour();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);

      // Navigate to the route if specified
      if (steps[prevStep].route && location.pathname !== steps[prevStep].route) {
        navigate(steps[prevStep].route);
      }
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  const completeTour = () => {
    writeLocalStorageItem(onboardingStorageKey(userId), 'true');
    persistOnboardingCompletedAt();
    setIsVisible(false);
    onComplete?.();
  };

  if (!isVisible) return null;

  const step = steps[currentStep];
  if (!step) return null;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="mx-4 w-full max-w-md rounded-xl border bg-card shadow-2xl">
        {/* Progress bar */}
        <div className="h-1 rounded-t-xl bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4">
          <span className="text-xs text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </span>
          <button
            onClick={handleSkip}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <h2 className="text-xl font-semibold mb-2">{step.title}</h2>
          <p className="text-muted-foreground">{step.content}</p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between border-t px-6 py-4">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex items-center gap-1 rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              {isLastStep ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Get Started
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-1 pb-4">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                index === currentStep
                  ? 'bg-primary'
                  : index < currentStep
                    ? 'bg-primary/50'
                    : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Hook for the replay entry point (header user menu): exposes whether the
// signed-in user has completed the tour, plus reset/mark helpers.
export function useOnboarding() {
  const { user } = useAuth();
  const userId = user?.id;
  const serverCompletedAt = user?.onboardingCompletedAt;
  const [completed, setCompleted] = useState(
    () => hasCompletedOnboarding(userId) || Boolean(serverCompletedAt),
  );

  useEffect(() => {
    setCompleted(hasCompletedOnboarding(userId) || Boolean(serverCompletedAt));
  }, [userId, serverCompletedAt]);

  const resetOnboarding = () => {
    // Local-only reset (for the replay entry point); the account-level marker is
    // intentionally not cleared here so a deliberate replay can't re-arm the
    // first-run auto-show on the next load.
    removeLocalStorageItem(onboardingStorageKey(userId));
    removeLocalStorageItem(LEGACY_ONBOARDING_STORAGE_KEY);
    setCompleted(false);
  };

  const markCompleted = () => {
    writeLocalStorageItem(onboardingStorageKey(userId), 'true');
    persistOnboardingCompletedAt();
    setCompleted(true);
  };

  return { completed, resetOnboarding, markCompleted };
}
