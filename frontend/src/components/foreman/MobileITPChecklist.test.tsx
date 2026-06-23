import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MobileITPChecklist,
  type ITPChecklistItem,
  type ITPCompletion,
} from './MobileITPChecklist';

afterEach(() => {
  cleanup();
});

function makeItem(overrides: Partial<ITPChecklistItem> & Pick<ITPChecklistItem, 'id'>) {
  return {
    description: 'Checklist item',
    category: 'General',
    responsibleParty: 'contractor',
    isHoldPoint: false,
    pointType: 'standard',
    evidenceRequired: 'none',
    order: 1,
    ...overrides,
  } as ITPChecklistItem;
}

function makeCompletion(
  overrides: Partial<ITPCompletion> & Pick<ITPCompletion, 'checklistItemId'>,
) {
  return {
    id: `completion-${overrides.checklistItemId}`,
    isCompleted: false,
    isNotApplicable: false,
    isFailed: false,
    notes: null,
    completedAt: null,
    completedBy: null,
    isVerified: false,
    attachments: [],
    ...overrides,
  } as ITPCompletion;
}

// Two categories: Earthworks fully complete (its only item needs a photo it
// does not have), Pavement has the incomplete work.
const checklistItems: ITPChecklistItem[] = [
  makeItem({
    id: 'item-1',
    description: 'Strip topsoil',
    category: 'Earthworks',
    evidenceRequired: 'photo',
    order: 1,
  }),
  makeItem({ id: 'item-2', description: 'Compact subgrade', category: 'Pavement', order: 2 }),
];

const completions: ITPCompletion[] = [
  makeCompletion({ checklistItemId: 'item-1', isCompleted: true }),
];

