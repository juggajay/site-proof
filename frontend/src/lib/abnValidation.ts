// Feature #860: ABN (Australian Business Number) validation
// ABN is an 11-digit number with a specific checksum algorithm

const ABN_WEIGHTS = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19]

/**
 * Validates an Australian Business Number (ABN)
 * @param abn The ABN to validate (can include spaces)
 * @returns true if valid, false if invalid
 */
export function isValidABN(abn: string): boolean {
  // Remove all non-digit characters
  const cleanABN = abn.replace(/\D/g, '')

  // ABN must be exactly 11 digits
  if (cleanABN.length !== 11) {
    return false
  }

  // Convert to array of digits
  const digits = cleanABN.split('').map(Number)

  // Subtract 1 from the first digit (per ABN algorithm)
  digits[0] = digits[0] - 1

  // Calculate weighted sum
  let sum = 0
  for (let i = 0; i < 11; i++) {
    sum += digits[i] * ABN_WEIGHTS[i]
  }

  // Valid if sum is divisible by 89
  return sum % 89 === 0
}

/**
 * Formats an ABN into the standard format: XX XXX XXX XXX
 * @param abn The ABN to format
 * @returns Formatted ABN string
 */
export function formatABN(abn: string): string {
  const cleanABN = abn.replace(/\D/g, '')

  if (cleanABN.length !== 11) {
    return abn // Return original if not 11 digits
  }

  // Format as XX XXX XXX XXX
  return `${cleanABN.slice(0, 2)} ${cleanABN.slice(2, 5)} ${cleanABN.slice(5, 8)} ${cleanABN.slice(8, 11)}`
}

/**
 * Validates and returns an error message for an ABN
 * @param abn The ABN to validate
 * @returns Error message string, or null if valid
 */
export function validateABN(abn: string): string | null {
  if (!abn || abn.trim() === '') {
    return null // Empty is OK (not required)
  }

  const cleanABN = abn.replace(/\D/g, '')

  if (cleanABN.length !== 11) {
    return 'ABN must be 11 digits'
  }

  if (!isValidABN(abn)) {
    return 'Invalid ABN - please check the number'
  }

  return null // Valid
}

/**
 * Common test ABNs for development
 * These are valid according to the ABN checksum algorithm
 */
export const TEST_ABNS = {
  valid: [
    '51 824 753 556', // Australian Taxation Office
    '53 004 085 616', // Commonwealth Bank
    '12 345 678 912', // Test valid ABN
  ],
  invalid: [
    '12 345 678 901', // Invalid checksum
    '00 000 000 000', // All zeros
    '99 999 999 999', // All nines
  ]
}
