import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RegistrationSidePanel, type ChainageControlLine } from './RegistrationSidePanel';

const CONTROL_LINE: ChainageControlLine = {
  id: 'cl-1',
  name: 'MC00 Mainline',
  coordinateSystem: 'EPSG:7856',
  points: [
    { chainage: 0, easting: 500000, northing: 6250000 },
    { chainage: 1500, easting: 500010, northing: 6251500 },
  ],
};

function renderPanel(controlLines: ChainageControlLine[]) {
  render(
    <RegistrationSidePanel
      points={[]}
      fit={null}
      residualByIndex={new Map()}
      loadingSheet={false}
      allPlacedComplete={false}
      canSave={false}
      saving={false}
      hasRegistration={false}
      controlLines={controlLines}
      sheetCoordinateSystem="EPSG:7856"
      onRemovePoint={() => {}}
      onUpdateCoord={() => {}}
      onSave={() => {}}
      onClear={() => {}}
    />,
  );
}

describe('RegistrationSidePanel empty-state copy', () => {
  it('mentions the From-chainage path when a control line exists', () => {
    renderPanel([CONTROL_LINE]);
    expect(screen.getByText(/From chainage/)).toBeInTheDocument();
    expect(screen.queryByText(/Add one under Control Lines/)).not.toBeInTheDocument();
  });

  it('points to Control Lines instead when there is no control line', () => {
    renderPanel([]);
    expect(screen.getByText(/No control line yet\?/)).toBeInTheDocument();
    expect(screen.queryByText(/use .From chainage/)).not.toBeInTheDocument();
  });
});
