import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LotStatusOverview } from './LotStatusOverview';

afterEach(() => {
  cleanup();
});

function getStatusButton(label: string): HTMLButtonElement {
  const button = screen.getByText(label).closest('button');
  expect(button).not.toBeNull();
  return button as HTMLButtonElement;
}

describe('LotStatusOverview', () => {
  it('renders every lot status with zero fallbacks', () => {
    render(<LotStatusOverview counts={{ conformed: 3 }} onStatusClick={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Lot Status Overview' })).toBeInTheDocument();
    expect(getStatusButton('Not Started')).toHaveTextContent('0');
    expect(getStatusButton('Conformed')).toHaveTextContent('3');
    expect(getStatusButton('Claimed')).toHaveTextContent('0');
  });

  it('reports clicked statuses to the parent', () => {
    const onStatusClick = vi.fn();
    render(
      <LotStatusOverview counts={{ not_started: 2, claimed: 1 }} onStatusClick={onStatusClick} />,
    );

    fireEvent.click(getStatusButton('Not Started'));
    fireEvent.click(getStatusButton('Claimed'));

    expect(onStatusClick).toHaveBeenNthCalledWith(1, 'not_started');
    expect(onStatusClick).toHaveBeenNthCalledWith(2, 'claimed');
  });
});
