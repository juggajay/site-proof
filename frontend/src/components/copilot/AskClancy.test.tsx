import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AskClancyButton, AskClancyChips } from './AskClancy';
import { resetClancyStore } from './clancyChatState';

const aiState = vi.hoisted(() => ({ configured: true }));
const authState = vi.hoisted(() => ({ roleInCompany: 'owner' }));

vi.mock('@/hooks/useAiStatus', () => ({
  useAiStatus: () => ({ aiConfigured: aiState.configured }),
}));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { fullName: 'Jayson Ryan', roleInCompany: authState.roleInCompany } }),
}));

beforeEach(() => {
  resetClancyStore();
  aiState.configured = true;
  authState.roleInCompany = 'owner';
});

afterEach(() => {
  resetClancyStore();
});

describe('AskClancyButton', () => {
  it('renders nothing when Clancy is unavailable', () => {
    aiState.configured = false;
    const { container } = render(<AskClancyButton question="q?" label="Ask Clancy" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a field role', () => {
    authState.roleInCompany = 'foreman';
    const { container } = render(<AskClancyButton question="q?" label="Ask Clancy" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('queues the question and opens the drawer on click', async () => {
    render(<AskClancyButton question="What is the status of lot 12?" label="Ask Clancy" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ask Clancy: Ask Clancy' }));

    const { getClancyStateForTest } = await import('./clancyChatState');
    const state = getClancyStateForTest();
    expect(state.pendingPrompt).toBe('What is the status of lot 12?');
    expect(state.open).toBe(true);
  });
});

describe('AskClancyChips', () => {
  it('renders one gated button per prompt and queues on click', async () => {
    render(
      <AskClancyChips
        prompts={[
          { label: 'Summary', question: 'Summarise the open NCRs' },
          { label: 'Overdue', question: 'Any overdue NCRs?' },
        ]}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Ask Clancy: Overdue' }));
    const { getClancyStateForTest } = await import('./clancyChatState');
    expect(getClancyStateForTest().pendingPrompt).toBe('Any overdue NCRs?');
  });

  it('renders nothing when Clancy is unavailable', () => {
    aiState.configured = false;
    const { container } = render(<AskClancyChips prompts={[{ label: 'x', question: 'y' }]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
