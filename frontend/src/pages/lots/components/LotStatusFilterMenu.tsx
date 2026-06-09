import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { STATUS_OPTIONS } from './lotFilterConfig';

interface LotStatusFilterMenuProps {
  statusFilters: string[];
  onUpdateFilters: (params: Record<string, string>) => void;
}

export function LotStatusFilterMenu({ statusFilters, onUpdateFilters }: LotStatusFilterMenuProps) {
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };

    if (statusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [statusDropdownOpen]);

  const handleStatusToggle = (status: string) => {
    let newFilters: string[];
    if (statusFilters.includes(status)) {
      newFilters = statusFilters.filter((s) => s !== status);
    } else {
      newFilters = [...statusFilters, status];
    }
    onUpdateFilters({ status: newFilters.join(',') });
  };

  const clearStatusFilters = () => {
    onUpdateFilters({ status: '' });
  };

  return (
    <div className="flex items-center gap-2">
      <Label>Status:</Label>
      <div className="relative" ref={statusDropdownRef}>
        <button
          onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
          className="rounded-lg border bg-background px-3 py-1.5 text-sm min-w-[140px] text-left flex items-center justify-between gap-2"
        >
          <span className="truncate">
            {statusFilters.length === 0
              ? 'All Statuses'
              : statusFilters.length === 1
                ? STATUS_OPTIONS.find((s) => s.value === statusFilters[0])?.label
                : `${statusFilters.length} selected`}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        {statusDropdownOpen && (
          <div className="absolute z-50 mt-1 w-48 rounded-lg border bg-background shadow-lg">
            <div className="p-2 max-h-64 overflow-y-auto">
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={statusFilters.includes(option.value)}
                    onChange={() => handleStatusToggle(option.value)}
                    className="h-4 w-4 rounded border-border accent-primary focus:ring-primary"
                  />
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
            {statusFilters.length > 0 && (
              <div className="border-t p-2">
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    clearStatusFilters();
                    setStatusDropdownOpen(false);
                  }}
                  className="w-full"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>
        )}
        {statusFilters.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={clearStatusFilters}
            className="ml-1 h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Clear status filter"
            aria-label="Clear status filter"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
}
