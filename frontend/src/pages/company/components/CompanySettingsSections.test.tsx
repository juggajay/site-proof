import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Company, CompanyFormData } from '../companySettingsData';
import {
  CompanyAccountInformationCard,
  CompanyBillingSection,
  CompanyInformationCard,
  TransferOwnershipCard,
} from './CompanySettingsSections';

const company: Company = {
  id: 'company-123',
  name: 'Acme Civil',
  abn: '51 824 753 556',
  address: '1 Test Road',
  logoUrl: 'https://example.com/logo.png',
  subscriptionTier: 'professional',
  projectCount: 2,
  projectLimit: 3,
  userCount: 4,
  userLimit: 5,
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-02T00:00:00.000Z',
};

function CompanyInformationHarness({
  initialFormData = {
    name: company.name,
    abn: company.abn ?? '',
    address: company.address ?? '',
    logoUrl: company.logoUrl ?? '',
  },
  onLogoUpload = vi.fn(),
  onLogoFileChange = vi.fn(),
  onSaveSettings = vi.fn(),
}: {
  initialFormData?: CompanyFormData;
  onLogoUpload?: () => void;
  onLogoFileChange?: Parameters<typeof CompanyInformationCard>[0]['onLogoFileChange'];
  onSaveSettings?: () => void;
}) {
  const [formData, setFormData] = useState(initialFormData);
  const logoInputRef = useRef<HTMLInputElement>(null);

  return (
    <CompanyInformationCard
      company={company}
      formData={formData}
      saving={false}
      logoUploading={false}
      saveError=""
      statusMessage=""
      logoInputRef={logoInputRef}
      onFormDataChange={setFormData}
      onLogoUpload={onLogoUpload}
      onLogoFileChange={onLogoFileChange}
      onSaveSettings={onSaveSettings}
    />
  );
}

describe('CompanyInformationCard', () => {
  it('renders editable company profile fields and keeps changes local', () => {
    render(<CompanyInformationHarness />);

    const nameInput = screen.getByLabelText('Company Name *');
    fireEvent.change(nameInput, { target: { value: 'Acme Civil Updated' } });

    expect(nameInput).toHaveValue('Acme Civil Updated');
    expect(screen.getByLabelText('ABN')).toHaveValue('51 824 753 556');
    expect(screen.getByLabelText('Address')).toHaveValue('1 Test Road');
  });

  it('renders logo controls and reports save/upload actions', () => {
    const onLogoUpload = vi.fn();
    const onSaveSettings = vi.fn();
    render(
      <CompanyInformationHarness onLogoUpload={onLogoUpload} onSaveSettings={onSaveSettings} />,
    );

    expect(screen.getByAltText('Company logo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change Logo' }));
    expect(onLogoUpload).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
    expect(onSaveSettings).toHaveBeenCalledTimes(1);
  });

  it('removes the logo from the local form buffer', () => {
    render(<CompanyInformationHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.queryByAltText('Company logo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload Logo' })).toBeInTheDocument();
  });
});

describe('CompanyAccountInformationCard', () => {
  it('renders company account identifiers and Australian dates', () => {
    render(<CompanyAccountInformationCard company={company} />);

    expect(screen.getByText('company-123')).toBeInTheDocument();
    expect(screen.getByText('01/05/2026')).toBeInTheDocument();
    expect(screen.getByText('02/05/2026')).toBeInTheDocument();
  });
});

describe('CompanyBillingSection', () => {
  it('renders plan limits and billing support links', () => {
    render(<CompanyBillingSection company={company} supportEmail="billing@example.com" />);

    expect(screen.getByText('professional')).toBeInTheDocument();
    expect(screen.getByText('$99/month')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.getByText('4 / 5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact Us to Add Capacity' })).toHaveAttribute(
      'href',
      expect.stringContaining('billing@example.com'),
    );
  });
});

describe('TransferOwnershipCard', () => {
  it('surfaces the ownership warning and opens the transfer flow', () => {
    const onOpenTransferModal = vi.fn();
    render(<TransferOwnershipCard onOpenTransferModal={onOpenTransferModal} />);

    expect(screen.getByText(/Cannot be undone/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Transfer Ownership' }));
    expect(onOpenTransferModal).toHaveBeenCalledTimes(1);
  });
});
