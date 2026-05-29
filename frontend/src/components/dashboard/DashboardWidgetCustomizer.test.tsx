import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardWidgetCustomizer } from './DashboardWidgetCustomizer';

afterEach(() => {
  cleanup();
});

describe('DashboardWidgetCustomizer', () => {
  it('toggles the dropdown from the customize button', () => {
    const onToggle = vi.fn();

    render(
      <DashboardWidgetCustomizer
        isOpen={false}
        isWidgetVisible={() => false}
        onToggle={onToggle}
        onClose={vi.fn()}
        onToggleWidget={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Customize/i }));

    expect(screen.queryByText('Dashboard Widgets')).not.toBeInTheDocument();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('renders configured widgets and reports toggle clicks', () => {
    const onToggleWidget = vi.fn();

    render(
      <DashboardWidgetCustomizer
        isOpen
        isWidgetVisible={(widgetId) => widgetId === 'lotStatus'}
        onToggle={vi.fn()}
        onClose={vi.fn()}
        onToggleWidget={onToggleWidget}
      />,
    );

    expect(screen.getByText('Dashboard Widgets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lot Status/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Recent Activity/i }));

    expect(onToggleWidget).toHaveBeenCalledWith('recentActivity');
  });
});
