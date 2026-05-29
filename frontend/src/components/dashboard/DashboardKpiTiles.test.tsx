import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardKpiTiles } from './DashboardKpiTiles';

afterEach(() => {
  cleanup();
});

function getTile(label: string): HTMLButtonElement {
  const button = screen.getByText(label).closest('button');
  expect(button).not.toBeNull();
  return button as HTMLButtonElement;
}

describe('DashboardKpiTiles', () => {
  it('renders project, lot, and team counts', () => {
    render(
      <DashboardKpiTiles
        totalProjects={12}
        activeProjects={9}
        totalLots={34}
        onNavigate={vi.fn()}
      />,
    );

    expect(getTile('Total Projects')).toHaveTextContent('12');
    expect(getTile('Active Projects')).toHaveTextContent('9');
    expect(getTile('Total Lots')).toHaveTextContent('34');
    expect(getTile('Team Members')).toHaveTextContent('—');
  });

  it('reports tile navigation targets to the parent', () => {
    const onNavigate = vi.fn();
    render(
      <DashboardKpiTiles
        totalProjects={1}
        activeProjects={2}
        totalLots={3}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(getTile('Total Projects'));
    fireEvent.click(getTile('Active Projects'));
    fireEvent.click(getTile('Total Lots'));
    fireEvent.click(getTile('Team Members'));

    expect(onNavigate).toHaveBeenNthCalledWith(1, '/projects');
    expect(onNavigate).toHaveBeenNthCalledWith(2, '/projects?status=active');
    expect(onNavigate).toHaveBeenNthCalledWith(3, '/projects');
    expect(onNavigate).toHaveBeenNthCalledWith(4, '/company-settings');
  });
});
