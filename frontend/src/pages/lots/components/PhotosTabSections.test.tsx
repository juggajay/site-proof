import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PhotosEmptyState, PhotosSelectionToolbar } from './PhotosTabSections';

describe('PhotosTabSections', () => {
  it('routes the empty state CTA back to the ITP checklist', () => {
    const onOpenItpChecklist = vi.fn();

    render(<PhotosEmptyState onOpenItpChecklist={onOpenItpChecklist} />);

    expect(screen.getByText('No Photos')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Go to ITP Checklist' }));

    expect(onOpenItpChecklist).toHaveBeenCalledTimes(1);
  });

  it('shows only select-all controls when no photos are selected', () => {
    render(
      <PhotosSelectionToolbar
        photoCount={2}
        selectedCount={0}
        allSelected={false}
        onToggleSelectAll={vi.fn()}
        onOpenBatchCaption={vi.fn()}
        onOpenAddToEvidence={vi.fn()}
      />,
    );

    expect(screen.getByText('2 photos attached to ITP checklist items')).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'Select All' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: /Bulk Caption/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add to Evidence/ })).not.toBeInTheDocument();
  });

  it('shows bulk actions and delegates toolbar events when photos are selected', () => {
    const onToggleSelectAll = vi.fn();
    const onOpenBatchCaption = vi.fn();
    const onOpenAddToEvidence = vi.fn();

    render(
      <PhotosSelectionToolbar
        photoCount={3}
        selectedCount={2}
        allSelected={true}
        onToggleSelectAll={onToggleSelectAll}
        onOpenBatchCaption={onOpenBatchCaption}
        onOpenAddToEvidence={onOpenAddToEvidence}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select All' }));
    fireEvent.click(screen.getByRole('button', { name: 'Bulk Caption (2)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to Evidence (2)' }));

    expect(onToggleSelectAll).toHaveBeenCalledTimes(1);
    expect(onOpenBatchCaption).toHaveBeenCalledTimes(1);
    expect(onOpenAddToEvidence).toHaveBeenCalledTimes(1);
  });
});
