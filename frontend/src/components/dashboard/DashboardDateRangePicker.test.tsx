import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardDateRangePicker } from './DashboardDateRangePicker';

afterEach(() => {
  cleanup();
});

describe('DashboardDateRangePicker', () => {
  it('renders the selected date range label and toggles from the button', () => {
    const onToggle = vi.fn();

    render(
      <DashboardDateRangePicker
        selectedPreset="last30days"
        label="Last 30 days"
        isOpen={false}
        onToggle={onToggle}
        onClose={vi.fn()}
        onSelectPreset={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Last 30 days/i }));

    expect(screen.queryByText('Select Date Range')).not.toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('selects presets and closes the dropdown', () => {
    const onClose = vi.fn();
    const onSelectPreset = vi.fn();

    render(
      <DashboardDateRangePicker
        selectedPreset="last30days"
        label="Last 30 days"
        isOpen
        onToggle={vi.fn()}
        onClose={onClose}
        onSelectPreset={onSelectPreset}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'This Month' }));

    expect(onSelectPreset).toHaveBeenCalledWith('thisMonth');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
