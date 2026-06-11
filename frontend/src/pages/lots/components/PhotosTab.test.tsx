import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PhotosTab } from './PhotosTab';
import type { ITPInstance, ITPCompletion, ITPChecklistItem, ITPAttachment } from '../types';

beforeEach(() => {
  mockPhotosTabApi();
});

function mockPhotosTabApi({
  lotDocuments = [],
  echoInit = false,
}: {
  lotDocuments?: ReturnType<typeof makeLotPhotoDocument>[];
  echoInit?: boolean;
} = {}) {
  authFetchMock.mockImplementation((url: string, init?: RequestInit) => {
    if (typeof url === 'string' && url.startsWith('/api/documents/project-1?')) {
      return Promise.resolve({ ok: true, json: async () => ({ documents: lotDocuments }) });
    }
    if (typeof url === 'string' && url.includes('/api/itp/instances/lot/')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ instance: itpInstance }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => (echoInit ? { init } : {}) });
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Stub SecureDocumentImage so tests don't need real auth / Supabase URLs.
vi.mock('@/components/documents/SecureDocumentImage', () => ({
  SecureDocumentImage: ({ alt }: { alt: string }) => <img src="/stub.jpg" alt={alt} />,
}));

// Stub PhotoViewerModal — out of scope for this PR.
vi.mock('./PhotoViewerModal', () => ({
  PhotoViewerModal: () => null,
}));

// Stub authFetch for mutation paths.
const authFetchMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, authFetch: authFetchMock };
});

// isMobile is controlled per-test via this ref. The mock reads it each call.
const isMobileRef = vi.hoisted(() => ({ current: false }));
vi.mock('@/hooks/useMediaQuery', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useMediaQuery')>();
  return { ...actual, useIsMobile: () => isMobileRef.current };
});

// ---- helpers ----------------------------------------------------------------

function makeChecklistItem(id: string, order: number): ITPChecklistItem {
  return {
    id,
    description: `Item ${order}`,
    category: 'General',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'photo',
    order,
    testType: null,
    acceptanceCriteria: null,
  };
}

function makeAttachment(docId: string): ITPAttachment {
  return {
    id: `att-${docId}`,
    documentId: docId,
    document: {
      id: docId,
      filename: `photo-${docId}.jpg`,
      fileUrl: `/storage/documents/photo-${docId}.jpg`,
      caption: null,
      uploadedAt: '2026-06-01T00:00:00.000Z',
      uploadedBy: null,
      gpsLatitude: null,
      gpsLongitude: null,
    },
  };
}

function makeLotPhotoDocument(docId: string, filename = `lot-photo-${docId}.jpg`) {
  return {
    id: docId,
    filename,
    fileUrl: `/storage/documents/${filename}`,
    caption: null,
    uploadedAt: '2026-06-01T00:00:00.000Z',
    uploadedBy: null,
    gpsLatitude: null,
    gpsLongitude: null,
    documentType: 'photo',
    category: 'progress',
  };
}

function makeCompletion(
  id: string,
  checklistItemId: string,
  attachments: ITPAttachment[] = [],
): ITPCompletion {
  return {
    id,
    checklistItemId,
    isCompleted: false,
    isNotApplicable: false,
    isFailed: false,
    notes: null,
    completedAt: null,
    completedBy: null,
    isVerified: false,
    verifiedAt: null,
    verifiedBy: null,
    attachments,
    linkedNcr: null,
  };
}

const item1 = makeChecklistItem('item-1', 1);
const item2 = makeChecklistItem('item-2', 2);
const att1 = makeAttachment('doc-1');
const att2 = makeAttachment('doc-2');

const itpInstance: ITPInstance = {
  id: 'instance-1',
  template: {
    id: 'template-1',
    name: 'Test ITP',
    checklistItems: [item1, item2],
  },
  completions: [
    makeCompletion('comp-1', 'item-1', [att1]),
    makeCompletion('comp-2', 'item-2', [att2]),
  ],
};

function renderPhotosTab() {
  return render(
    <PhotosTab
      projectId="project-1"
      itpInstance={itpInstance}
      lotId="lot-1"
      onTabChange={vi.fn()}
      onItpInstanceUpdate={vi.fn()}
    />,
  );
}

