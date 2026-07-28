import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { FindByAreaPanel } from './FindByAreaPanel';
import { buildMapLinkPaths } from './lotMapHelpers';
import type { SpatialSearchResult, SpatialTestResult } from './spatialSearchData';

vi.mock('@/components/documents/SecureDocumentImage', () => ({
  SecureDocumentImage: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));

function test_(over: Partial<SpatialTestResult> = {}): SpatialTestResult {
  return {
    id: 'tr-1',
    status: 'verified',
    lotId: 'lot-1',
    lotNumber: 'L-001',
    testType: 'Density Ratio',
    testRequestNumber: null,
    sampleLatitude: null,
    sampleLongitude: null,
    sampleLocationSource: null,
    sampleLocationAccuracyM: null,
    ...over,
  };
}

function renderPanel(testResults: SpatialTestResult[]) {
  const result: SpatialSearchResult = {
    lots: [],
    lotsTruncated: false,
    photos: [],
    photosTruncated: false,
    testResults,
    testResultsTruncated: false,
  };
  render(
    <MemoryRouter>
      <FindByAreaPanel
        result={result}
        isLoading={false}
        error={null}
        isMobile={false}
        linkPaths={buildMapLinkPaths('proj-1', undefined)}
        onClear={vi.fn()}
        onRetry={vi.fn()}
      />
    </MemoryRouter>,
  );
}

// Wave C3 Phase B2 §5.5. Unlocated tests are COUNTED, never drawn `[C3S-B1]`.
// This panel is the one surface where both halves of the split are real numbers:
// it holds every test on the intersecting lots. The pin layer's `only=tests` bbox
// cannot compute the denominator, because a test with no coordinate is not "in
// view" of anything.
describe('FindByAreaPanel — located / unlocated test split', () => {
  it('counts tests with and without a captured sample point', () => {
    renderPanel([
      test_({ id: 'tr-1', sampleLatitude: -33.8, sampleLongitude: 151.0 }),
      test_({ id: 'tr-2', sampleLatitude: -33.81, sampleLongitude: 151.01 }),
      test_({ id: 'tr-3' }),
      // Half a coordinate is not a location — it counts as "without".
      test_({ id: 'tr-4', sampleLatitude: -33.82 }),
    ]);

    expect(screen.getByTestId('find-by-area-test-locations')).toHaveTextContent(
      '2 with a captured location · 2 without',
    );
    // Every test is still listed — an absent location hides nothing.
    for (const id of ['tr-1', 'tr-2', 'tr-3', 'tr-4']) {
      expect(screen.getByTestId(`find-by-area-test-${id}`)).toBeInTheDocument();
    }
  });

  it('omits the split line when the area holds no tests', () => {
    renderPanel([]);
    expect(screen.queryByTestId('find-by-area-test-locations')).not.toBeInTheDocument();
  });
});
