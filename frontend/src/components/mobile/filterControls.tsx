/**
 * Filter control renderers for the mobile FilterBottomSheet - one component
 * per filter type (select, multiselect pills, dual-range sliders, date range).
 *
 * Design: High contrast, glove-friendly 48px+ touch targets, rugged
 * utilitarian aesthetic - matching the host bottom sheet.
 */
import { ChevronDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SelectFilter, MultiselectFilter, RangeFilter, DateFilter } from './FilterBottomSheet';

interface SelectFilterComponentProps {
  filter: SelectFilter;
  value: string | null;
  onChange: (value: string | null) => void;
}

export function SelectFilterComponent({ filter, value, onChange }: SelectFilterComponentProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {filter.label}
      </label>
      <div className="relative">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className={cn(
            'w-full min-h-[48px] px-4 py-3 pr-10',
            'bg-card',
            'border-2 border-border',
            'rounded-lg text-base font-medium',
            'appearance-none cursor-pointer',
            'touch-manipulation',
            'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
            'transition-colors duration-100',
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
          className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

interface MultiselectFilterComponentProps {
  filter: MultiselectFilter;
  value: string[];
  onChange: (value: string[]) => void;
}

export function MultiselectFilterComponent({
  filter,
  value,
  onChange,
}: MultiselectFilterComponentProps) {
  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {filter.label}
      </label>
      <div className="flex flex-wrap gap-2">
        {filter.options.map((option) => {
          const isSelected = value.includes(option.value);
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
                  ? 'bg-primary border-primary text-primary-foreground'
                  : 'bg-card border-border text-foreground',
                // Focus state
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              )}
              aria-pressed={isSelected}
            >
              {option.label}
              {option.count !== undefined && (
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface RangeFilterComponentProps {
  filter: RangeFilter;
  value: { min: number; max: number };
  onChange: (value: { min: number; max: number }) => void;
}

export function RangeFilterComponent({ filter, value, onChange }: RangeFilterComponentProps) {
  const formatValue = filter.formatValue || ((v: number) => v.toString());
  const step = filter.step || 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
          {filter.label}
        </label>
        <span className="text-sm font-semibold text-foreground">
          {formatValue(value.min)} - {formatValue(value.max)}
        </span>
      </div>

      {/* Dual range inputs styled as industrial sliders */}
      <div className="space-y-4">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Min</span>
          <input
            type="range"
            min={filter.min}
            max={filter.max}
            step={step}
            value={value.min}
            onChange={(e) => {
              const newMin = Number(e.target.value);
              if (newMin <= value.max) {
                onChange({ ...value, min: newMin });
              }
            }}
            className={cn(
              'w-full h-12 cursor-pointer touch-manipulation',
              'appearance-none bg-transparent',
              // Track styles
              '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full',
              '[&::-webkit-slider-runnable-track]:bg-muted',
              // Thumb styles - large for glove use
              '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-8',
              '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
              '[&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-primary',
              '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:-mt-2.5',
              // Firefox styles
              '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full',
              '[&::-moz-range-track]:bg-muted',
              '[&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:w-8 [&::-moz-range-thumb]:rounded-full',
              '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-4',
              '[&::-moz-range-thumb]:border-primary',
            )}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Max</span>
          <input
            type="range"
            min={filter.min}
            max={filter.max}
            step={step}
            value={value.max}
            onChange={(e) => {
              const newMax = Number(e.target.value);
              if (newMax >= value.min) {
                onChange({ ...value, max: newMax });
              }
            }}
            className={cn(
              'w-full h-12 cursor-pointer touch-manipulation',
              'appearance-none bg-transparent',
              // Track styles
              '[&::-webkit-slider-runnable-track]:h-3 [&::-webkit-slider-runnable-track]:rounded-full',
              '[&::-webkit-slider-runnable-track]:bg-muted',
              // Thumb styles - large for glove use
              '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-8 [&::-webkit-slider-thumb]:w-8',
              '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary',
              '[&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-primary',
              '[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:-mt-2.5',
              // Firefox styles
              '[&::-moz-range-track]:h-3 [&::-moz-range-track]:rounded-full',
              '[&::-moz-range-track]:bg-muted',
              '[&::-moz-range-thumb]:h-8 [&::-moz-range-thumb]:w-8 [&::-moz-range-thumb]:rounded-full',
              '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-4',
              '[&::-moz-range-thumb]:border-primary',
            )}
          />
        </div>
      </div>
    </div>
  );
}

interface DateFilterComponentProps {
  filter: DateFilter;
  value: { start: string | null; end: string | null };
  onChange: (value: { start: string | null; end: string | null }) => void;
}

export function DateFilterComponent({ filter, value, onChange }: DateFilterComponentProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
        {filter.label}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
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
              'bg-card',
              'border-2 border-border',
              'rounded-lg text-base font-medium',
              'touch-manipulation',
              'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
              'transition-colors duration-100',
            )}
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
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
              'bg-card',
              'border-2 border-border',
              'rounded-lg text-base font-medium',
              'touch-manipulation',
              'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
              'transition-colors duration-100',
            )}
          />
        </div>
      </div>
    </div>
  );
}
