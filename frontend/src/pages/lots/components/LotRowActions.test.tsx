import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/renderWithProviders';
import { LotRowActions } from './LotRowActions';
import type { Lot } from '../lotsPageTypes';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

// Radix's DropdownMenu calls the Pointer Capture API and scrollIntoView, neither
// of which jsdom implements. Stubbing them is what lets the menu actually open.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

const baseLot: Lot = {
  id: 'lot-1',
  lotNumber: 'LOT-001',
  description: 'Test lot',
  status: 'in_progress',
  chainageStart: null,
  chainageEnd: null,
  offset: null,
  layer: null,
  areaZone: null,
};

type Overrides = Partial<Parameters<typeof LotRowActions>[0]>;

function renderActions(overrides: Overrides = {}) {
  const props: Parameters<typeof LotRowActions>[0] = {
    lot: baseLot,
    projectId: 'p1',
    canCreate: true,
    canDelete: true,
    cloningLotId: null,
    onCloneLot: vi.fn(),
    onDeleteClick: vi.fn(),
    ...overrides,
  };
  const result = renderWithProviders(<LotRowActions {...props} />);
  return { ...result, props };
}

// Enter on the trigger, not a synthetic pointerdown: jsdom has no PointerEvent
// so Radix never sees a real button-0 press, and the keyboard path has to work
// anyway.
function openOverflowMenu() {
  fireEvent.keyDown(screen.getByRole('button', { name: /more actions for lot LOT-001/i }), {
    key: 'Enter',
  });
}

describe('LotRowActions', () => {
  it('keeps every row action reachable — View inline, the rest in the overflow menu', () => {
    renderActions();

    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();

    openOverflowMenu();

    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Clone' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('routes View and Edit to the lot pages', () => {
    renderActions();

    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(navigateSpy).toHaveBeenCalledWith('/projects/p1/lots/lot-1', {
      state: { returnFilters: '' },
    });

    openOverflowMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(navigateSpy).toHaveBeenCalledWith('/projects/p1/lots/lot-1/edit');
  });

  it('invokes the clone and delete handlers from the menu', () => {
    const { props } = renderActions();

    openOverflowMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clone' }));
    expect(props.onCloneLot).toHaveBeenCalledWith(baseLot);

    openOverflowMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(props.onDeleteClick).toHaveBeenCalledWith(baseLot);
  });

  it('disables Clone while that lot is already cloning, so a second click cannot double-submit', () => {
    const { props } = renderActions({ cloningLotId: 'lot-1' });

    openOverflowMenu();
    const cloneItem = screen.getByRole('menuitem', { name: 'Cloning...' });

    expect(cloneItem).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(cloneItem);
    expect(props.onCloneLot).not.toHaveBeenCalled();
  });

  it('hides Edit and Delete on conformed lots but still offers Clone', () => {
    renderActions({ lot: { ...baseLot, status: 'conformed' } });

    openOverflowMenu();

    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Clone' })).toBeInTheDocument();
  });

  it('drops the overflow trigger entirely for read-only viewers', () => {
    renderActions({ canCreate: false, canDelete: false });

    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /more actions for lot/i })).not.toBeInTheDocument();
  });
});
