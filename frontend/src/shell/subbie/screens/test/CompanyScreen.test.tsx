/**
 * Tests for the subbie shell CompanyScreen (/p/company).
 *
 * MOCKS @/lib/useOfflineStatus, the my-company data hook (useMyCompanyQuery), and
 * the BottomSheet (rendered inline when open so its form fields are queryable).
 * apiFetch + context mocked per test. Deletes are two-tap armed confirms
 * (the readiness guardrail forbids window.confirm).
 *
 * Pins:
 *   - admin vs non-admin: plain subcontractor sees NO add/delete + footer note
 *   - add-employee exact POST payload (after parseRateInput)
 *   - add-plant exact POST payload (dry required, wet optional)
 *   - parseRateInput rejects an invalid rate BEFORE any POST
 *   - delete employee/plant hit the classic endpoints with ?projectId=
 *   - counter badge shows the countered rate inline
 *   - pending-approvals notice presence logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { SubbieShellData } from '../../subbieShellData';
import type { CompanyData } from '@/pages/subcontractors/myCompanyData';
import { DEFAULT_PORTAL_ACCESS } from '@/pages/subcontractor-portal/portalAccessModel';

vi.mock('@/lib/useOfflineStatus', () => ({
  useOfflineStatus: () => ({ isOnline: true, pendingSyncCount: 0, isSyncing: false }),
}));

let _role = 'subcontractor';
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', fullName: 'Mick', role: _role } }),
}));

const apiFetchMock = vi.fn().mockResolvedValue({});
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetchMock(...a) }));

// my-company data hook — controlled per test.
let _companyData: CompanyData | null;
vi.mock('@/pages/subcontractors/myCompanyData', async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    useMyCompanyQuery: () => ({ data: _companyData, isLoading: false, error: null }),
  };
});

// Render BottomSheet children inline whenever open so form fields are reachable.
vi.mock('@/components/foreman/sheets/BottomSheet', () => ({
  BottomSheet: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

let _ctx: SubbieShellData;
vi.mock('../../subbieShellContext', () => ({ useSubbieShellContext: () => _ctx }));

import { CompanyScreen } from '../CompanyScreen';

function ctx(): SubbieShellData {
  return {
    projectId: 'proj-1',
    company: null,
    companyName: 'Hargraves Earthmoving',
    projectName: 'Demo',
    availableProjects: [],
    loading: false,
    loadError: null,
    isModuleEnabled: (m) => DEFAULT_PORTAL_ACCESS[m],
  };
}

function company(over: Partial<CompanyData> = {}): CompanyData {
  return {
    id: 'c1',
    companyName: 'Hargraves Earthmoving',
    abn: '51 824 753 556',
    projectId: 'proj-1',
    projectName: 'Demo',
    primaryContactName: 'Mick',
    primaryContactEmail: 'm@x.com',
    primaryContactPhone: '',
    status: 'active',
    availableProjects: [],
    employees: [],
    plant: [],
    ...over,
  };
}

function renderScreen() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/p/company']}>
        <CompanyScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('subbie shell CompanyScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _role = 'subcontractor';
    _ctx = ctx();
    _companyData = company();
    apiFetchMock.mockResolvedValue({});
  });

  it('plain subcontractor sees no add/delete affordances + footer note', () => {
    _companyData = company({
      employees: [
        { id: 'e1', name: 'Mick', phone: '', role: 'Operator', hourlyRate: 98, status: 'approved' },
      ],
    });
    renderScreen();
    expect(screen.queryByRole('button', { name: /Add crew member/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Remove Mick/i })).toBeNull();
    expect(
      screen.getByText(/Adding and removing crew or plant needs a company admin login/i),
    ).toBeInTheDocument();
  });

  it('subcontractor_admin sees add buttons', () => {
    _role = 'subcontractor_admin';
    renderScreen();
    expect(screen.getByRole('button', { name: /Add crew member/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add plant/i })).toBeInTheDocument();
  });

  it('add-employee POSTs the exact payload after parseRateInput', async () => {
    _role = 'subcontractor_admin';
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Add crew member/i }));
    const sheet = screen.getByRole('dialog', { name: 'Add crew member' });
    fireEvent.change(within(sheet).getByLabelText('Name *'), {
      target: { value: '  Dane Carter ' },
    });
    fireEvent.change(within(sheet).getByLabelText('Phone'), { target: { value: '0412' } });
    fireEvent.change(within(sheet).getByLabelText('Role *'), { target: { value: 'Labourer' } });
    fireEvent.change(within(sheet).getByLabelText('Proposed Hourly Rate *'), {
      target: { value: '62' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add crew member' }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/subcontractors/my-company/employees', {
        method: 'POST',
        body: JSON.stringify({
          projectId: 'proj-1',
          subcontractorCompanyId: 'c1',
          name: 'Dane Carter',
          phone: '0412',
          role: 'Labourer',
          hourlyRate: 62,
        }),
      }),
    );
  });

  it('rejects an invalid hourly rate before POST', async () => {
    _role = 'subcontractor_admin';
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Add crew member/i }));
    const sheet = screen.getByRole('dialog', { name: 'Add crew member' });
    fireEvent.change(within(sheet).getByLabelText('Name *'), { target: { value: 'Dane' } });
    fireEvent.change(within(sheet).getByLabelText('Role *'), { target: { value: 'Labourer' } });
    fireEvent.change(within(sheet).getByLabelText('Proposed Hourly Rate *'), {
      target: { value: 'abc' },
    });
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add crew member' }));

    await waitFor(() => expect(within(sheet).getByRole('alert')).toBeInTheDocument());
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('add-plant POSTs the exact payload (dry required, wet optional/zero)', async () => {
    _role = 'subcontractor_admin';
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Add plant/i }));
    const sheet = screen.getByRole('dialog', { name: 'Add plant' });
    fireEvent.change(within(sheet).getByLabelText('Type *'), { target: { value: 'Excavator' } });
    fireEvent.change(within(sheet).getByLabelText('Description *'), {
      target: { value: 'CAT 320' },
    });
    fireEvent.change(within(sheet).getByLabelText('ID/Rego'), { target: { value: 'EXC-014' } });
    fireEvent.change(within(sheet).getByLabelText('Dry Rate *'), { target: { value: '180' } });
    // wet left blank → allowZero → 0
    fireEvent.click(within(sheet).getByRole('button', { name: 'Add plant' }));

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith('/api/subcontractors/my-company/plant', {
        method: 'POST',
        body: JSON.stringify({
          projectId: 'proj-1',
          subcontractorCompanyId: 'c1',
          type: 'Excavator',
          description: 'CAT 320',
          idRego: 'EXC-014',
          dryRate: 180,
          wetRate: 0,
        }),
      }),
    );
  });

  it('delete employee is two-tap (arm, then DELETE on the classic endpoint with ?projectId=)', async () => {
    _role = 'subcontractor_admin';
    _companyData = company({
      employees: [
        {
          id: 'e9',
          name: 'Tommy',
          phone: '',
          role: 'Pipe Layer',
          hourlyRate: 74,
          status: 'pending',
        },
      ],
    });
    renderScreen();
    const removeBtn = screen.getByRole('button', { name: /Remove Tommy/i });

    // First tap arms only — no DELETE yet, button asks for confirmation.
    fireEvent.click(removeBtn);
    expect(removeBtn).toHaveTextContent('Remove?');
    expect(apiFetchMock).not.toHaveBeenCalledWith(
      '/api/subcontractors/my-company/employees/e9?projectId=proj-1&subcontractorCompanyId=c1',
      { method: 'DELETE' },
    );

    fireEvent.click(removeBtn);
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith(
        '/api/subcontractors/my-company/employees/e9?projectId=proj-1&subcontractorCompanyId=c1',
        { method: 'DELETE' },
      ),
    );
  });

  it('shows the pending-approvals notice when any row is pending', () => {
    _companyData = company({
      employees: [
        {
          id: 'e1',
          name: 'Tommy',
          phone: '',
          role: 'Pipe Layer',
          hourlyRate: 74,
          status: 'pending',
        },
      ],
    });
    renderScreen();
    expect(screen.getByText(/waiting on approval/i)).toBeInTheDocument();
    expect(screen.getByText(/can’t go on dockets until the head contractor/i)).toBeInTheDocument();
  });

  it('hides the pending-approvals notice when everything is approved', () => {
    _companyData = company({
      employees: [
        { id: 'e1', name: 'Mick', phone: '', role: 'Operator', hourlyRate: 98, status: 'approved' },
      ],
    });
    renderScreen();
    expect(screen.queryByText(/waiting on approval/i)).toBeNull();
  });

  it('renders a COUNTER badge with the countered rate inline', () => {
    _companyData = company({
      plant: [
        {
          id: 'p1',
          type: 'Water Cart',
          description: 'Water Cart 14kL',
          idRego: 'WC-002',
          dryRate: 0,
          wetRate: 95,
          // counter status + countered rate are read defensively (not in the
          // narrow CompanyData type, present on the wire when the HC counters).
          status: 'counter',
          counterDryRate: 88,
        } as unknown as CompanyData['plant'][number],
      ],
    });
    renderScreen();
    expect(screen.getByText('COUNTER')).toBeInTheDocument();
    expect(screen.getByText(/HC countered/i)).toBeInTheDocument();
    expect(screen.getByText('$88')).toBeInTheDocument();
  });
});
