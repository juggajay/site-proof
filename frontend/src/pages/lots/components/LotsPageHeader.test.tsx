import { beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/renderWithProviders';
import { LotsPageHeader } from './LotsPageHeader';

// Radix's DropdownMenu calls the Pointer Capture API and scrollIntoView, neither
// of which jsdom implements. Stubbing them is what lets the menu actually open.
beforeAll(() => {
  const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};
  proto.scrollIntoView ??= () => {};
});

type Overrides = Partial<Parameters<typeof LotsPageHeader>[0]>;

function renderHeader(overrides: Overrides = {}) {
  const props: Parameters<typeof LotsPageHeader>[0] = {
    isMobile: false,
    isSubcontractor: false,
    canCreate: true,
    viewMode: 'list',
    onToggleViewMode: vi.fn(),
    onOpenExport: vi.fn(),
    onPrintRegister: vi.fn(),
    onOpenImport: vi.fn(),
    onOpenBulkWizard: vi.fn(),
    onOpenCreate: vi.fn(),
    ...overrides,
  };
  const result = renderWithProviders(<LotsPageHeader {...props} />);
  return { ...result, props };
}

// Enter on the trigger, not a synthetic pointerdown: jsdom has no PointerEvent
// so Radix never sees a real button-0 press, and the keyboard path has to work
// anyway.
function openRegisterMenu() {
  fireEvent.keyDown(screen.getByRole('button', { name: 'More register actions' }), {
    key: 'Enter',
  });
}

describe('LotsPageHeader (desktop)', () => {
  it('keeps Create Lot as the only primary button and every register tool in the overflow menu', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: 'Create Lot' })).toBeInTheDocument();
    // The four register tools must not sit beside it at equal weight.
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bulk Create Lots' })).not.toBeInTheDocument();

    openRegisterMenu();

    for (const name of ['Export CSV', 'Print Register', 'Import Register', 'Bulk Create Lots']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    }
  });

  it('fires each register tool from the menu', () => {
    const { props } = renderHeader();

    openRegisterMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export CSV' }));
    expect(props.onOpenExport).toHaveBeenCalled();

    openRegisterMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Print Register' }));
    expect(props.onPrintRegister).toHaveBeenCalled();

    openRegisterMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Import Register' }));
    expect(props.onOpenImport).toHaveBeenCalled();

    openRegisterMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bulk Create Lots' }));
    expect(props.onOpenBulkWizard).toHaveBeenCalled();
  });

  it('hides the import tools from subcontractors but keeps export and print', () => {
    renderHeader({ isSubcontractor: true });

    openRegisterMenu();

    expect(screen.getByRole('menuitem', { name: 'Export CSV' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Print Register' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Import Register' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Lot' })).not.toBeInTheDocument();
  });

  // Bulk verbs moved to LotSelectionBar, above the rows they act on; the header
  // must not carry a second copy of them.
  it('leaves the bulk-selection verbs to the selection bar', () => {
    renderHeader();

    expect(screen.queryByRole('button', { name: /Update Status/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete Selected/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Print Labels/ })).not.toBeInTheDocument();
  });
});

describe('LotsPageHeader (mobile)', () => {
  it('offers the map views on the title row with 44px touch targets', () => {
    const { props } = renderHeader({ isMobile: true });

    const mapButton = screen.getByTestId('view-toggle-map');
    expect(mapButton).toHaveAttribute('aria-label', 'Satellite map view');
    expect(mapButton.className).toMatch(/\bh-11\b/);
    expect(mapButton.className).toMatch(/\bw-11\b/);
    expect(screen.getByTestId('view-toggle-linear')).toBeInTheDocument();

    fireEvent.click(mapButton);
    expect(props.onToggleViewMode).toHaveBeenCalledWith('map');
  });

  it("marks the card toggle active for 'list' (mobile renders list as cards)", () => {
    renderHeader({ isMobile: true, viewMode: 'list' });
    expect(screen.getByTestId('view-toggle-card').className).toMatch(/bg-background/);
  });

  it('drops the desktop-only register menu but keeps Create Lot', () => {
    renderHeader({ isMobile: true });

    expect(screen.queryByRole('button', { name: 'More register actions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Lot' })).toBeInTheDocument();
  });

  it('does not render the view switcher on desktop (the filters bar owns it there)', () => {
    renderHeader({ isMobile: false });
    expect(screen.queryByTestId('view-toggle-map')).not.toBeInTheDocument();
  });
});
