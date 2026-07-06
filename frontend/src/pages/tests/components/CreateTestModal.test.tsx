import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateTestModal } from './CreateTestModal';

describe('CreateTestModal — requirement-first entry (satisfiesItem)', () => {
  it('shows the Satisfies ITP item banner and submits with itpChecklistItemId', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateTestModal
        isOpen
        onClose={vi.fn()}
        onSuccess={onSuccess}
        lots={[]}
        projectState=""
        satisfiesItem={{ id: 'itp-1', description: 'Compaction density' }}
      />,
    );

    // Context banner surfaces the linked ITP item description.
    expect(screen.getByText(/Satisfies ITP item:/i)).toBeInTheDocument();
    expect(screen.getByText('Compaction density')).toBeInTheDocument();

    // Fill the one required field and submit.
    await user.type(screen.getByLabelText(/Test Type/i), 'Density Ratio');
    await user.click(screen.getByRole('button', { name: /Create Test Result/i }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess.mock.calls[0][0]).toMatchObject({
      testType: 'Density Ratio',
      itpChecklistItemId: 'itp-1',
    });
  });
});
