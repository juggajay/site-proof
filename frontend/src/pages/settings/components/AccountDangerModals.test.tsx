import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AccountDangerModals } from './AccountDangerModals';

describe('AccountDangerModals', () => {
  it('describes account deletion as anonymising retained project records', () => {
    render(
      <AccountDangerModals
        userEmail="delete-user@example.com"
        companyName="Acme Civil"
        showDeleteModal
        deleteConfirmEmail=""
        deletePassword=""
        isDeleting={false}
        deleteError={null}
        deletePasswordRequired
        deleteConfirmationMatches={false}
        canDeleteAccount={false}
        showLeaveCompanyModal={false}
        isLeavingCompany={false}
        leaveCompanyError={null}
        onDeleteConfirmEmailChange={vi.fn()}
        onDeletePasswordChange={vi.fn()}
        onDeleteModalClose={vi.fn()}
        onDeleteAccount={vi.fn()}
        onLeaveCompanyModalClose={vi.fn()}
        onLeaveCompany={vi.fn()}
      />,
    );

    expect(screen.getByText(/Project records retained for compliance/i)).toBeInTheDocument();
    expect(screen.getByText(/anonymised where records must be kept/i)).toBeInTheDocument();
    expect(screen.queryByText(/ITP completions you've made/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Other user-created content/i)).not.toBeInTheDocument();
  });
});
