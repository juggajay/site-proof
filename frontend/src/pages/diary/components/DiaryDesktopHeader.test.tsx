import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DiaryDesktopHeader } from './DiaryDesktopHeader';

function renderHeader(onNewEntry = vi.fn()) {
  render(
    <MemoryRouter>
      <DiaryDesktopHeader projectId="p1" onNewEntry={onNewEntry} />
    </MemoryRouter>,
  );
  return { onNewEntry };
}

describe('DiaryDesktopHeader', () => {
  it('renders the title, context help, and delay register link', () => {
    renderHeader();

    expect(screen.getByRole('heading', { name: 'Daily Diary' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Help for Daily Diary' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Delay Register/ })).toHaveAttribute(
      'href',
      '/projects/p1/delays',
    );
  });

  it('starts a new entry from the header action', async () => {
    const user = userEvent.setup();
    const { onNewEntry } = renderHeader();

    await user.click(screen.getByRole('button', { name: /New Diary Entry/ }));

    expect(onNewEntry).toHaveBeenCalledTimes(1);
  });
});
