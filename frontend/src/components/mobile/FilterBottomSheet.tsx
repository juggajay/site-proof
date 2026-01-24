/**
 * FilterBottomSheet - Industrial-grade filter drawer for construction app mobile UI
 *
 * Design: High contrast, glove-friendly 48px+ touch targets, rugged utilitarian aesthetic
 * Features: Bottom sheet with drag handle, multiple filter types, pill-based multiselect
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Filter, ChevronDown, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FilterOption {
  value: string
  label: string
  count?: number
}

export interface SelectFilter {
  type: 'select'
  id: string
  label: string
  options: FilterOption[]
  value: string | null
}

export interface MultiselectFilter {
  type: 'multiselect'
  id: string
  label: string
  options: FilterOption[]
  value: string[]
}

export interface RangeFilter {
  type: 'range'
  id: string
  label: string
  min: number
  max: number
  step?: number
  value: { min: number; max: number }
  formatValue?: (value: number) => string
}

export interface DateFilter {
  type: 'date'
  id: string
  label: string
  value: { start: string | null; end: string | null }
  minDate?: string
  maxDate?: string
}

export type FilterConfig = SelectFilter | MultiselectFilter | RangeFilter | DateFilter

export type FilterValues = {
  [key: string]: string | null | string[] | { min: number; max: number } | { start: string | null; end: string | null }
}

export interface FilterBottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  filters: FilterConfig[]
  values: FilterValues
  onChange: (values: FilterValues) => void
  onApply: (values: FilterValues) => void
  onClear: () => void
}

export interface FilterTriggerButtonProps {
  onClick: () => void
  activeCount: number
  label?: string
  className?: string
}

// ============================================================================
// FILTER TRIGGER BUTTON
// ============================================================================

export function FilterTriggerButton({
  onClick,
  activeCount,
  label = 'Filter',
  className,
}: FilterTriggerButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        // Base styles - industrial, high contrast
        'relative inline-flex items-center justify-center gap-2',
        'min-h-[48px] px-4 py-3 rounded-lg',
        'bg-slate-800 dark:bg-slate-700 text-white',
        'font-semibold text-sm uppercase tracking-wide',
        'border-2 border-slate-600 dark:border-slate-500',
        'shadow-md',
        // Touch optimization
        'touch-manipulation select-none',
        // Active/hover states
        'active:scale-[0.98] active:bg-slate-700 dark:active:bg-slate-600',
        'transition-all duration-100',
        // Focus state for accessibility
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
        className
      )}
      aria-label={`${label}${activeCount > 0 ? `, ${activeCount} active` : ''}`}
    >
      <Filter className="h-5 w-5" aria-hidden="true" />
      <span>{label}</span>

      {/* Active count badge */}
      {activeCount > 0 && (
        <span
          className={cn(
            'absolute -top-2 -right-2',
            'flex items-center justify-center',
            'min-w-[24px] h-6 px-1.5 rounded-full',
            'bg-amber-500 text-slate-900',
            'text-xs font-bold',
            'border-2 border-white dark:border-slate-800'
          )}
          aria-hidden="true"
        >
          {activeCount > 99 ? '99+' : activeCount}
        </span>
      )}
    </button>
  )
}

// ============================================================================
// FILTER COMPONENTS
// ============================================================================

interface SelectFilterComponentProps {
  filter: SelectFilter
  value: string | null
  onChange: (value: string | null) => void
}

function SelectFilterComponent({ filter, value, onChange }: SelectFilterComponentProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        {filter.label}
      </label>
      <div className="relative">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={cn(
            'w-full min-h-[48px] px-4 py-3 pr-10',
            'bg-white dark:bg-slate-800',
            'border-2 border-slate-300 dark:border-slate-600',
            'rounded-lg text-base font-medium',
            'appearance-none cursor-pointer',
            'touch-manipulation',
            'focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
            'transition-colors duration-100'
          )}
        >
          <option value="">All</option>
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {option.count !== undefined && ` (${option.count})`}
            </option>
          ))}
        </select>
        <ChevronDown
          className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 pointer-events-none"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

interface MultiselectFilterComponentProps {
  filter: MultiselectFilter
  value: string[]
  onChange: (value: string[]) => void
}

