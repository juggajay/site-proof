// Encryption Module for 2FA Secrets
// Uses AES-256-GCM for authenticated encryption

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16 // 128 bits
const ENCRYPTED_FORMAT_REGEX = /^[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/i

// Get encryption key from environment (64 char hex string = 32 bytes = 256 bits)
function getEncryptionKey(): Buffer | null {
  const keyHex = process.env.ENCRYPTION_KEY

  if (!keyHex) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[Encryption] WARNING: ENCRYPTION_KEY not set in production environment')
    }
    return null
  }

  if (keyHex.length !== 64) {
    console.error('[Encryption] ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
    return null
  }

  return Buffer.from(keyHex, 'hex')
}

/**
 * Encrypt plaintext using AES-256-GCM
 * @param plaintext - The text to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey()

  // In development without key, return plaintext as fallback
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      return plaintext
    }
    throw new Error('Encryption key not configured')
  }

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH)

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  })

  // Encrypt the plaintext
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')

  // Get the authentication tag
  const authTag = cipher.getAuthTag()

  // Return in format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext}`
}

/**
 * Decrypt ciphertext that was encrypted with encrypt()
 * @param ciphertext - The encrypted string in format: iv:authTag:ciphertext
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedValue: string): string {
  const key = getEncryptionKey()

  // Check if value is encrypted format
  if (!isEncrypted(encryptedValue)) {
    // Value is not encrypted, return as-is (for migration support)
    return encryptedValue
  }

  // In development without key, return as-is (assuming it's plaintext)
  if (!key) {
    if (process.env.NODE_ENV !== 'production') {
      // If it looks encrypted but no key, this is likely plaintext that happens to match format
      return encryptedValue
    }
    throw new Error('Encryption key not configured')
  }

  // Parse the encrypted value
  const parts = encryptedValue.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format')
  }

  const [ivHex, authTagHex, ciphertextHex] = parts

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH
  })

  // Set the authentication tag
  decipher.setAuthTag(authTag)

  // Decrypt
  let plaintext = decipher.update(ciphertextHex, 'hex', 'utf8')
  plaintext += decipher.final('utf8')

  return plaintext
}

/**
 * Check if a value appears to be in the encrypted format
 * @param value - The value to check
 * @returns True if the value matches the encrypted format (iv:authTag:ciphertext)
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false
  }

  // Check if it matches the encrypted format pattern
  return ENCRYPTED_FORMAT_REGEX.test(value)
}

/**
 * Generate a new encryption key (for setup purposes)
 * @returns A 64-character hex string suitable for ENCRYPTION_KEY
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}
