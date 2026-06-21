import { describe, expect, it } from 'vitest';
import { validateProjectAreaForm } from './projectAreaForm';

describe('validateProjectAreaForm', () => {
  it('requires both chainage bounds before an area can be saved', () => {
    expect(
      validateProjectAreaForm({
        name: 'Zone 1',
        chainageStart: '0',
        chainageEnd: '',
      }),
    ).toEqual({
      ok: false,
      title: 'Chainage required',
      description: 'Enter both chainage start and chainage end for this area.',
    });
  });

  it('rejects non-decimal chainage values', () => {
    expect(
      validateProjectAreaForm({
        name: 'Zone 1',
        chainageStart: 'abc',
        chainageEnd: '100',
      }),
    ).toEqual({
      ok: false,
      title: 'Invalid chainage',
      description: 'Enter non-negative decimal numbers for chainage start and end.',
    });
  });

  it('requires chainage end to be greater than chainage start', () => {
    expect(
      validateProjectAreaForm({
        name: 'Zone 1',
        chainageStart: '100',
        chainageEnd: '100',
      }),
    ).toEqual({
      ok: false,
      title: 'Invalid chainage range',
      description: 'Chainage end must be greater than chainage start.',
    });
  });

  it('returns the trimmed name and parsed chainage bounds for a valid area', () => {
    expect(
      validateProjectAreaForm({
        name: '  Zone 1  ',
        chainageStart: ' 10.5 ',
        chainageEnd: ' 250.25 ',
      }),
    ).toEqual({
      ok: true,
      name: 'Zone 1',
      chainageStart: 10.5,
      chainageEnd: 250.25,
    });
  });
});
