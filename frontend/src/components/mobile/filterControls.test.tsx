import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  DateFilterComponent,
  MultiselectFilterComponent,
  RangeFilterComponent,
  SelectFilterComponent,
} from './filterControls';
import type { DateFilter, MultiselectFilter, RangeFilter, SelectFilter } from './FilterBottomSheet';

describe('SelectFilterComponent', () => {
  const filter: SelectFilter = {
    type: 'select',
    id: 'status',
    label: 'Status',
    options: [
      { value: 'open', label: 'Open', count: 3 },
      { value: 'closed', label: 'Closed' },
    ],
    value: null,
  };

  it('renders an All option plus options with their counts', () => {
    render(<SelectFilterComponent filter={filter} value={null} onChange={vi.fn()} />);

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(['All', 'Open (3)', 'Closed']);
  });

  it('reports the chosen value and maps the All option back to null', () => {
    const onChange = vi.fn();
    render(<SelectFilterComponent filter={filter} value={null} onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'open' } });
    expect(onChange).toHaveBeenLastCalledWith('open');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('MultiselectFilterComponent', () => {
  const filter: MultiselectFilter = {
    type: 'multiselect',
    id: 'trades',
    label: 'Trades',
    options: [
      { value: 'earthworks', label: 'Earthworks' },
      { value: 'drainage', label: 'Drainage' },
      { value: 'pavement', label: 'Pavement' },
    ],
    value: [],
  };

  it('adds a value without losing existing selections', () => {
    const onChange = vi.fn();
    render(
      <MultiselectFilterComponent filter={filter} value={['earthworks']} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Drainage' }));

    expect(onChange).toHaveBeenCalledWith(['earthworks', 'drainage']);
  });

  it('removes only the toggled value when it is already selected', () => {
    const onChange = vi.fn();
    render(
      <MultiselectFilterComponent
        filter={filter}
        value={['earthworks', 'pavement']}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Earthworks' }));

    expect(onChange).toHaveBeenCalledWith(['pavement']);
  });

  it('marks selected pills with aria-pressed', () => {
    render(<MultiselectFilterComponent filter={filter} value={['drainage']} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Drainage' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Earthworks' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

describe('RangeFilterComponent', () => {
  const filter: RangeFilter = {
    type: 'range',
    id: 'chainage',
    label: 'Chainage',
    min: 0,
    max: 100,
    value: { min: 0, max: 100 },
  };

  function sliders(container: HTMLElement) {
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="range"]');
    expect(inputs).toHaveLength(2);
    return { minSlider: inputs[0], maxSlider: inputs[1] };
  }

  it('updates min and max independently, preserving the other bound', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangeFilterComponent filter={filter} value={{ min: 10, max: 90 }} onChange={onChange} />,
    );
    const { minSlider, maxSlider } = sliders(container);

    fireEvent.change(minSlider, { target: { value: '20' } });
    expect(onChange).toHaveBeenLastCalledWith({ min: 20, max: 90 });

    fireEvent.change(maxSlider, { target: { value: '80' } });
    expect(onChange).toHaveBeenLastCalledWith({ min: 10, max: 80 });
  });

  it('ignores updates that would cross the opposite bound', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangeFilterComponent filter={filter} value={{ min: 40, max: 60 }} onChange={onChange} />,
    );
    const { minSlider, maxSlider } = sliders(container);

    fireEvent.change(minSlider, { target: { value: '70' } });
    fireEvent.change(maxSlider, { target: { value: '30' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders the current bounds through the custom formatter', () => {
    render(
      <RangeFilterComponent
        filter={{ ...filter, formatValue: (v) => `${v}m` }}
        value={{ min: 5, max: 95 }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('5m - 95m')).toBeInTheDocument();
  });
});

describe('DateFilterComponent', () => {
  const filter: DateFilter = {
    type: 'date',
    id: 'dateRange',
    label: 'Date Range',
    value: { start: null, end: null },
  };

  function dateInputs(container: HTMLElement) {
    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="date"]');
    expect(inputs).toHaveLength(2);
    return { fromInput: inputs[0], toInput: inputs[1] };
  }

  it('reports the date string the user selected for each bound', () => {
    const onChange = vi.fn();
    const { container } = render(
      <DateFilterComponent
        filter={filter}
        value={{ start: null, end: '2026-06-30' }}
        onChange={onChange}
      />,
    );
    const { fromInput, toInput } = dateInputs(container);

    fireEvent.change(fromInput, { target: { value: '2026-06-01' } });
    expect(onChange).toHaveBeenLastCalledWith({ start: '2026-06-01', end: '2026-06-30' });

    fireEvent.change(toInput, { target: { value: '2026-06-15' } });
    expect(onChange).toHaveBeenLastCalledWith({ start: null, end: '2026-06-15' });
  });

  it('maps a cleared input back to null', () => {
    const onChange = vi.fn();
    const { container } = render(
      <DateFilterComponent
        filter={filter}
        value={{ start: '2026-06-01', end: null }}
        onChange={onChange}
      />,
    );
    const { fromInput } = dateInputs(container);

    fireEvent.change(fromInput, { target: { value: '' } });

    expect(onChange).toHaveBeenLastCalledWith({ start: null, end: null });
  });

  it('bounds each input by the opposite selection', () => {
    const { container } = render(
      <DateFilterComponent
        filter={{ ...filter, minDate: '2026-01-01', maxDate: '2026-12-31' }}
        value={{ start: '2026-06-01', end: '2026-06-30' }}
        onChange={vi.fn()}
      />,
    );
    const { fromInput, toInput } = dateInputs(container);

    expect(fromInput).toHaveAttribute('min', '2026-01-01');
    expect(fromInput).toHaveAttribute('max', '2026-06-30');
    expect(toInput).toHaveAttribute('min', '2026-06-01');
    expect(toInput).toHaveAttribute('max', '2026-12-31');
  });
});