async function selectFirstPhotoAndChooseItem1Evidence() {
  const checkboxes = screen.getAllByRole('checkbox');
  fireEvent.click(checkboxes[1]);

  fireEvent.click(await screen.findByRole('button', { name: /Add to Evidence/ }));

  const itemRows = screen
    .getAllByRole('button')
    .filter((btn) => btn.textContent?.includes('1. Item 1'));
  fireEvent.click(itemRows[0]);
}

async function selectFirstPhotoAndSubmitAsItem1Evidence() {
  await selectFirstPhotoAndChooseItem1Evidence();
  fireEvent.click(screen.getByRole('button', { name: 'Add to Evidence' }));
}

// ---- desktop path -----------------------------------------------------------

describe('PhotosTab — desktop (modal) path', () => {
  afterEach(() => {
    isMobileRef.current = false;
  });

  it('renders the photo grid with a thumbnail per attachment', () => {
    renderPhotosTab();
    expect(screen.getByAltText('photo-doc-1.jpg')).toBeInTheDocument();
    expect(screen.getByAltText('photo-doc-2.jpg')).toBeInTheDocument();
  });

  it('shows empty state when itpInstance has no photos', async () => {
    const emptyInstance: ITPInstance = { ...itpInstance, completions: [] };
    render(
      <PhotosTab
        projectId="project-1"
        itpInstance={emptyInstance}
        lotId="lot-1"
        onTabChange={vi.fn()}
        onItpInstanceUpdate={vi.fn()}
      />,
    );
    expect(await screen.findByText('No Photos')).toBeInTheDocument();
  });

  it('renders lot-linked photo documents that are not attached to ITP items yet', async () => {
    const emptyInstance: ITPInstance = {
      ...itpInstance,
      completions: [makeCompletion('comp-1', 'item-1')],
    };
    mockPhotosTabApi({
      lotDocuments: [makeLotPhotoDocument('lot-doc-1', 'site-wide.jpg')],
    });

    render(
      <PhotosTab
        projectId="project-1"
        itpInstance={emptyInstance}
        lotId="lot-1"
        onTabChange={vi.fn()}
        onItpInstanceUpdate={vi.fn()}
      />,
    );

    expect(await screen.findByAltText('site-wide.jpg')).toBeInTheDocument();
    expect(screen.getByText('Lot photo')).toBeInTheDocument();
    expect(authFetchMock).toHaveBeenCalledWith(
      '/api/documents/project-1?lotId=lot-1&documentType=photo&limit=100',
    );
  });

  it('opens the Bulk Caption sheet when toolbar button is clicked', async () => {
    renderPhotosTab();

    // Select a photo first so the toolbar action buttons become visible.
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    const captionBtn = await screen.findByRole('button', { name: /Bulk Caption/ });
    fireEvent.click(captionBtn);

    expect(screen.getByRole('dialog', { name: 'Bulk Caption Photos' })).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Enter caption for all selected photos/),
    ).toBeInTheDocument();
  });

  it('closes the Bulk Caption sheet and clears input on Cancel', async () => {
    renderPhotosTab();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    fireEvent.click(await screen.findByRole('button', { name: /Bulk Caption/ }));

    const textarea = screen.getByPlaceholderText(/Enter caption for all selected photos/);
    fireEvent.change(textarea, { target: { value: 'My Caption' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog', { name: 'Bulk Caption Photos' })).not.toBeInTheDocument();
  });

  it('Apply Caption button is disabled when caption input is empty', async () => {
    renderPhotosTab();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);

    fireEvent.click(await screen.findByRole('button', { name: /Bulk Caption/ }));

    expect(screen.getByRole('button', { name: 'Apply Caption' })).toBeDisabled();
  });

  it('calls authFetch to patch each selected photo and closes sheet on success', async () => {
    // The PATCH calls return ok:true (no json body needed).
    // The subsequent refreshItpData GET must return a valid instance shape.
    authFetchMock.mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('/api/itp/instances/lot/')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ instance: itpInstance }),
        });
      }
      return Promise.resolve({ ok: true });
    });

    renderPhotosTab();

    // Select the first individual photo checkbox (index 1; index 0 is Select All).
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    fireEvent.click(await screen.findByRole('button', { name: /Bulk Caption/ }));

    fireEvent.change(screen.getByPlaceholderText(/Enter caption for all selected photos/), {
      target: { value: 'Site inspection' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apply Caption' }));

    await waitFor(() => {
      expect(authFetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/documents/'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    // Sheet closes after success.
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Bulk Caption Photos' })).not.toBeInTheDocument();
    });
  });

  it('opens the Add to Evidence sheet and lists checklist items', async () => {
    renderPhotosTab();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    fireEvent.click(await screen.findByRole('button', { name: /Add to Evidence/ }));

    expect(screen.getByRole('dialog', { name: 'Add Photos to Evidence' })).toBeInTheDocument();
    expect(screen.getByText('1. Item 1')).toBeInTheDocument();
    expect(screen.getByText('2. Item 2')).toBeInTheDocument();
  });

  it('checklist rows have at least 48px min-height for touch targets', async () => {
    renderPhotosTab();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    fireEvent.click(await screen.findByRole('button', { name: /Add to Evidence/ }));

    const rows = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('min-h-[48px]'));
    expect(rows.length).toBeGreaterThan(0);
  });

  it('Add to Evidence confirm button is disabled until a checklist item is selected', async () => {
    renderPhotosTab();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    fireEvent.click(await screen.findByRole('button', { name: /Add to Evidence/ }));

    expect(screen.getByRole('button', { name: 'Add to Evidence' })).toBeDisabled();
  });

  it('selecting a checklist item enables the Add to Evidence confirm button', async () => {
    renderPhotosTab();

    await selectFirstPhotoAndChooseItem1Evidence();

    expect(screen.getByRole('button', { name: 'Add to Evidence' })).not.toBeDisabled();
  });

  it('closes Add to Evidence sheet on Cancel', async () => {
    renderPhotosTab();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    fireEvent.click(await screen.findByRole('button', { name: /Add to Evidence/ }));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      screen.queryByRole('dialog', { name: 'Add Photos to Evidence' }),
    ).not.toBeInTheDocument();
  });

  it('calls authFetch to attach photos and closes sheet on success', async () => {
    renderPhotosTab();

    await selectFirstPhotoAndSubmitAsItem1Evidence();

    await waitFor(() => {
      expect(authFetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/attachments'),
        expect.objectContaining({ method: 'POST' }),
      );
    });

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Add Photos to Evidence' }),
      ).not.toBeInTheDocument();
    });
  });

  it('attaches a lot-linked photo document to an ITP item as evidence', async () => {
    const emptyInstance: ITPInstance = {
      ...itpInstance,
      completions: [makeCompletion('comp-1', 'item-1')],
    };
    mockPhotosTabApi({
      lotDocuments: [makeLotPhotoDocument('lot-doc-1', 'site-wide.jpg')],
      echoInit: true,
    });

    render(
      <PhotosTab
        projectId="project-1"
        itpInstance={emptyInstance}
        lotId="lot-1"
        onTabChange={vi.fn()}
        onItpInstanceUpdate={vi.fn()}
      />,
    );

    await screen.findByAltText('site-wide.jpg');
    await selectFirstPhotoAndSubmitAsItem1Evidence();

    await waitFor(() => {
      expect(authFetchMock).toHaveBeenCalledWith(
        '/api/itp/completions/comp-1/attachments',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ documentId: 'lot-doc-1' }),
        }),
      );
    });
  });
});

// ---- mobile path ------------------------------------------------------------

describe('PhotosTab — mobile (bottom sheet) path', () => {
  afterEach(() => {
    isMobileRef.current = false;
  });

  it('renders a bottom sheet (role=dialog) for Bulk Caption on mobile', async () => {
    isMobileRef.current = true;
    renderPhotosTab();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    fireEvent.click(await screen.findByRole('button', { name: /Bulk Caption/ }));

    // BottomSheet exposes role="dialog" with aria-label equal to the title.
    expect(screen.getByRole('dialog', { name: 'Bulk Caption Photos' })).toBeInTheDocument();
  });

  it('renders a bottom sheet (role=dialog) for Add to Evidence on mobile', async () => {
    isMobileRef.current = true;
    renderPhotosTab();

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    fireEvent.click(await screen.findByRole('button', { name: /Add to Evidence/ }));

    expect(screen.getByRole('dialog', { name: 'Add Photos to Evidence' })).toBeInTheDocument();

    // Evidence checklist rows must meet the ≥48px touch-target requirement.
    const rows = screen
      .getAllByRole('button')
      .filter((btn) => btn.className.includes('min-h-[48px]'));
    expect(rows.length).toBeGreaterThan(0);
  });
});
