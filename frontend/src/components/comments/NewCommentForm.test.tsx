import { createRef } from 'react';
import { type FormEvent } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewCommentForm } from './NewCommentForm';
import { type PendingAttachment } from './commentAttachmentDrafts';

function makeAttachment(name: string): PendingAttachment {
  return {
    file: new File(['x'], name, { type: 'image/png' }),
    preview: `blob:${name}`,
  };
}

describe('NewCommentForm', () => {
  it('disables submit until the comment has non-whitespace content', () => {
    const fileInputRef = createRef<HTMLInputElement>();

    const { rerender } = render(
      <NewCommentForm
        comment="   "
        submitting={false}
        attachments={[]}
        fileInputRef={fileInputRef}
        onCommentChange={vi.fn()}
        onSubmit={vi.fn()}
        onFileSelect={vi.fn()}
        onRemoveAttachment={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Post Comment/ })).toBeDisabled();

    rerender(
      <NewCommentForm
        comment="Ready"
        submitting={false}
        attachments={[]}
        fileInputRef={fileInputRef}
        onCommentChange={vi.fn()}
        onSubmit={vi.fn()}
        onFileSelect={vi.fn()}
        onRemoveAttachment={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Post Comment/ })).toBeEnabled();
  });

  it('surfaces draft attachments and delegates removal by index', () => {
    const onRemoveAttachment = vi.fn();

    render(
      <NewCommentForm
        comment="Ready"
        submitting={false}
        attachments={[makeAttachment('photo-a.png'), makeAttachment('photo-b.png')]}
        fileInputRef={createRef<HTMLInputElement>()}
        onCommentChange={vi.fn()}
        onSubmit={vi.fn()}
        onFileSelect={vi.fn()}
        onRemoveAttachment={onRemoveAttachment}
      />,
    );

    expect(screen.getByText('photo-a.png')).toBeVisible();
    expect(screen.getByText('photo-b.png')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Remove photo-b.png' }));

    expect(onRemoveAttachment).toHaveBeenCalledWith(1);
  });

  it('delegates textarea, file input, and submit events to the parent', () => {
    const onCommentChange = vi.fn();
    const onFileSelect = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    const { container } = render(
      <NewCommentForm
        comment="Ready"
        submitting={false}
        attachments={[]}
        fileInputRef={createRef<HTMLInputElement>()}
        onCommentChange={onCommentChange}
        onSubmit={onSubmit}
        onFileSelect={onFileSelect}
        onRemoveAttachment={vi.fn()}
      />,
    );
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Add a comment/), {
      target: { value: 'Updated' },
    });
    fireEvent.change(fileInput!, {
      target: { files: [new File(['x'], 'note.png', { type: 'image/png' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: /Post Comment/ }));

    expect(onCommentChange).toHaveBeenCalledWith('Updated');
    expect(onFileSelect).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
