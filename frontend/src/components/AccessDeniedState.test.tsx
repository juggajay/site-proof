import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/renderWithProviders';
import { ROLE_GROUPS } from '@/lib/roles';
import { AccessDeniedState } from './AccessDeniedState';

describe('AccessDeniedState', () => {
  it('does not render a required-roles line by default', () => {
    renderWithProviders(<AccessDeniedState />);

    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    expect(screen.queryByText(/^Requires /)).not.toBeInTheDocument();
  });

  it('names the required roles when given the requiredRoles context', () => {
    renderWithProviders(<AccessDeniedState requiredRoles={ROLE_GROUPS.COMMERCIAL} />);

    expect(
      screen.getByText('Requires Owner, Administrator or Project Manager.'),
    ).toBeInTheDocument();
  });
});
