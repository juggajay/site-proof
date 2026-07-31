import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TemplateProvenance } from './TemplateProvenance';

describe('TemplateProvenance', () => {
  it('renders nothing when the library asserts nothing', () => {
    // Most jurisdictions' seeders name a specification without naming an
    // edition. A blank line is the honest rendering of that, and this test is
    // what stops a later pass filling it with a placeholder.
    const { container } = render(<TemplateProvenance authority={null} specEdition={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('states only the facts it was given', () => {
    render(<TemplateProvenance authority="MRWA" specEdition={null} specIssuedOn={null} />);
    expect(screen.getByText('MRWA')).toBeInTheDocument();
  });

  it('joins authority, edition and dates in reading order', () => {
    render(
      <TemplateProvenance
        authority="MRWA"
        specEdition="04/10099-03"
        specIssuedOn="2024-06-28T00:00:00.000Z"
      />,
    );
    // Month spelling comes from the runtime's ICU data, so the assertion pins
    // the order and the separators, not the locale's abbreviation.
    expect(
      screen.getByText(/^MRWA · edition 04\/10099-03 · issued 28 Jun\w* 2024$/),
    ).toBeInTheDocument();
  });

  it('ignores an unparseable date rather than printing "Invalid Date"', () => {
    render(<TemplateProvenance authority="TMR" specIssuedOn="not-a-date" />);
    expect(screen.getByText('TMR')).toBeInTheDocument();
  });

  it('shows the annexure caveat naming the specification it follows', () => {
    render(
      <TemplateProvenance
        authority="MRWA"
        specEdition="04/10111"
        specificationReference="MRWA Spec 503"
        annexureWarning
      />,
    );
    expect(screen.getByText(/MRWA Spec 503 04\/10111/)).toBeInTheDocument();
    expect(screen.getByText(/check your contract annexure/)).toBeInTheDocument();
  });

  it('shows the annexure caveat even when no edition or authority is known', () => {
    render(<TemplateProvenance annexureWarning />);
    expect(screen.getByText(/the published specification/)).toBeInTheDocument();
  });
});
