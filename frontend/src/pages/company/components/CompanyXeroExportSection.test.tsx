import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api';
import { CompanyXeroExportSection } from './CompanyXeroExportSection';
import type { Company } from '../companySettingsData';

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, apiFetch: vi.fn() };
});

const apiFetchMock = vi.mocked(apiFetch);

const company: Company = {
  id: 'co-1',
  name: 'Acme Civil',
  abn: null,
  address: null,
  logoUrl: null,
  subscriptionTier: 'basic',
  xeroAccountCode: '260',
  xeroTaxType: 'GST Free Income',
  projectCount: 1,
  projectLimit: null,
  userCount: 1,
  userLimit: null,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe('CompanyXeroExportSection', () => {
  it('seeds the inputs from the stored company settings', () => {
    render(<CompanyXeroExportSection company={company} onCompanyUpdated={vi.fn()} />);

    expect(screen.getByLabelText('Income account code')).toHaveValue('260');
    expect(screen.getByLabelText('GST rate name')).toHaveValue('GST Free Income');
  });

  it('saves both values with a partial PATCH', async () => {
    const onCompanyUpdated = vi.fn();
    apiFetchMock.mockResolvedValue({ company: { ...company, xeroAccountCode: '201' } });
    render(<CompanyXeroExportSection company={company} onCompanyUpdated={onCompanyUpdated} />);

    fireEvent.change(screen.getByLabelText('Income account code'), { target: { value: '201' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Xero settings' }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const [url, options] = apiFetchMock.mock.calls[0];
    expect(url).toBe('/api/company');
    expect(options?.method).toBe('PATCH');
    // Partial: only the Xero fields, so saving here cannot clobber name/ABN.
    expect(JSON.parse(String(options?.body))).toEqual({
      xeroAccountCode: '201',
      xeroTaxType: 'GST Free Income',
    });
    await waitFor(() => expect(onCompanyUpdated).toHaveBeenCalled());
  });

  it('sends null for a blank field so the export defaults apply', async () => {
    apiFetchMock.mockResolvedValue({ company });
    render(<CompanyXeroExportSection company={company} onCompanyUpdated={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Income account code'), { target: { value: '   ' } });
    fireEvent.change(screen.getByLabelText('GST rate name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Xero settings' }));

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(apiFetchMock.mock.calls[0][1]?.body))).toEqual({
      xeroAccountCode: null,
      xeroTaxType: null,
    });
  });

  it('surfaces a save failure instead of reporting success', async () => {
    apiFetchMock.mockRejectedValue(new Error('nope'));
    render(<CompanyXeroExportSection company={company} onCompanyUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save Xero settings' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Xero export settings saved.')).not.toBeInTheDocument();
  });
});
