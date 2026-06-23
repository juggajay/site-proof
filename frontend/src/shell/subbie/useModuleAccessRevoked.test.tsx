import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { isAccessRevokedError, useModuleAccessRevoked } from './useModuleAccessRevoked';
import { ModuleAccessChangedNotice } from './ModuleAccessChangedNotice';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

describe('isAccessRevokedError (M53)', () => {
  it('is true only for a 403 ApiError', () => {
    expect(isAccessRevokedError(new ApiError(403, 'forbidden'))).toBe(true);
    expect(isAccessRevokedError(new ApiError(500, 'oops'))).toBe(false);
    expect(isAccessRevokedError(new Error('network'))).toBe(false);
    expect(isAccessRevokedError(null)).toBe(false);
  });
});

describe('useModuleAccessRevoked (M53)', () => {
  let queryClient: QueryClient;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('returns true and invalidates the portal-companies cache on a 403', () => {
    const { result } = renderHook(() => useModuleAccessRevoked(new ApiError(403, 'forbidden')), {
      wrapper,
    });

    expect(result.current).toBe(true);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.portalCompanies('user-1') });
  });

  it('returns false and does not invalidate for non-403 errors', () => {
    const { result } = renderHook(() => useModuleAccessRevoked(new ApiError(500, 'oops')), {
      wrapper,
    });

    expect(result.current).toBe(false);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe('ModuleAccessChangedNotice (M53)', () => {
  it('renders a consistent access-changed alert', () => {
    render(<ModuleAccessChangedNotice />);
    expect(screen.getByRole('alert')).toHaveTextContent(/your access to this section has changed/i);
  });
});