function renderChecklist(overrides: Partial<Parameters<typeof MobileITPChecklist>[0]> = {}) {
  const props: Parameters<typeof MobileITPChecklist>[0] = {
    lotNumber: 'LOT-001',
    templateName: 'Earthworks ITP',
    checklistItems,
    completions,
    onToggleCompletion: vi.fn().mockResolvedValue(undefined),
    onMarkNotApplicable: vi.fn().mockResolvedValue(true),
    onMarkFailed: vi.fn().mockResolvedValue(true),
    onUpdateNotes: vi.fn().mockResolvedValue(undefined),
    onAddPhoto: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { props, ...render(<MobileITPChecklist {...props} />) };
}

// Open the item sheet for item-2 and reveal the N/A reason input.
function openNaInputForItem2() {
  fireEvent.click(screen.getByText(/Compact subgrade/i));
  fireEvent.click(screen.getByRole('button', { name: /N\/A/i }));
  return screen.getByPlaceholderText('Why is this item not applicable?');
}

describe('MobileITPChecklist default expansion', () => {
  it('default-expands the first category that still has incomplete work', () => {
    renderChecklist();

    // Pavement (incomplete) is open; Earthworks (complete) stays collapsed.
    expect(screen.getByText(/Compact subgrade/i)).toBeInTheDocument();
    expect(screen.queryByText(/Strip topsoil/i)).not.toBeInTheDocument();
  });

  it('shows the photo-required count on the collapsed category header', () => {
    renderChecklist();

    // Earthworks is collapsed and its completed item still has no photo.
    expect(screen.getByLabelText('1 item needs photos')).toBeInTheDocument();
  });
});

describe('MobileITPChecklist point metadata', () => {
  it('renders and opens a verification point with verification metadata', () => {
    renderChecklist({
      checklistItems: [
        makeItem({
          id: 'verification-item',
          description: 'Verify subcontractor compaction records',
          category: 'Verification',
          pointType: 'verification',
          responsibleParty: 'subcontractor',
          order: 1,
        }),
      ],
      completions: [],
      canCompleteItems: false,
    });

    expect(screen.getByText('V')).toBeVisible();
    fireEvent.click(screen.getByText(/Verify subcontractor compaction records/i));

    expect(screen.getByText('Verification Point')).toBeInTheDocument();
    expect(screen.getByText('Subcontractor')).toBeInTheDocument();
  });

  it('falls back to generic point metadata for unknown point types', () => {
    renderChecklist({
      checklistItems: [
        makeItem({
          id: 'unknown-point-type',
          description: 'Review imported checklist row',
          category: 'Imported',
          pointType: 'inspection' as ITPChecklistItem['pointType'],
          order: 1,
        }),
      ],
      completions: [],
    });

    expect(screen.getByText('?')).toBeVisible();
    fireEvent.click(screen.getByText(/Review imported checklist row/i));

    expect(screen.getByText('Checklist Point')).toBeInTheDocument();
  });
});

describe('MobileITPChecklist N/A and Fail keep failure context', () => {
  it('keeps the sheet open with the typed reason and an inline error when N/A fails', async () => {
    const onMarkNotApplicable = vi.fn().mockResolvedValue(false);
    renderChecklist({ onMarkNotApplicable });

    const reasonInput = openNaInputForItem2();
    fireEvent.change(reasonInput, { target: { value: 'Designed out in Rev C' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as N/A' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Your reason is kept/i);
    });
    expect(onMarkNotApplicable).toHaveBeenCalledWith('item-2', 'Designed out in Rev C');
    // Sheet is still open and the typed reason survived the failed save.
    expect(screen.getByPlaceholderText('Why is this item not applicable?')).toHaveValue(
      'Designed out in Rev C',
    );
  });

  it('closes the sheet when the N/A save succeeds', async () => {
    const onMarkNotApplicable = vi.fn().mockResolvedValue(true);
    renderChecklist({ onMarkNotApplicable });

    const reasonInput = openNaInputForItem2();
    fireEvent.change(reasonInput, { target: { value: 'Not applicable here' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as N/A' }));

    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText('Why is this item not applicable?'),
      ).not.toBeInTheDocument();
    });
    expect(onMarkNotApplicable).toHaveBeenCalledWith('item-2', 'Not applicable here');
  });

  it('keeps the sheet open with the typed defect reason when the Fail save fails', async () => {
    const onMarkFailed = vi.fn().mockResolvedValue(false);
    renderChecklist({ onMarkFailed });

    fireEvent.click(screen.getByText(/Compact subgrade/i));
    fireEvent.click(screen.getByRole('button', { name: /FAIL/i }));
    const reasonInput = screen.getByPlaceholderText('Describe the issue...');
    fireEvent.change(reasonInput, { target: { value: 'Pumping under proof roll near CH 420' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark as Failed' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Your reason is kept/i);
    });
    expect(onMarkFailed).toHaveBeenCalledWith('item-2', 'Pumping under proof roll near CH 420');
    expect(screen.getByPlaceholderText('Describe the issue...')).toHaveValue(
      'Pumping under proof roll near CH 420',
    );
  });
});

describe('MobileITPChecklist PASS awaits the save and closes only on success (M57)', () => {
  it('keeps the sheet open with an inline error when the PASS save fails', async () => {
    const onToggleCompletion = vi.fn().mockResolvedValue(false);
    renderChecklist({ onToggleCompletion });

    fireEvent.click(screen.getByText(/Compact subgrade/i));
    fireEvent.click(screen.getByRole('button', { name: /PASS/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Could not save/i);
    });
    // The toggle was attempted (complete = true) and the sheet stayed open.
    expect(onToggleCompletion).toHaveBeenCalledWith('item-2', true, null);
    expect(screen.getByRole('button', { name: /PASS/i })).toBeInTheDocument();
  });

  it('closes the sheet when the PASS save succeeds', async () => {
    const onToggleCompletion = vi.fn().mockResolvedValue(true);
    renderChecklist({ onToggleCompletion });

    fireEvent.click(screen.getByText(/Compact subgrade/i));
    fireEvent.click(screen.getByRole('button', { name: /PASS/i }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /PASS/i })).not.toBeInTheDocument();
    });
    expect(onToggleCompletion).toHaveBeenCalledWith('item-2', true, null);
  });
});
