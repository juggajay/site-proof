/**
 * Unit tests for the three foreman/site-manager NCR action modals:
 *   RespondNCRModal, RectifyNCRModal, CloseNCRModal
 *
 * Each suite verifies desktop (useIsMobile → false) and mobile
 * (useIsMobile → true) rendering paths, form submission, and cancel.
 *
 * The BottomSheet component uses framer-motion animations; we mock that
 * module to return identity wrappers so jsdom doesn't choke on animation
 * APIs that don't exist in Node.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RespondNCRModal } from './RespondNCRModal';
import { RectifyNCRModal } from './RectifyNCRModal';
import { CloseNCRModal } from './CloseNCRModal';
import type { NCR } from '../types';

// ── Shared mocks ────────────────────────────────────────────────────────────

// framer-motion: strip all animation machinery so jsdom can render the sheet.
vi.mock('framer-motion', async (importOriginal) => {
  const React = await import('react');
  type AnyProps = Record<string, unknown>;
  const passThrough = React.forwardRef<HTMLDivElement, AnyProps>(
    ({ children, ...rest }: AnyProps, ref) => {
      // Forward safe DOM props only (strip motion-specific ones)
      const domProps: AnyProps = {};
      for (const key of Object.keys(rest)) {
        if (
          !key.startsWith('drag') &&
          !key.startsWith('on') &&
          key !== 'variants' &&
          key !== 'initial' &&
          key !== 'animate' &&
          key !== 'exit' &&
          key !== 'style' &&
          key !== 'whileTap' &&
          key !== 'whileHover'
        ) {
          domProps[key] = rest[key];
        }
      }
      return React.createElement('div', { ...domProps, ref }, children as React.ReactNode);
    },
  );
  passThrough.displayName = 'MotionDiv';
  return {
    ...((await importOriginal()) as object),
    motion: { div: passThrough },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
    useTransform: () => 1,
    useDragControls: () => ({ start: vi.fn() }),
    useReducedMotion: () => false,
    animate: vi.fn(),
  };
});

// Network stubs
const apiFetchMock = vi.hoisted(() => vi.fn());
const authFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: apiFetchMock, authFetch: authFetchMock };
});

vi.mock('@/components/ui/toaster', () => ({
  toast: vi.fn(),
}));
vi.mock('@/lib/errorHandling', () => ({
  handleApiError: vi.fn(),
}));

// ── Test fixture ────────────────────────────────────────────────────────────

function makeNcr(overrides: Partial<NCR> = {}): NCR {
  return {
    id: 'ncr-1',
    ncrNumber: 'NCR-001',
    description: 'Compaction failed in Lot 12',
    category: 'workmanship',
    severity: 'minor',
    status: 'open',
    qmApprovalRequired: false,
    qmApprovedAt: null,
    raisedBy: { fullName: 'Inspector', email: 'inspector@example.com' },
    createdAt: '2026-05-01T00:00:00.000Z',
    project: { id: 'proj-1', name: 'Project', projectNumber: 'P-1' },
    ncrLots: [],
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// RespondNCRModal
// ══════════════════════════════════════════════════════════════════════════════

describe('RespondNCRModal', () => {
  const defaultProps = {
    isOpen: true,
    ncr: makeNcr(),
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog with accessible name on desktop', async () => {
    // Module-level mock already defaults useIsMobile → false for this file
    // (no module mock set yet, so useIsMobile returns the real value which
    // JSDOM resolves as "not mobile").  We mock it explicitly here.
    vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
      return { ...actual, useIsMobile: () => false };
    });
    render(<RespondNCRModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Respond to NCR NCR-001')).toBeInTheDocument();
    expect(screen.getByText('Compaction failed in Lot 12')).toBeInTheDocument();
  });

  it('renders the form fields', () => {
    render(<RespondNCRModal {...defaultProps} />);
    expect(screen.getByLabelText('Root Cause Category *')).toBeInTheDocument();
    expect(screen.getByLabelText('Root Cause Description *')).toBeInTheDocument();
    expect(screen.getByLabelText('Proposed Corrective Action *')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<RespondNCRModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit with trimmed values on valid submit', async () => {
    const onSubmit = vi.fn();
    render(<RespondNCRModal {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Root Cause Category *'), {
      target: { value: 'process' },
    });
    fireEvent.change(screen.getByLabelText('Root Cause Description *'), {
      target: { value: '  process error  ' },
    });
    fireEvent.change(screen.getByLabelText('Proposed Corrective Action *'), {
      target: { value: '  rework area  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit Response' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith('ncr-1', {
      rootCauseCategory: 'process',
      rootCauseDescription: 'process error',
      proposedCorrectiveAction: 'rework area',
    });
  });

  it('mobile mode: renders a dialog with the sheet title as accessible name', async () => {
    vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
      return { ...actual, useIsMobile: () => true };
    });
    render(<RespondNCRModal {...defaultProps} />);
    // The BottomSheet provides role="dialog" aria-label={title}. Our framer-motion
    // mock strips motion-specific props but keeps aria-label on the div.
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // The title text should appear somewhere in the sheet
    expect(screen.getByText('Respond to NCR NCR-001')).toBeInTheDocument();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<RespondNCRModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when ncr is null', () => {
    const { container } = render(<RespondNCRModal {...defaultProps} ncr={null} />);
    expect(container.firstChild).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RectifyNCRModal
// ══════════════════════════════════════════════════════════════════════════════

describe('RectifyNCRModal', () => {
  const defaultProps = {
    isOpen: true,
    ncr: makeNcr(),
    projectId: 'proj-1',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetchMock.mockResolvedValue({});
    authFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'doc-1', filename: 'photo.jpg' }),
    });
  });

  it('renders the dialog with NCR info', () => {
    render(<RectifyNCRModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Submit Rectification Evidence')).toBeInTheDocument();
    expect(screen.getByText('NCR-001')).toBeInTheDocument();
  });

  it('renders file upload inputs with ≥44px tap target class', () => {
    render(<RectifyNCRModal {...defaultProps} />);
    const inputs = document.querySelectorAll('input[type="file"]');
    expect(inputs).toHaveLength(2);
    inputs.forEach((input) => {
      expect(input.className).toContain('min-h-[44px]');
    });
  });

  it('Submit for Verification button is disabled until evidence is uploaded', () => {
    render(<RectifyNCRModal {...defaultProps} />);
    const submitBtn = screen.getByRole('button', { name: 'Submit for Verification' });
    expect(submitBtn).toBeDisabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<RectifyNCRModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mobile mode: renders a dialog with sheet title', async () => {
    vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
      return { ...actual, useIsMobile: () => true };
    });
    render(<RectifyNCRModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Submit Rectification Evidence')).toBeInTheDocument();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<RectifyNCRModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CloseNCRModal
// ══════════════════════════════════════════════════════════════════════════════

describe('CloseNCRModal', () => {
  const defaultProps = {
    isOpen: true,
    ncr: makeNcr(),
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog with accessible name', () => {
    render(<CloseNCRModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Close NCR NCR-001')).toBeInTheDocument();
  });

  it('renders verification notes and lessons learned fields', () => {
    render(<CloseNCRModal {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Notes about the verification/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/What lessons can be learned/)).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<CloseNCRModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit with trimmed values on valid submit', async () => {
    const onSubmit = vi.fn();
    render(<CloseNCRModal {...defaultProps} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText(/Notes about the verification/), {
      target: { value: '  verified OK  ' },
    });
    fireEvent.change(screen.getByPlaceholderText(/What lessons can be learned/), {
      target: { value: '  check specs first  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close NCR' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith('ncr-1', {
      verificationNotes: 'verified OK',
      lessonsLearned: 'check specs first',
    });
  });

  it('shows QM approval banner for major NCRs with qmApprovedAt set', () => {
    const ncr = makeNcr({
      severity: 'major',
      qmApprovedAt: '2026-06-01T10:00:00.000Z',
      qmApprovedBy: { fullName: 'Jane QM', email: 'qm@example.com' },
    });
    render(<CloseNCRModal {...defaultProps} ncr={ncr} />);
    expect(screen.getByText(/QM Approval granted by Jane QM/)).toBeInTheDocument();
  });

  it('mobile mode: renders a dialog with sheet title as accessible name', async () => {
    vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
      return { ...actual, useIsMobile: () => true };
    });
    render(<CloseNCRModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Close NCR NCR-001')).toBeInTheDocument();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(<CloseNCRModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when ncr is null', () => {
    const { container } = render(<CloseNCRModal {...defaultProps} ncr={null} />);
    expect(container.firstChild).toBeNull();
  });
});
