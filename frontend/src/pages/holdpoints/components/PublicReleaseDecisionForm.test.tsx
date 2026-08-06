/**
 * Benchmark T3 — the approver's verbs.
 *
 * Before this, a superintendent who wanted to say "no", or "yes but", had one
 * button that said Release. These tests pin the three things that make the new
 * form worth having: the verb set, the comment minimum with its live counter,
 * and the status-after preview that stops anyone committing blind.
 */
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  isDecisionCommentSufficient,
  MIN_DECISION_COMMENT_LENGTH,
  PublicReleaseDecisionForm,
  type PublicReleaseDecision,
} from './PublicReleaseDecisionForm';

// The signature pad draws to a canvas jsdom does not implement; the form only
// cares whether a signature exists.
vi.mock('@/components/ui/SignaturePad', () => ({
  SignaturePad: ({ onChange }: { onChange: (value: string | null) => void }) => (
    <button type="button" onClick={() => onChange('data:image/png;base64,AAA')}>
      Sign
    </button>
  ),
}));

function Harness({ onSubmit = vi.fn() }: { onSubmit?: () => void }) {
  const [decision, setDecision] = useState<PublicReleaseDecision>('release');
  const [comment, setComment] = useState('');
  const [signature, setSignature] = useState<string | null>(null);

  return (
    <PublicReleaseDecisionForm
      decision={decision}
      onDecisionChange={setDecision}
      releasedByName="Amos Soo"
      onReleasedByNameChange={vi.fn()}
      releasedByOrg=""
      onReleasedByOrgChange={vi.fn()}
      comment={comment}
      onCommentChange={setComment}
      signatureDataUrl={signature}
      onSignatureChange={setSignature}
      tokenRecipientName="Amos Soo"
      canAction
      submitting={false}
      submitError={null}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    />
  );
}

const LONG_ENOUGH = 'Compaction results do not meet the specified 95% RDD.';

describe('isDecisionCommentSufficient', () => {
  it('lets a plain release go without a comment', () => {
    expect(isDecisionCommentSufficient('release', '')).toBe(true);
  });

  it('holds conditions and rejections to the stated minimum, after trimming', () => {
    expect(isDecisionCommentSufficient('reject', 'too short')).toBe(false);
    expect(isDecisionCommentSufficient('release_with_conditions', '  short  ')).toBe(false);
    expect(isDecisionCommentSufficient('reject', LONG_ENOUGH)).toBe(true);
    expect(LONG_ENOUGH.length).toBeGreaterThanOrEqual(MIN_DECISION_COMMENT_LENGTH);
  });
});

describe('PublicReleaseDecisionForm', () => {
  it('offers all three verbs, not just Release', () => {
    render(<Harness />);

    expect(screen.getByRole('radio', { name: 'Release' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Release with conditions' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Reject' })).toBeInTheDocument();
  });

  it('previews where each verb lands before the approver commits', async () => {
    render(<Harness />);

    expect(screen.getByText(/Released — the contractor may proceed/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Reject' }));
    expect(
      screen.getByText(/Rejected — sent back to the contractor with your reason/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Release with conditions' }));
    expect(screen.getByText(/with your conditions recorded/)).toBeInTheDocument();
  });

  it('counts the comment live against the stated minimum', async () => {
    render(<Harness />);

    // A plain release asks for nothing, so there is no counter to read.
    expect(screen.queryByText(/min 25/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Reject' }));
    expect(screen.getByText('0 characters - min 25')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Reason for rejection/i), 'nope');
    expect(screen.getByText('4 characters - min 25')).toBeInTheDocument();
  });

  it('will not submit a rejection until the reason is long enough', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: 'Sign' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Reject' }));

    const submit = screen.getByRole('button', { name: /Reject hold point/i });
    await userEvent.type(screen.getByLabelText(/Reason for rejection/i), 'nope');
    expect(submit).toBeDisabled();

    await userEvent.clear(screen.getByLabelText(/Reason for rejection/i));
    await userEvent.type(screen.getByLabelText(/Reason for rejection/i), LONG_ENOUGH);
    expect(submit).toBeEnabled();

    await userEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('requires a signature on every verb, including a plain release', async () => {
    render(<Harness />);

    expect(screen.getByRole('button', { name: /Release hold point/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Sign' }));
    expect(screen.getByRole('button', { name: /Release hold point/i })).toBeEnabled();
  });

  it('renames the comment field to match the verb', async () => {
    render(<Harness />);

    expect(screen.getByLabelText(/Release notes \(optional\)/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Release with conditions' }));
    expect(screen.getByLabelText(/^Conditions/i)).toBeInTheDocument();
  });
});
