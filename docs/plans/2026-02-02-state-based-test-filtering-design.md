# State-Based Test Form Filtering

## Overview

Filter test methods and specification references in the test result form based on the project's state setting. NSW projects only see TfNSW options, QLD projects see TMR options, VIC projects see VicRoads options.

## Implementation

### Data Flow

1. `TestResultsPage` fetches project data on load (added to existing parallel fetch)
2. Project `state` field stored in component state (`projectState`)
3. Datalists dynamically render based on `projectState`

### Configuration Objects

```typescript
const stateTestMethods = {
  NSW: { label: 'NSW (TfNSW)', methods: ['TfNSW T111', ...] },
  QLD: { label: 'QLD (TMR)', methods: ['TMR Q102A', ...] },
  VIC: { label: 'VIC (VicRoads)', methods: ['RC 500.01', ...] },
}

const stateSpecRefs = {
  NSW: { label: 'NSW (TfNSW)', specs: ['TfNSW R44', ...] },
  QLD: { label: 'QLD (TMR)', specs: ['MRTS04', ...] },
  VIC: { label: 'VIC (VicRoads)', specs: ['Section 204', ...] },
}
```

### Always Visible

- **Australian Standards**: AS 1289.x.x.x, AS 1141.x (universal base standards)
- **National Specs**: AS 3798, Austroads

### Files Changed

- `frontend/src/pages/tests/TestResultsPage.tsx`

### No Backend Changes

Uses existing `Project.state` field - no schema or API changes required.

## Default Behavior

- Projects default to NSW if state is not set
- Unknown states fall back to showing only Australian Standards

## Future Enhancements

- Could extend to other forms (NCR specs, ITP templates)
- Could add SA, WA, TAS, NT state configurations when needed
