import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CommentAttachmentDraftList } from './CommentAttachmentDraftList';
import { type PendingAttachment } from './commentAttachmentDrafts';

const imageDraft: PendingAttachment = {
  file: new File(['x'], 'photo.png', { type: 'image/png' }),
  preview: 'blob:photo-preview',
};
const documentDraft: PendingAttachment = {
  file: new File(['x'], 'spec.pdf', { type: 'application/pdf' }),
};

describe('CommentAttachmentDraftList', () => {
  it('renders nothing when there are no drafts', () => {
    const { container } = render(
      <CommentAttachmentDraftList attachments={[]} onRemove={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows an image preview only for drafts that have one', () => {
    const { container } = render(
      <CommentAttachmentDraftList attachments={[imageDraft, documentDraft]} onRemove={vi.fn()} />,
    );

    const previews = container.querySelectorAll('img');
    expect(previews).toHaveLength(1);
    expect(previews[0]).toHaveAttribute('src', 'blob:photo-preview');
    expect(screen.getByText('photo.png')).toBeInTheDocument();
    expect(screen.getByText('spec.pdf')).toBeInTheDocument();
  });

  it('reports the draft index when its remove button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <CommentAttachmentDraftList attachments={[imageDraft, documentDraft]} onRemove={onRemove} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove spec.pdf' }));

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(1);
  });
});
