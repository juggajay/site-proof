import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AboutSection,
  AppearanceSection,
  CompanyMembershipSection,
  PrivacyDataSection,
  RegionalSettingsSection,
} from './SettingsSections';

describe('AppearanceSection', () => {
  it('shows the current theme and reports theme changes', () => {
    const onThemeChange = vi.fn();
    render(<AppearanceSection theme="system" resolvedTheme="dark" onThemeChange={onThemeChange} />);

    expect(
      screen.getByText(
        (_, element) =>
          element?.textContent === 'Current theme: Dark (following system preference)',
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Light theme' }));
    expect(onThemeChange).toHaveBeenCalledWith('light');
  });
});

describe('RegionalSettingsSection', () => {
  it('renders date/time previews and reports preference changes', () => {
    const onDateFormatChange = vi.fn();
    const onTimezoneChange = vi.fn();
    render(
      <RegionalSettingsSection
        dateFormat="DD/MM/YYYY"
        onDateFormatChange={onDateFormatChange}
        formatDate={() => '31/12/2024'}
        timezone="Australia/Sydney"
        onTimezoneChange={onTimezoneChange}
        formatTime={() => '10:30 am'}
      />,
    );

    expect(screen.getByText('31/12/2024')).toBeInTheDocument();
    expect(screen.getByText('10:30 am')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'YYYY-MM-DD date format' }));
    expect(onDateFormatChange).toHaveBeenCalledWith('YYYY-MM-DD');

    fireEvent.change(screen.getByLabelText(/Timezone/i), {
      target: { value: 'Australia/Perth' },
    });
    expect(onTimezoneChange).toHaveBeenCalledWith('Australia/Perth');
  });
});

describe('PrivacyDataSection', () => {
  it('shows export status, errors, and destructive account action', () => {
    const onExportData = vi.fn();
    const onDeleteAccountClick = vi.fn();
    render(
      <PrivacyDataSection
        isExporting={false}
        exportSuccess
        exportError="Export failed"
        onExportData={onExportData}
        onDeleteAccountClick={onDeleteAccountClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export My Data' }));
    expect(onExportData).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Data exported successfully');
    expect(screen.getByRole('alert')).toHaveTextContent('Export failed');
    expect(screen.getByText(/Project records that must be retained/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete My Account' }));
    expect(onDeleteAccountClick).toHaveBeenCalledTimes(1);
  });

  it('explains when account deletion is blocked for a company owner', () => {
    const onDeleteAccountClick = vi.fn();
    render(
      <PrivacyDataSection
        isExporting={false}
        exportSuccess={false}
        exportError={null}
        onExportData={vi.fn()}
        onDeleteAccountClick={onDeleteAccountClick}
        deleteAccountBlockedReason="Transfer company ownership first."
      />,
    );

    expect(screen.getByRole('button', { name: 'Delete My Account' })).toBeDisabled();
    expect(screen.getByText('Transfer company ownership first.')).toBeInTheDocument();
  });
});

describe('CompanyMembershipSection', () => {
  it('renders the current company and opens the leave-company flow', () => {
    const onLeaveCompanyClick = vi.fn();
    render(
      <CompanyMembershipSection
        companyName="Acme Civil"
        onLeaveCompanyClick={onLeaveCompanyClick}
      />,
    );

    expect(screen.getByText('Acme Civil')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Leave Company' }));
    expect(onLeaveCompanyClick).toHaveBeenCalledTimes(1);
  });

  it('explains when leaving is blocked for a company owner', () => {
    const onLeaveCompanyClick = vi.fn();
    render(
      <CompanyMembershipSection
        companyName="Acme Civil"
        onLeaveCompanyClick={onLeaveCompanyClick}
        leaveCompanyBlockedReason="Transfer company ownership first."
      />,
    );

    expect(screen.getByRole('button', { name: 'Leave Company' })).toBeDisabled();
    expect(screen.getByText('Transfer company ownership first.')).toBeInTheDocument();
  });
});

describe('AboutSection', () => {
  it('renders app version metadata', () => {
    render(<AboutSection />);

    expect(screen.getByText('1.3.0')).toBeInTheDocument();
    expect(screen.getByText('2026-01-18')).toBeInTheDocument();
    expect(screen.getByText('20260118.1')).toBeInTheDocument();
  });
});
