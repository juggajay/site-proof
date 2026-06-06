/**
 * FilterBottomSheet - Industrial-grade filter drawer for construction app mobile UI
 *
 * Design: High contrast, glove-friendly 48px+ touch targets, rugged utilitarian aesthetic
 * Features: Bottom sheet with drag handle, multiple filter types, pill-based multiselect
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SelectFilterComponent,
  MultiselectFilterComponent,
  RangeFilterComponent,
  DateFilterComponent,
} from './filterControls';
import {
  buildClearedFilterValues,
  buildInitialFilterValues,
  countActiveFilters,
} from './filterSheetHelpers';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface SelectFilter {
  type: 'select';
  id: string;
  label: string;
  options: FilterOption[];
  value: string | null;
}

export interface MultiselectFilter {
  type: 'multiselect';
  id: string;
  label: string;
  options: FilterOption[];
  value: string[];
}

export interface RangeFilter {
  type: 'range';
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  value: { min: number; max: number };
  formatValue?: (value: number) => string;
}

export interface DateFilter {
  type: 'date';
  id: string;
  label: string;
  value: { start: string | null; end: string | null };
  minDate?: string;
  maxDate?: string;
}

export type FilterConfig = SelectFilter | MultiselectFilter | RangeFilter | DateFilter;

export type FilterValues = {
  [key: string]:
    | string
    | null
    | string[]
    | { min: number; max: number }
    | { start: string | null; end: string | null };
};

export interface FilterBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  filters: FilterConfig[];
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  onApply: (values: FilterValues) => void;
  onClear: () => void;
}

export interface FilterTriggerButtonProps {
  onClick: () => void;
  activeCount: number;
  label?: string;
  className?: string;
}

// ============================================================================
// FILTER TRIGGER BUTTON
// ============================================================================

export function FilterTriggerButton({
  onClick,
  activeCount,
  label = 'Filters',
  className,
}: FilterTriggerButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        // Base styles - industrial, high contrast
        'relative inline-flex items-center justify-center gap-2',
        'min-h-[48px] px-4 py-3 rounded-lg',
        'bg-card text-card-foreground',
        'font-semibold text-sm uppercase tracking-wide',
        'border-2 border-border',
        'shadow-md',
        // Touch optimization
        'touch-manipulation select-none',
        // Active/hover states
        'hover:bg-muted/60 active:scale-[0.98] active:bg-muted',
        'transition-all duration-100',
        // Focus state for accessibility
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
        className,
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
            'bg-amber-500 text-foreground',
            'text-xs font-bold',
            'border-2 border-background',
          )}
          aria-hidden="true"
        >
          {activeCount > 99 ? '99+' : activeCount}
        </span>
      )}
    </button>
  );
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
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ y: number; time: number } | null>(null);
  const isDraggingRef = useRef(false);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Small delay to ensure CSS transition works
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setDragOffset(0);
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isVisible) {
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.width = '';
      };
    }
  }, [isVisible]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Drag handlers for swipe-to-dismiss
  const handleDragStart = useCallback((clientY: number) => {
    dragStartRef.current = { y: clientY, time: Date.now() };
    isDraggingRef.current = true;
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    const diff = clientY - dragStartRef.current.y;
    // Only allow dragging down
    if (diff > 0) {
      setDragOffset(diff);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    if (!isDraggingRef.current || !dragStartRef.current) return;

    const diff = dragOffset;
    const timeDiff = Date.now() - dragStartRef.current.time;
    const velocity = diff / timeDiff;

    // Close if dragged more than 100px or with high velocity
    if (diff > 100 || velocity > 0.5) {
      onClose();
    }

    setDragOffset(0);
    dragStartRef.current = null;
    isDraggingRef.current = false;
  }, [dragOffset, onClose]);

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Mouse event handlers (for testing on desktop)
  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDraggingRef.current) {
      handleDragMove(e.clientY);
    }
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  // Update a single filter value
  const handleFilterChange = (filterId: string, newValue: FilterValues[string]) => {
    onChange({
      ...values,
      [filterId]: newValue,
    });
  };

  const activeCount = countActiveFilters(filters, values);

  if (!isVisible) return null;

  const sheetContent = (
    <div
      className={cn(
        'fixed inset-0 z-50 md:hidden',
        'transition-colors duration-300',
        isAnimating && dragOffset === 0 ? 'bg-black/60' : 'bg-black/0',
      )}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
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
          'bg-muted/50',
          'rounded-t-2xl shadow-2xl',
          'max-h-[85vh] flex flex-col',
          'transition-transform duration-300 ease-out',
          !isDraggingRef.current && 'transition-transform',
        )}
        style={{
          transform: isAnimating ? `translateY(${dragOffset}px)` : 'translateY(100%)',
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
          <div className="w-12 h-1.5 bg-muted-foreground rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b-2 border-border">
          <h2 id="filter-sheet-title" className="text-xl font-bold text-foreground dark:text-white">
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
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
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
                'bg-muted',
                'text-muted-foreground',
                'hover:bg-muted',
                'active:scale-[0.98]',
                'touch-manipulation transition-all duration-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500',
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
            const key = filter.id;
            switch (filter.type) {
              case 'select':
                return (
                  <SelectFilterComponent
                    key={key}
                    filter={filter}
                    value={values[filter.id] as string | null}
                    onChange={(val) => handleFilterChange(filter.id, val)}
                  />
                );
              case 'multiselect':
                return (
                  <MultiselectFilterComponent
                    key={key}
                    filter={filter}
                    value={(values[filter.id] as string[]) || []}
                    onChange={(val) => handleFilterChange(filter.id, val)}
                  />
                );
              case 'range':
                return (
                  <RangeFilterComponent
                    key={key}
                    filter={filter}
                    value={
                      (values[filter.id] as { min: number; max: number }) || {
                        min: filter.min,
                        max: filter.max,
                      }
                    }
                    onChange={(val) => handleFilterChange(filter.id, val)}
                  />
                );
              case 'date':
                return (
                  <DateFilterComponent
                    key={key}
                    filter={filter}
                    value={
                      (values[filter.id] as { start: string | null; end: string | null }) || {
                        start: null,
                        end: null,
                      }
                    }
                    onChange={(val) => handleFilterChange(filter.id, val)}
                  />
                );
              default:
                return null;
            }
          })}
        </div>

        {/* Footer with Apply Button */}
        <div className="p-4 border-t-2 border-border bg-card pb-safe">
          <button
            onClick={() => onApply(values)}
            className={cn(
              'w-full min-h-[56px] px-6 py-4 rounded-xl',
              'bg-amber-500 hover:bg-amber-600 active:bg-amber-700',
              'text-foreground font-bold text-lg uppercase tracking-wide',
              'shadow-lg shadow-amber-500/30',
              'active:scale-[0.98]',
              'touch-manipulation transition-all duration-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2',
            )}
          >
            Apply Filters
            {activeCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-foreground/20 text-sm">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(sheetContent, document.body);
}

// ============================================================================
// HOOK FOR EASY FILTER STATE MANAGEMENT
// ============================================================================

export interface UseFilterSheetOptions {
  filters: FilterConfig[];
  initialValues?: FilterValues;
  onApply?: (values: FilterValues) => void;
}

export function useFilterSheet({ filters, initialValues, onApply }: UseFilterSheetOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [values, setValues] = useState<FilterValues>(() =>
    buildInitialFilterValues(filters, initialValues),
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const handleApply = useCallback(
    (newValues: FilterValues) => {
      setValues(newValues);
      setIsOpen(false);
      onApply?.(newValues);
    },
    [onApply],
  );

  const handleClear = useCallback(() => {
    setValues(buildClearedFilterValues(filters));
  }, [filters]);

  const activeCount = countActiveFilters(filters, values);

  return {
    isOpen,
    open,
    close,
    values,
    setValues,
    handleApply,
    handleClear,
    activeCount,
  };
}

export default FilterBottomSheet;
