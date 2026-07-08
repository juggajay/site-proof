import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EvidencePackageModal } from './EvidencePackageModal';

describe('EvidencePackageModal', () => {
  it('prevents generating an empty evidence package', () => {
    const onGenerate = vi.fn();

    render(<EvidencePackageModal claimId="claim-1" onClose={vi.fn()} onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));

    const generateButton = screen.getByRole('button', { name: /Generate Package/i });
    expect(generateButton).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Select at least one section to generate an evidence package.',
    );

    fireEvent.click(generateButton);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('includes variations by default and allows excluding them from generation', () => {
    const onGenerate = vi.fn();

    render(<EvidencePackageModal claimId="claim-1" onClose={vi.fn()} onGenerate={onGenerate} />);

    const variationsCheckbox = screen.getByRole('checkbox', { name: /Variations/i });
    expect(variationsCheckbox).toBeChecked();

    fireEvent.click(variationsCheckbox);
    fireEvent.click(screen.getByRole('button', { name: /Generate Package/i }));

    expect(onGenerate).toHaveBeenCalledWith(
      'claim-1',
      expect.objectContaining({ includeVariations: false }),
    );
  });
});
