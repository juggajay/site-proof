import { parseOptionalNonNegativeDecimalInput } from '@/lib/numericInput';

export type ProjectAreaFormInput = {
  name: string;
  chainageStart: string;
  chainageEnd: string;
};

export type ProjectAreaFormValidationResult =
  | {
      ok: true;
      name: string;
      chainageStart: number;
      chainageEnd: number;
    }
  | {
      ok: false;
      title: string;
      description: string;
    };

export function validateProjectAreaForm(
  input: ProjectAreaFormInput,
): ProjectAreaFormValidationResult {
  const name = input.name.trim();
  const chainageStartText = input.chainageStart.trim();
  const chainageEndText = input.chainageEnd.trim();

  if (!name) {
    return {
      ok: false,
      title: 'Error',
      description: 'Area name is required',
    };
  }

  if (!chainageStartText || !chainageEndText) {
    return {
      ok: false,
      title: 'Chainage required',
      description: 'Enter both chainage start and chainage end for this area.',
    };
  }

  const chainageStart = parseOptionalNonNegativeDecimalInput(chainageStartText);
  const chainageEnd = parseOptionalNonNegativeDecimalInput(chainageEndText);

  if (chainageStart === null || chainageEnd === null) {
    return {
      ok: false,
      title: 'Invalid chainage',
      description: 'Enter non-negative decimal numbers for chainage start and end.',
    };
  }

  if (chainageStart >= chainageEnd) {
    return {
      ok: false,
      title: 'Invalid chainage range',
      description: 'Chainage end must be greater than chainage start.',
    };
  }

  return {
    ok: true,
    name,
    chainageStart,
    chainageEnd,
  };
}
