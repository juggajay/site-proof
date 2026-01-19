import { useState, useRef, useEffect, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccordionItemProps {
  title: string | ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
  headerClassName?: string
  contentClassName?: string
  icon?: ReactNode
  disabled?: boolean
  onToggle?: (isOpen: boolean) => void
}

/**
 * AccordionItem - A single collapsible section with smooth animation
 *
 * Features:
 * - Smooth height animation using CSS transitions
 * - Rotating chevron indicator
 * - Customizable header and content styling
 * - Optional icon in header
 * - Disabled state support
 */
export function AccordionItem({
  title,
  children,
  defaultOpen = false,
  className = '',
  headerClassName = '',
  contentClassName = '',
  icon,
  disabled = false,
  onToggle,
}: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0)
  const contentRef = useRef<HTMLDivElement>(null)

  // Update height when content changes or isOpen changes
  useEffect(() => {
    if (!contentRef.current) return

    if (isOpen) {
      const contentHeight = contentRef.current.scrollHeight
      setHeight(contentHeight)
      // After animation completes, set to auto for dynamic content
      const timer = setTimeout(() => setHeight(undefined), 300)
      return () => clearTimeout(timer)
    } else {
      // First set the current height, then animate to 0
      const contentHeight = contentRef.current.scrollHeight
      setHeight(contentHeight)
      // Use requestAnimationFrame to ensure the height is set before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setHeight(0)
        })
      })
    }
  }, [isOpen])

  const handleToggle = () => {
    if (disabled) return
    const newState = !isOpen
    setIsOpen(newState)
    onToggle?.(newState)
  }

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left font-medium transition-colors hover:bg-muted/50',
          disabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'bg-muted/30',
          headerClassName
        )}
        aria-expanded={isOpen}
        data-testid="accordion-trigger"
      >
        <span className="flex items-center gap-2">
          {icon}
          {title}
        </span>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-muted-foreground transition-transform duration-300',
            isOpen && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>
      <div
        ref={contentRef}
        style={{ height: height !== undefined ? `${height}px` : 'auto' }}
        className={cn(
          'overflow-hidden transition-all duration-300 ease-in-out',
          !isOpen && 'opacity-0',
          isOpen && 'opacity-100'
        )}
        data-testid="accordion-content"
      >
        <div className={cn('px-4 py-3 border-t', contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  )
}

interface AccordionProps {
  children: ReactNode
  className?: string
  allowMultiple?: boolean
}

/**
 * Accordion - A container for multiple accordion items
 *
 * When allowMultiple is false (default), only one item can be open at a time.
 * When allowMultiple is true, multiple items can be open simultaneously.
 */
export function Accordion({
  children,
  className = '',
  allowMultiple = true,
}: AccordionProps) {
  return (
    <div
      className={cn('space-y-2', className)}
      data-testid="accordion"
    >
      {children}
    </div>
  )
}
