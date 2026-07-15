import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ActivityTypeOptions } from './ActivityTypeOptions';

function renderOptions(currentValue?: string | null) {
  return render(
    <select defaultValue={currentValue ?? ''}>
      <ActivityTypeOptions currentValue={currentValue} />
    </select>,
  );
}

describe('ActivityTypeOptions', () => {
  it('renders the 9 non-empty families and skips the parked rail group', () => {
    const { container } = renderOptions();
    const labels = Array.from(container.querySelectorAll('optgroup')).map((g) => g.label);
    expect(labels).toEqual([
      'Earthworks',
      'Pavements',
      'Surfacing',
      'Drainage',
      'Structures',
      'Road furniture',
      'Environmental',
      'Concrete flatwork',
      'Utilities',
    ]);
    expect(labels).not.toContain('Rail');
  });

  it('offers a canonical slug as a selectable option', () => {
    const { container } = renderOptions('culverts');
    const opt = container.querySelector('option[value="culverts"]') as HTMLOptionElement;
    expect(opt).not.toBeNull();
    expect(opt.disabled).toBe(false);
    expect(opt.textContent).toBe('Culverts (box/pipe)');
    // No legacy row when the value is already canonical.
    expect(container.querySelector('option[disabled]')).toBeNull();
  });

  it('shows a legacy/free-text value as a disabled option instead of rewriting it', () => {
    const { container } = renderOptions('Concrete');
    const legacy = container.querySelector('option[value="Concrete"]') as HTMLOptionElement;
    expect(legacy).not.toBeNull();
    expect(legacy.disabled).toBe(true);
    expect(legacy.textContent).toContain('Concrete');
  });
});
