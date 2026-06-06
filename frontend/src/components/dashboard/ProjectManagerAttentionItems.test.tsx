import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProjectManagerAttentionItems } from './ProjectManagerAttentionItems';
import type { PMDashboardData } from './ProjectManagerDashboardHelpers';

const items: PMDashboardData['attentionItems'] = Array.from({ length: 6 }, (_, index) => ({
  id: `attention-${index}`,
  type: index % 2 === 0 ? 'ncr' : 'holdpoint',
  title: `Attention item ${index + 1}`,
  description: `Description ${index + 1}`,
  urgency: index === 0 ? 'critical' : index === 1 ? 'warning' : 'info',
  link: `/attention/${index + 1}`,
}));

describe('ProjectManagerAttentionItems', () => {
  it('renders nothing when there are no attention items', () => {
    const { container } = render(
      <ProjectManagerAttentionItems items={[]} onOpenItem={() => undefined} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the total count but limits the visible list to five items', () => {
    render(<ProjectManagerAttentionItems items={items} onOpenItem={() => undefined} />);

    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('Attention item 1')).toBeInTheDocument();
    expect(screen.getByText('Attention item 5')).toBeInTheDocument();
    expect(screen.queryByText('Attention item 6')).not.toBeInTheDocument();
  });

  it('delegates item navigation using the existing item link', async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();

    render(<ProjectManagerAttentionItems items={items} onOpenItem={onOpenItem} />);

    await user.click(screen.getByRole('button', { name: /attention item 2/i }));

    expect(onOpenItem).toHaveBeenCalledWith('/attention/2');
  });
});
