import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  children: ReactNode
  onClose?: () => void
  className?: string
}

/**
 * Modal component with proper overlay styling
 * - Uses React Portal to render at document body level
 * - Semi-transparent backdrop overlay (bg-black/50)
 * - Centered modal with shadow effect
 * - Prevents body scroll when open
 * - Closes on backdrop click (optional)
 * - Closes on Escape key (optional)
 */
export function Modal({ children, onClose, className = '' }: ModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Trigger entrance animation on mount
  useEffect(() => {
    // Small delay to ensure CSS transition works
    requestAnimationFrame(() => {
      setIsVisible(true)
    })
  }, [])

  // Handle close with animation
  const handleClose = () => {
    if (onClose) {
      setIsClosing(true)
      // Wait for animation to complete before calling onClose
      setTimeout(() => {
        onClose()
      }, 200) // Match transition duration
    }
  }

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        handleClose()
      }
    }
    document.addEventListener('keydown', handleEscapeKey)
    return () => document.removeEventListener('keydown', handleEscapeKey)
  }, [onClose])

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onClose) {
      handleClose()
    }
  }

  // Determine animation state
  const shouldShow = isVisible && !isClosing

  const modalContent = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${
        shouldShow ? 'bg-black/50' : 'bg-black/0'
      }`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`bg-white rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto transition-all duration-200 ${
          shouldShow
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 -translate-y-4'
        } ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )

  // Use portal to render at document body level
  return createPortal(modalContent, document.body)
}

/**
 * ModalHeader component for consistent modal headers
 */
export function ModalHeader({
  children,
  onClose
}: {
  children: ReactNode
  onClose?: () => void
}) {
  return (
    <div className="flex items-center justify-between p-6 pb-0">
      <h2 className="text-xl font-bold">{children}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  )
}

/**
 * ModalBody component for consistent modal content area
 */
export function ModalBody({ children }: { children: ReactNode }) {
  return <div className="p-6">{children}</div>
}

/**
 * ModalFooter component for consistent modal footer with actions
 */
export function ModalFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end gap-3 p-6 pt-0">
      {children}
    </div>
  )
}
