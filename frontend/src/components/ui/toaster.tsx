import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface Toast {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'success' | 'error' | 'warning'
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  // If not in context (standalone usage), create local state
  const [localToasts, setLocalToasts] = useState<Toast[]>([])

  if (context) {
    return {
      toast: (options: Omit<Toast, 'id'>) => context.addToast(options),
      toasts: context.toasts,
      dismiss: context.removeToast
    }
  }

  // Fallback for when ToastProvider is not available
  return {
    toast: (options: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substr(2, 9)
      setLocalToasts((prev) => [...prev, { ...options, id }])
      // Auto-dismiss after duration (default 5s)
      setTimeout(() => {
        setLocalToasts((prev) => prev.filter((t) => t.id !== id))
      }, options.duration || 5000)
    },
    toasts: localToasts,
    dismiss: (id: string) => setLocalToasts((prev) => prev.filter((t) => t.id !== id))
  }
}

// Global toast function for use outside of React components
let globalAddToast: ((toast: Omit<Toast, 'id'>) => void) | null = null

export function setGlobalToast(addToast: (toast: Omit<Toast, 'id'>) => void) {
  globalAddToast = addToast
}

export function toast(options: Omit<Toast, 'id'>) {
  if (globalAddToast) {
    globalAddToast(options)
  } else {
    console.log('Toast:', options)
  }
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss()
    }, toast.duration || 5000)
    return () => clearTimeout(timer)
  }, [toast.duration, onDismiss])

  const variantClasses = {
    default: 'bg-white border-gray-200 text-gray-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    error: 'bg-red-50 border-red-200 text-red-900',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  }

  const iconMap = {
    default: null,
    success: (
      <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    warning: (
      <svg className="h-5 w-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 shadow-lg transition-all duration-300 animate-in slide-in-from-right ${
        variantClasses[toast.variant || 'default']
      }`}
      role="alert"
    >
      {iconMap[toast.variant || 'default']}
      <div className="flex-1">
        {toast.title && <p className="font-semibold">{toast.title}</p>}
        {toast.description && (
          <p className={`text-sm ${toast.title ? 'mt-1 opacity-90' : ''}`}>{toast.description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    // Register global toast handler
    setGlobalToast((toast) => {
      const id = Math.random().toString(36).substr(2, 9)
      setToasts((prev) => [...prev, { ...toast, id }])
    })
    return () => setGlobalToast(() => {})
  }, [])

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  if (toasts.length === 0) return null

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-md" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
      ))}
    </div>,
    document.body
  )
}
