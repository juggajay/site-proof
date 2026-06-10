import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResponsiveSheet } from './ResponsiveSheet';

// BottomSheet requires the Escape-key listener; keep it a lightweight passthrough.
vi.mock('@/components/foreman/sheets/BottomSheet', () => ({
  BottomSheet: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      // Mirror the real BottomSheet's ARIA contract: BottomSheet itself is the
      // dialog node (role="dialog" aria-modal aria-label={title}). ResponsiveSheet
      // must NOT add a second dialog wrapper — two nodes matching
      // getByRole('dialog', { name }) is a Playwright strict-mode violation.
      <div data-testid="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div data-testid="bottom-sheet-title">{title}</div>
        {children}
      </div>
    ) : null,
}));

const useIsMobileMock = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: useIsMobileMock };
});

describe('ResponsiveSheet', () => {
  it('renders a Modal (dialog) on desktop', () => {
    useIsMobileMock.mockReturnValue(false);

    render(
      <ResponsiveSheet open={true} onClose={vi.fn()} title="Desktop Title">
        <p>Body content</p>
      </ResponsiveSheet>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Desktop Title' })).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
    expect(screen.queryByTestId('bottom-sheet')).not.toBeInTheDocument();
  });

  it('renders a BottomSheet on mobile with an accessible dialog role', () => {
    useIsMobileMock.mockReturnValue(true);

    render(
      <ResponsiveSheet open={true} onClose={vi.fn()} title="Mobile Title">
        <p>Sheet content</p>
      </ResponsiveSheet>,
    );

    // Exactly ONE dialog node, provided by BottomSheet itself — getByRole throws
    // if a duplicate wrapper reintroduces a second role="dialog".
    expect(screen.getByRole('dialog', { name: 'Mobile Title' })).toBeInTheDocument();
    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('bottom-sheet-title')).toHaveTextContent('Mobile Title');
    expect(screen.getByText('Sheet content')).toBeInTheDocument();
  });

  it('renders nothing when open is false on desktop', () => {
    useIsMobileMock.mockReturnValue(false);

    render(
      <ResponsiveSheet open={false} onClose={vi.fn()} title="Hidden">
        <p>hidden content</p>
      </ResponsiveSheet>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
  });

  it('renders nothing when open is false on mobile', () => {
    useIsMobileMock.mockReturnValue(true);

    render(
      <ResponsiveSheet open={false} onClose={vi.fn()} title="Hidden">
        <p>hidden content</p>
      </ResponsiveSheet>,
    );

    expect(screen.queryByTestId('bottom-sheet')).not.toBeInTheDocument();
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
  });

  it('supports the isOpen alias', () => {
    useIsMobileMock.mockReturnValue(true);

    render(
      <ResponsiveSheet isOpen={true} onClose={vi.fn()} title="Alias Test">
        <p>alias body</p>
      </ResponsiveSheet>,
    );

    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument();
    expect(screen.getByText('alias body')).toBeInTheDocument();
  });

  it('renders the footer inside the sheet on mobile', () => {
    useIsMobileMock.mockReturnValue(true);

    render(
      <ResponsiveSheet
        open={true}
        onClose={vi.fn()}
        title="With Footer"
        footer={<button>Submit</button>}
      >
        <p>body</p>
      </ResponsiveSheet>,
    );

    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('renders the footer on desktop', () => {
    useIsMobileMock.mockReturnValue(false);

    render(
      <ResponsiveSheet
        open={true}
        onClose={vi.fn()}
        title="With Footer"
        footer={<button>Confirm</button>}
      >
        <p>body</p>
      </ResponsiveSheet>,
    );

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });
});
