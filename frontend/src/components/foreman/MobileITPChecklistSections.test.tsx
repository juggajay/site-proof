import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  MobileITPCategoryHeader,
  MobileITPItem,
  MobileITPProgressHeader,
  MobileITPReadOnlyNotice,
} from './MobileITPChecklistSections';
import type { ITPChecklistItem } from './MobileITPChecklist';

const checklistItem: ITPChecklistItem = {
  id: 'item-1',
  description: 'Check subgrade compaction',
  category: 'Earthworks',
  responsibleParty: 'contractor',
  isHoldPoint: false,
  pointType: 'witness',
  evidenceRequired: 'photo',
  order: 3,
};

describe('MobileITPChecklistSections', () => {
  it('renders the progress header with the lot, template, percentage, and item count', () => {
    render(
      <MobileITPProgressHeader
        lotNumber="LOT-001"
        templateName="Earthworks ITP"
        progress={67}
        completedCount={2}
        totalCount={3}
      />,
    );

    expect(screen.getByText('LOT-001')).toBeVisible();
    expect(screen.getByText('Earthworks ITP')).toBeVisible();
    expect(screen.getByText('67%')).toBeVisible();
    expect(screen.getByText('2/3')).toBeVisible();
  });

  it('renders the read-only permission notice', () => {
    render(<MobileITPReadOnlyNotice />);

    expect(screen.getByText(/do not have permission to complete items/i)).toBeVisible();
  });

  it('toggles the category header and shows completion counts', () => {
    const onToggle = vi.fn();

    render(
      <MobileITPCategoryHeader
        category="Earthworks"
        isExpanded={false}
        isComplete={false}
        completedCount={1}
        totalCount={4}
        onToggle={onToggle}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Earthworks/i }));

    expect(screen.getByText('1/4')).toBeVisible();
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows the photo-required count on a collapsed header, but not when expanded', () => {
    const { rerender } = render(
      <MobileITPCategoryHeader
        category="Earthworks"
        isExpanded={false}
        isComplete={false}
        completedCount={1}
        totalCount={4}
        photoRequiredCount={2}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('2 items need photos')).toBeVisible();

    rerender(
      <MobileITPCategoryHeader
        category="Earthworks"
        isExpanded={true}
        isComplete={false}
        completedCount={1}
        totalCount={4}
        photoRequiredCount={2}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('2 items need photos')).not.toBeInTheDocument();
  });

  it('delegates item row taps and quick-complete clicks', () => {
    const onTap = vi.fn();
    const onQuickComplete = vi.fn();

    render(
      <MobileITPItem
        item={checklistItem}
        status="pending"
        hasNotes={true}
        hasPhotos={false}
        photoCount={0}
        isUpdating={false}
        canComplete={true}
        onTap={onTap}
        onQuickComplete={onQuickComplete}
      />,
    );

    fireEvent.click(screen.getByText(/Check subgrade compaction/i));
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('Photo req')).toBeVisible();
    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onQuickComplete).toHaveBeenCalledTimes(1);
  });

  it('does not quick-complete non-editable or failed rows', () => {
    const onQuickComplete = vi.fn();

    render(
      <MobileITPItem
        item={{ ...checklistItem, pointType: 'hold_point' }}
        status="failed"
        hasNotes={false}
        hasPhotos={true}
        photoCount={2}
        isUpdating={false}
        canComplete={false}
        onTap={vi.fn()}
        onQuickComplete={onQuickComplete}
      />,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('2')).toBeVisible();
    expect(onQuickComplete).not.toHaveBeenCalled();
  });

  it('labels release-gated superintendent items and blocks quick-complete while release is required', () => {
    const onQuickComplete = vi.fn();

    render(
      <MobileITPItem
        item={{
          ...checklistItem,
          pointType: 'verification',
          responsibleParty: 'superintendent',
          isHoldPoint: false,
        }}
        status="pending"
        hasNotes={false}
        hasPhotos={false}
        photoCount={0}
        isUpdating={false}
        canComplete={false}
        releaseRequired={true}
        onTap={vi.fn()}
        onQuickComplete={onQuickComplete}
      />,
    );

    expect(screen.getByText('H')).toBeVisible();
    expect(screen.getByText('Release req')).toBeVisible();

    fireEvent.click(screen.getByRole('button'));

    expect(onQuickComplete).not.toHaveBeenCalled();
  });
});