function MultiselectFilterComponent({ filter, value, onChange }: MultiselectFilterComponentProps) {
  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        {filter.label}
      </label>
      <div className="flex flex-wrap gap-2">
        {filter.options.map((option) => {
          const isSelected = value.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleOption(option.value)}
              className={cn(
                // Base styles - pill/chip design
                'inline-flex items-center gap-1.5',
                'min-h-[48px] px-4 py-2 rounded-full',
                'text-sm font-semibold',
                'border-2',
                'touch-manipulation select-none',
                'transition-all duration-100',
                'active:scale-[0.97]',
                // Selected state
                isSelected
                  ? 'bg-amber-500 border-amber-600 text-slate-900'
                  : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300',
                // Focus state
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2'
              )}
              aria-pressed={isSelected}
            >
              {option.label}
              {option.count !== undefined && (
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full',
                    isSelected
                      ? 'bg-amber-600 text-amber-100'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  )}
                >
                  {option.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface RangeFilterComponentProps {
  filter: RangeFilter
  value: { min: number; max: number }
  onChange: (value: { min: number; max: number }) => void
}

function RangeFilterComponent({ filter, value, onChange }: RangeFilterComponentProps) {
  const formatValue = filter.formatValue || ((v: number) => v.toString())
  const step = filter.step || 1

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          {filter.label}
        </label>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          {formatValue(value.min)} - {formatValue(value.max)}
        </span>
      </div>

      {/* Dual range inputs styled as industrial sliders */}
      <div className="space-y-4">
        <div className="space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Min</span>
          <input
            type="range"
            min={filter.min}
            max={filter.max}
            step={step}
            value={value.min}
            onChange={(e) => {
              const newMin = Number(e.target.value)
              if (newMin <= value.max) {
                onChange({ ...value, min: newMin })
              }
            }}
            className={cn(
              'w-full h-12 cursor-pointer touch-manipulation',
              'appearance-none bg-transparent',
              // Track styles
              '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full',
              '[&::-webkit-slider-runnable-track]:bg-slate-300 dark:[&::-webkit-slider-runnable-track]:bg-slate-600',
              // Thumb styles - large for glove use
              '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-8',
              '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500',
              '[&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-amber-600',
              '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:-mt-2.5',
              // Firefox styles
              '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full',
              '[&::-moz-range-track]:bg-slate-300 dark:[&::-moz-range-track]:bg-slate-600',
              '[&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:w-8 [&::-moz-range-thumb]:rounded-full',
              '[&::-moz-range-thumb]:bg-amber-500 [&::-moz-range-thumb]:border-4',
              '[&::-moz-range-thumb]:border-amber-600'
            )}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Max</span>
          <input
            type="range"
            min={filter.min}
            max={filter.max}
            step={step}
            value={value.max}
            onChange={(e) => {
              const newMax = Number(e.target.value)
              if (newMax >= value.min) {
                onChange({ ...value, max: newMax })
              }
            }}
            className={cn(
              'w-full h-12 cursor-pointer touch-manipulation',
              'appearance-none bg-transparent',
              // Track styles
              '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full',
              '[&::-webkit-slider-runnable-track]:bg-slate-300 dark:[&::-webkit-slider-runnable-track]:bg-slate-600',
              // Thumb styles - large for glove use
              '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-8',
              '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-500',
              '[&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-amber-600',
              '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:-mt-2.5',
              // Firefox styles
              '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full',
              '[&::-moz-range-track]:bg-slate-300 dark:[&::-moz-range-track]:bg-slate-600',
              '[&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:w-8 [&::-moz-range-thumb]:rounded-full',
              '[&::-moz-range-thumb]:bg-amber-500 [&::-moz-range-thumb]:border-4',
              '[&::-moz-range-thumb]:border-amber-600'
            )}
          />
        </div>
      </div>
    </div>
  )
}

interface DateFilterComponentProps {
  filter: DateFilter
  value: { start: string | null; end: string | null }
  onChange: (value: { start: string | null; end: string | null }) => void
}

function DateFilterComponent({ filter, value, onChange }: DateFilterComponentProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        {filter.label}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            From
          </span>
          <input
            type="date"
            value={value.start || ''}
            min={filter.minDate}
            max={value.end || filter.maxDate}
            onChange={(e) => onChange({ ...value, start: e.target.value || null })}
            className={cn(
              'w-full min-h-[48px] px-3 py-2',
              'bg-white dark:bg-slate-800',
              'border-2 border-slate-300 dark:border-slate-600',
              'rounded-lg text-base font-medium',
              'touch-manipulation',
              'focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
              'transition-colors duration-100'
            )}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Calendar className="h-3 w-3" aria-hidden="true" />
            To
          </span>
          <input
            type="date"
            value={value.end || ''}
            min={value.start || filter.minDate}
            max={filter.maxDate}
            onChange={(e) => onChange({ ...value, end: e.target.value || null })}
            className={cn(
              'w-full min-h-[48px] px-3 py-2',
              'bg-white dark:bg-slate-800',
              'border-2 border-slate-300 dark:border-slate-600',
              'rounded-lg text-base font-medium',
              'touch-manipulation',
              'focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20',
              'transition-colors duration-100'
            )}
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN FILTER BOTTOM SHEET COMPONENT
// ============================================================================

export function FilterBottomSheet({
  isOpen,
  onClose,
  title = 'Filters',
  filters,
  values,
  onChange,
  onApply,
  onClear,
}: FilterBottomSheetProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartRef = useRef<{ y: number; time: number } | null>(null)
  const isDraggingRef = useRef(false)

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
      // Small delay to ensure CSS transition works
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
    } else {
      setIsAnimating(false)
      const timer = setTimeout(() => {
        setIsVisible(false)
        setDragOffset(0)
      }, 300) // Match transition duration
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Lock body scroll when open
  useEffect(() => {
    if (isVisible) {
      const originalOverflow = document.body.style.overflow
      const originalPosition = document.body.style.position
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.width = '100%'
      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.position = originalPosition
        document.body.style.width = ''
      }
    }
  }, [isVisible])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Drag handlers for swipe-to-dismiss
  const handleDragStart = useCallback((clientY: number) => {
    dragStartRef.current = { y: clientY, time: Date.now() }
    isDraggingRef.current = true
  }, [])

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDraggingRef.current || !dragStartRef.current) return
    const diff = clientY - dragStartRef.current.y
    // Only allow dragging down
    if (diff > 0) {
      setDragOffset(diff)
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current || !dragStartRef.current) return

    const diff = dragOffset
    const timeDiff = Date.now() - dragStartRef.current.time
    const velocity = diff / timeDiff

    // Close if dragged more than 100px or with high velocity
    if (diff > 100 || velocity > 0.5) {
      onClose()
    }

    setDragOffset(0)
    dragStartRef.current = null
    isDraggingRef.current = false
  }, [dragOffset, onClose])

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY)
  }

  const handleTouchEnd = () => {
    handleDragEnd()
  }

  // Mouse event handlers (for testing on desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientY)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      handleDragMove(e.clientY)
    }
  }

  const handleMouseUp = () => {
    handleDragEnd()
  }

  // Update a single filter value
  const handleFilterChange = (filterId: string, newValue: FilterValues[string]) => {
    onChange({
      ...values,
      [filterId]: newValue,
    })
  }

  // Count active filters
  const getActiveFilterCount = (): number => {
    return filters.reduce((count, filter) => {
      const val = values[filter.id]
      if (filter.type === 'select' && val !== null && val !== '') {
        return count + 1
      }
      if (filter.type === 'multiselect' && Array.isArray(val) && val.length > 0) {
        return count + 1
      }
      if (filter.type === 'range') {
        const rangeVal = val as { min: number; max: number }
        if (rangeVal && (rangeVal.min !== filter.min || rangeVal.max !== filter.max)) {
          return count + 1
        }
      }
      if (filter.type === 'date') {
        const dateVal = val as { start: string | null; end: string | null }
        if (dateVal && (dateVal.start || dateVal.end)) {
          return count + 1
        }
      }
      return count
    }, 0)
  }

  const activeCount = getActiveFilterCount()

  if (!isVisible) return null

  const sheetContent = (
    <div
      className={cn(
        'fixed inset-0 z-50 md:hidden',
        'transition-colors duration-300',
        isAnimating && dragOffset === 0 ? 'bg-black/60' : 'bg-black/0'
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      role="dialog"
      aria-modal="true"
      aria-labelledby="filter-sheet-title"
    >
      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'absolute bottom-0 left-0 right-0',
          'bg-slate-50 dark:bg-slate-900',
          'rounded-t-2xl shadow-2xl',
          'max-h-[85vh] flex flex-col',
          'transition-transform duration-300 ease-out',
          !isDraggingRef.current && 'transition-transform'
        )}
        style={{
          transform: isAnimating
            ? `translateY(${dragOffset}px)`
            : 'translateY(100%)',
        }}
      >
        {/* Drag Handle */}
        <div
          className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-manipulation"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={handleMouseDown}
          role="slider"
          aria-label="Drag to dismiss"
          tabIndex={0}
        >
          <div className="w-12 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b-2 border-slate-200 dark:border-slate-700">
          <h2
            id="filter-sheet-title"
            className="text-xl font-bold text-slate-900 dark:text-white"
          >
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={onClear}
                className={cn(
                  'min-h-[44px] px-3 py-2 rounded-lg',
                  'text-sm font-semibold text-amber-600 dark:text-amber-400',
                  'hover:bg-amber-100 dark:hover:bg-amber-900/30',
                  'active:scale-[0.98]',
                  'touch-manipulation transition-all duration-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
                )}
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className={cn(
                'flex items-center justify-center',
                'min-h-[48px] min-w-[48px] rounded-lg',
                'bg-slate-200 dark:bg-slate-700',
                'text-slate-600 dark:text-slate-300',
                'hover:bg-slate-300 dark:hover:bg-slate-600',
                'active:scale-[0.98]',
                'touch-manipulation transition-all duration-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500'
              )}
              aria-label="Close filters"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Filter Content - Scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-6">
          {filters.map((filter) => {
            const key = filter.id
            switch (filter.type) {
              case 'select':
                return (
                  <SelectFilterComponent
                    key={key}
                    filter={filter}
                    value={values[filter.id] as string | null}
                    onChange={(val) => handleFilterChange(filter.id, val)}
                  />
                )
              case 'multiselect':
                return (
                  <MultiselectFilterComponent
                    key={key}
                    filter={filter}
                    value={(values[filter.id] as string[]) || []}
                    onChange={(val) => handleFilterChange(filter.id, val)}
                  />
                )
              case 'range':
                return (
                  <RangeFilterComponent
                    key={key}
                    filter={filter}
                    value={(values[filter.id] as { min: number; max: number }) || { min: filter.min, max: filter.max }}
                    onChange={(val) => handleFilterChange(filter.id, val)}
                  />
                )
              case 'date':
                return (
                  <DateFilterComponent
                    key={key}
                    filter={filter}
                    value={(values[filter.id] as { start: string | null; end: string | null }) || { start: null, end: null }}
                    onChange={(val) => handleFilterChange(filter.id, val)}
                  />
                )
              default:
                return null
            }
          })}
        </div>

        {/* Footer with Apply Button */}
        <div className="p-4 border-t-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pb-safe">
          <button
            onClick={() => onApply(values)}
            className={cn(
              'w-full min-h-[56px] px-6 py-4 rounded-xl',
              'bg-amber-500 hover:bg-amber-600 active:bg-amber-700',
              'text-slate-900 font-bold text-lg uppercase tracking-wide',
              'shadow-lg shadow-amber-500/30',
              'active:scale-[0.98]',
              'touch-manipulation transition-all duration-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2'
            )}
          >
            Apply Filters
            {activeCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-slate-900/20 text-sm">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(sheetContent, document.body)
}

// ============================================================================
// HOOK FOR EASY FILTER STATE MANAGEMENT
// ============================================================================

export interface UseFilterSheetOptions {
  filters: FilterConfig[]
  initialValues?: FilterValues
  onApply?: (values: FilterValues) => void
}

export function useFilterSheet({ filters, initialValues, onApply }: UseFilterSheetOptions) {
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState<FilterValues>(() => {
    if (initialValues) return initialValues
    // Initialize with default values
    return filters.reduce<FilterValues>((acc, filter) => {
      switch (filter.type) {
        case 'select':
          acc[filter.id] = filter.value
          break
        case 'multiselect':
          acc[filter.id] = filter.value
          break
        case 'range':
          acc[filter.id] = filter.value
          break
        case 'date':
          acc[filter.id] = filter.value
          break
      }
      return acc
    }, {})
  })

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const handleApply = useCallback((newValues: FilterValues) => {
    setValues(newValues)
    setIsOpen(false)
    onApply?.(newValues)
  }, [onApply])

  const handleClear = useCallback(() => {
    const clearedValues = filters.reduce<FilterValues>((acc, filter) => {
      switch (filter.type) {
        case 'select':
          acc[filter.id] = null
          break
        case 'multiselect':
          acc[filter.id] = []
          break
        case 'range':
          acc[filter.id] = { min: filter.min, max: filter.max }
          break
        case 'date':
          acc[filter.id] = { start: null, end: null }
          break
      }
      return acc
    }, {})
    setValues(clearedValues)
  }, [filters])

  const activeCount = filters.reduce((count, filter) => {
    const val = values[filter.id]
    if (filter.type === 'select' && val !== null && val !== '') {
      return count + 1
    }
    if (filter.type === 'multiselect' && Array.isArray(val) && val.length > 0) {
      return count + 1
    }
    if (filter.type === 'range') {
      const rangeVal = val as { min: number; max: number }
      if (rangeVal && (rangeVal.min !== filter.min || rangeVal.max !== filter.max)) {
        return count + 1
      }
    }
    if (filter.type === 'date') {
      const dateVal = val as { start: string | null; end: string | null }
      if (dateVal && (dateVal.start || dateVal.end)) {
        return count + 1
      }
    }
    return count
  }, 0)

  return {
    isOpen,
    open,
    close,
    values,
    setValues,
    handleApply,
    handleClear,
    activeCount,
  }
}

export default FilterBottomSheet
