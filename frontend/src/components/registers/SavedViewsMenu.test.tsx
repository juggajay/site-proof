import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { removeLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';
import { SavedViewsMenu } from './SavedViewsMenu';

// Probe that surfaces the current querystring so tests can assert that applying
// a view navigates the register's URL.
function QueryProbe() {
  const [searchParams] = useSearchParams();
  return <div data-testid="query">{searchParams.toString()}</div>;
}

function renderMenu(
  initialUrl = '/tests',
  presets?: { id: string; name: string; query: string }[],
) {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <SavedViewsMenu registerKey="test-results" presets={presets} />
      <QueryProbe />
    </MemoryRouter>,
  );
}

describe('SavedViewsMenu', () => {
  beforeEach(() => {
    // Guardrail: all storage access (tests included) goes through the safe helpers.
    removeLocalStorageItem('siteproof_saved_views.test-results');
  });

  it('saves the current querystring as a named view and lists it', () => {
    renderMenu('/tests?status=verified&passFail=fail');

    fireEvent.click(screen.getByRole('button', { name: /Views/ }));
    fireEvent.click(screen.getByRole('button', { name: /Save current view/ }));
    fireEvent.change(screen.getByLabelText('New view name'), {
      target: { value: 'Failed & verified' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // The trigger now shows the saved count and the view is listed.
    expect(screen.getByRole('button', { name: /Views \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Failed & verified' })).toBeInTheDocument();
  });

  it('disables saving when there are no active filters', () => {
    renderMenu('/tests');
    fireEvent.click(screen.getByRole('button', { name: /Views/ }));
    expect(screen.getByRole('button', { name: /Save current view/ })).toBeDisabled();
  });

  it('applies a saved view by navigating to its stored querystring', () => {
    // Seed a stored view directly, then apply it from an unfiltered URL.
    writeLocalStorageItem(
      'siteproof_saved_views.test-results',
      JSON.stringify([{ id: 'v1', name: 'Only failures', query: 'passFail=fail' }]),
    );
    renderMenu('/tests');

    expect(screen.getByTestId('query')).toHaveTextContent('');
    fireEvent.click(screen.getByRole('button', { name: /Views/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Only failures' }));

    expect(screen.getByTestId('query')).toHaveTextContent('passFail=fail');
  });

  it('deletes a saved view', () => {
    writeLocalStorageItem(
      'siteproof_saved_views.test-results',
      JSON.stringify([{ id: 'v1', name: 'Doomed', query: 'status=entered' }]),
    );
    renderMenu('/tests');

    fireEvent.click(screen.getByRole('button', { name: /Views/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete view Doomed' }));

    expect(screen.queryByRole('button', { name: 'Doomed' })).not.toBeInTheDocument();
    expect(screen.getByText('No saved views yet.')).toBeInTheDocument();
  });

  it('omits the presets section entirely for registers that ship none', () => {
    renderMenu('/tests');
    fireEvent.click(screen.getByRole('button', { name: /Views/ }));
    expect(screen.queryByText('Presets')).not.toBeInTheDocument();
  });

  it('applies a shipped preset without touching the user’s saved views', () => {
    renderMenu('/tests?status=entered', [
      { id: 'failures', name: 'Failures', query: 'passFail=fail' },
      { id: 'all', name: 'All', query: '' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Views/ }));
    expect(screen.getByText('Presets')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('register-preset-failures'));
    expect(screen.getByTestId('query')).toHaveTextContent('passFail=fail');

    // An empty preset query clears every filter rather than doing nothing.
    fireEvent.click(screen.getByRole('button', { name: /Views/ }));
    fireEvent.click(screen.getByTestId('register-preset-all'));
    expect(screen.getByTestId('query')).toHaveTextContent('');

    // Presets are shipped, not stored: the saved-views list is still empty.
    fireEvent.click(screen.getByRole('button', { name: /Views/ }));
    expect(screen.getByText('No saved views yet.')).toBeInTheDocument();
  });

  it('discloses that views are device-local', () => {
    renderMenu('/tests?status=open');
    fireEvent.click(screen.getByRole('button', { name: /Views/ }));
    expect(screen.getByText('Saved on this device')).toBeInTheDocument();
  });
});
