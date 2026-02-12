import { toast as sonnerToast, Toaster as SonnerToaster } from 'sonner'

/**
 * Toaster component — drop-in replacement for custom portal-based toaster.
 * Renders via <Toaster /> in App.tsx (same import path).
 */
export function Toaster() {
  return <SonnerToaster position="bottom-right" richColors closeButton />
}

interface ToastOptions {
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'error' | 'warning'
  duration?: number
}

/**
 * Backward-compatible toast() API — all 34 call sites work without changes.
 * Maps variant to sonner's typed methods.
 */
export function toast(options: ToastOptions) {
  const message = options.title || options.description || ''
  const opts = {
    description: options.title ? options.description : undefined,
    duration: options.duration,
  }
  switch (options.variant) {
    case 'success':
      return sonnerToast.success(message, opts)
    case 'error':
      return sonnerToast.error(message, opts)
    case 'warning':
      return sonnerToast.warning(message, opts)
    default:
      return sonnerToast(message, opts)
  }
}

/**
 * useToast — backward-compatible hook export (currently unused but prevents import errors).
 */
export function useToast() {
  return { toast }
}

// Re-export for any code that may import these
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function setGlobalToast(_addToast: (toast: ToastOptions) => void) {
  // No-op — sonner manages its own state globally
}
