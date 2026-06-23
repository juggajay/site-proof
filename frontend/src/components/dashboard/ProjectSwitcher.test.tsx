import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectSwitcher } from './ProjectSwitcher';

afterEach(() => {
  cleanup();
});

const projects = [
  { id: 'p1', name: 'Highway Upgrade', projectNumber: 'PRJ-001', status: 'active' },
  { id: 'p2', name: 'Bridge Works', projectNumber: 'PRJ-002', status: 'active' },
];

describe('ProjectSwitcher (M71)', () => {
  it('renders an option per project and reflects the current value', () => {
    render(<ProjectSwitcher projects={projects} value="p2" onChange={() => {}} />);

    const select = screen.getByLabelText('Switch project') as HTMLSelectElement;
    expect(select.value).toBe('p2');
    expect(screen.getByRole('option', { name: /PRJ-001/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Bridge Works/ })).toBeInTheDocument();
  });

  it('calls onChange with the selected project id', () => {
    const onChange = vi.fn();
    render(<ProjectSwitcher projects={projects} value="p1" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Switch project'), { target: { value: 'p2' } });
    expect(onChange).toHaveBeenCalledWith('p2');
  });

  it('renders nothing when there is at most one project to switch to', () => {
    const { container } = render(
      <ProjectSwitcher projects={[projects[0]!]} value="p1" onChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByLabelText('Switch project')).not.toBeInTheDocument();
  });
});
