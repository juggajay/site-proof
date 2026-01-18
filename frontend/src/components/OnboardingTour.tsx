import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react'

interface TourStep {
  title: string
  content: string
  target?: string // CSS selector for element to highlight (optional)
  route?: string // Route to navigate to for this step
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to SiteProof!',
    content: 'SiteProof helps you manage construction quality, track lots, inspections, and maintain compliance. Let\'s take a quick tour of the key features.',
  },
  {
    title: 'Dashboard Overview',
    content: 'The Dashboard gives you a quick overview of your project\'s status, including lot progress, recent activity, and outstanding items.',
    route: '/dashboard',
  },
  {
    title: 'Projects',
    content: 'Manage multiple projects from the Projects page. Each project contains its own lots, ITPs, NCRs, and other quality data.',
    route: '/projects',
  },
  {
    title: 'Lot Register',
    content: 'The Lot Register is the heart of SiteProof. Create and track work lots through their lifecycle from Not Started to Conformed and Claimed.',
  },
  {
    title: 'Quality Management',
    content: 'Track Inspection & Test Plans (ITPs), Hold Points, Test Results, and Non-Conformance Reports (NCRs) to maintain quality standards.',
  },
  {
    title: 'Daily Diary & Dockets',
    content: 'Record daily site activities, weather conditions, and manage docket approvals for work verification.',
  },
  {
    title: 'Progress Claims & Costs',
    content: 'Track progress claims for conformed work and manage project costs with budget tracking and variance analysis.',
  },
  {
    title: 'Quick Search',
    content: 'Press Cmd+K (or Ctrl+K) anytime to quickly search across lots, NCRs, and test results. Press ? for keyboard shortcuts.',
  },
  {
    title: 'You\'re all set!',
    content: 'That\'s the basics! Explore the sidebar navigation to access all features. Click the help icon (?) on any page for context-specific guidance.',
  },
]

const ONBOARDING_STORAGE_KEY = 'siteproof_onboarding_completed'

interface OnboardingTourProps {
  forceShow?: boolean // For testing - force show the tour
  onComplete?: () => void
}

export function OnboardingTour({ forceShow = false, onComplete }: OnboardingTourProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isVisible, setIsVisible] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  // Check if user has completed onboarding
  useEffect(() => {
    if (forceShow) {
      setIsVisible(true)
      return
    }

    const completed = localStorage.getItem(ONBOARDING_STORAGE_KEY)
    if (!completed) {
      // Small delay to let the page render first
      const timer = setTimeout(() => setIsVisible(true), 500)
      return () => clearTimeout(timer)
    }
  }, [forceShow])

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      const nextStep = currentStep + 1
      setCurrentStep(nextStep)

      // Navigate to the route if specified
      if (TOUR_STEPS[nextStep].route && location.pathname !== TOUR_STEPS[nextStep].route) {
        navigate(TOUR_STEPS[nextStep].route)
      }
    } else {
      completeTour()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1
      setCurrentStep(prevStep)

      // Navigate to the route if specified
      if (TOUR_STEPS[prevStep].route && location.pathname !== TOUR_STEPS[prevStep].route) {
        navigate(TOUR_STEPS[prevStep].route)
      }
    }
  }

  const handleSkip = () => {
    completeTour()
  }

  const completeTour = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
    setIsVisible(false)
    onComplete?.()
  }

  if (!isVisible) return null

  const step = TOUR_STEPS[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === TOUR_STEPS.length - 1
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100

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
            Step {currentStep + 1} of {TOUR_STEPS.length}
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
          {TOUR_STEPS.map((_, index) => (
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
  )
}

// Hook to check onboarding status and reset for testing
export function useOnboarding() {
  const [completed, setCompleted] = useState(() => {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true'
  })

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_STORAGE_KEY)
    setCompleted(false)
  }

  const markCompleted = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
    setCompleted(true)
  }

  return { completed, resetOnboarding, markCompleted }
}
