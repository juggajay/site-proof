/**
 * Integration tests for authentication and security functions
 * Tests password hashing, verification, and rate limiting
 */
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, needsPasswordRehash } from '../lib/auth.js'
import { isLockedOut, recordFailedAuthAttempt, clearFailedAuthAttempts } from '../middleware/rateLimiter.js'

describe('Password Hashing', () => {
  describe('hashPassword', () => {
    it('should return a bcrypt format hash', () => {
      const password = 'TestPassword123!'
      const hash = hashPassword(password)

      // Bcrypt hashes start with $2a$, $2b$, or $2y$
      const isBcryptFormat = hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')
      expect(isBcryptFormat).toBe(true)
    })

    it('should generate different hashes for the same password (due to salt)', () => {
      const password = 'TestPassword123!'
      const hash1 = hashPassword(password)
      const hash2 = hashPassword(password)

      expect(hash1).not.toBe(hash2)
    })

    it('should generate hashes of consistent length', () => {
      const password = 'TestPassword123!'
      const hash = hashPassword(password)

      // Bcrypt hashes are always 60 characters
      expect(hash.length).toBe(60)
    })
  })

  describe('verifyPassword', () => {
    it('should verify correct password against bcrypt hash', () => {
      const password = 'TestPassword123!'
      const hash = hashPassword(password)

      expect(verifyPassword(password, hash)).toBe(true)
    })

    it('should reject incorrect password against bcrypt hash', () => {
      const password = 'TestPassword123!'
      const wrongPassword = 'WrongPassword456!'
      const hash = hashPassword(password)

      expect(verifyPassword(wrongPassword, hash)).toBe(false)
    })

    it('should not throw errors for legacy SHA256 hashes (64-char hex)', () => {
      const password = 'TestPassword123!'
      // A valid 64-character hex string (SHA256 format)
      const legacySha256Hash = 'a'.repeat(64)

      // Should not throw - just return false for non-matching legacy hash
      expect(() => verifyPassword(password, legacySha256Hash)).not.toThrow()
    })

    it('should handle case-insensitive SHA256 hex detection', () => {
      const password = 'TestPassword123!'
      // Mix of uppercase and lowercase hex characters
      const legacyHash = 'aAbBcCdDeEfF0123456789' + 'a'.repeat(42)

      expect(() => verifyPassword(password, legacyHash)).not.toThrow()
      // Result will be false since the hash doesn't match
      expect(verifyPassword(password, legacyHash)).toBe(false)
    })

    it('should reject empty password', () => {
      const hash = hashPassword('TestPassword123!')

      expect(verifyPassword('', hash)).toBe(false)
    })
  })

  describe('needsPasswordRehash', () => {
    it('should return false for bcrypt hashes', () => {
      const hash = hashPassword('TestPassword123!')

      expect(needsPasswordRehash(hash)).toBe(false)
    })

    it('should return true for SHA256 format hashes', () => {
      // 64-character hex string (SHA256 format) - only 0-9 and a-f characters
      const sha256Hash = 'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123'

      expect(sha256Hash.length).toBe(64)
      expect(needsPasswordRehash(sha256Hash)).toBe(true)
    })

    it('should return false for non-SHA256 format strings', () => {
      // Not 64 characters
      const shortString = 'abc123'
      // Contains non-hex characters
      const invalidHex = 'g'.repeat(64)

      expect(needsPasswordRehash(shortString)).toBe(false)
      expect(needsPasswordRehash(invalidHex)).toBe(false)
    })
  })
})

describe('Rate Limiting', () => {
  // Use unique IP addresses for each test to avoid interference
  const getUniqueIp = () => `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`

  describe('isLockedOut', () => {
    it('should return false initially for a new IP', () => {
      const testIp = getUniqueIp()
      const result = isLockedOut(testIp)

      expect(result.locked).toBe(false)
      expect(result.remainingSeconds).toBe(0)
    })

    it('should return false after fewer than 5 failed attempts', () => {
      const testIp = getUniqueIp()

      // Record 4 failed attempts (under threshold)
      for (let i = 0; i < 4; i++) {
        recordFailedAuthAttempt(testIp)
      }

      const result = isLockedOut(testIp)
      expect(result.locked).toBe(false)
    })
  })

  describe('recordFailedAuthAttempt', () => {
    it('should lock out IP after 5 failed attempts', () => {
      const testIp = getUniqueIp()

      // Record 5 failed attempts (threshold)
      for (let i = 0; i < 5; i++) {
        recordFailedAuthAttempt(testIp)
      }

      const result = isLockedOut(testIp)
      expect(result.locked).toBe(true)
      expect(result.remainingSeconds).toBeGreaterThan(0)
    })

    it('should track attempts correctly', () => {
      const testIp = getUniqueIp()

      // First 4 attempts should not lock out
      for (let i = 0; i < 4; i++) {
        recordFailedAuthAttempt(testIp)
        expect(isLockedOut(testIp).locked).toBe(false)
      }

      // 5th attempt should trigger lockout
      recordFailedAuthAttempt(testIp)
      expect(isLockedOut(testIp).locked).toBe(true)
    })
  })

  describe('clearFailedAuthAttempts', () => {
    it('should reset lockout state', () => {
      const testIp = getUniqueIp()

      // Lock out the IP
      for (let i = 0; i < 5; i++) {
        recordFailedAuthAttempt(testIp)
      }
      expect(isLockedOut(testIp).locked).toBe(true)

      // Clear attempts
      clearFailedAuthAttempts(testIp)

      // Should no longer be locked
      const result = isLockedOut(testIp)
      expect(result.locked).toBe(false)
      expect(result.remainingSeconds).toBe(0)
    })

    it('should allow new attempts after clearing', () => {
      const testIp = getUniqueIp()

      // Lock out and clear
      for (let i = 0; i < 5; i++) {
        recordFailedAuthAttempt(testIp)
      }
      clearFailedAuthAttempts(testIp)

      // New attempts should start fresh
      recordFailedAuthAttempt(testIp)
      recordFailedAuthAttempt(testIp)

      expect(isLockedOut(testIp).locked).toBe(false)
    })
  })

  describe('lockout timing', () => {
    it('should report remaining seconds when locked out', () => {
      const testIp = getUniqueIp()

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        recordFailedAuthAttempt(testIp)
      }

      const result = isLockedOut(testIp)
      expect(result.locked).toBe(true)
      // Lockout is 15 minutes = 900 seconds, should be close to that
      expect(result.remainingSeconds).toBeLessThanOrEqual(900)
      expect(result.remainingSeconds).toBeGreaterThan(890)
    })
  })
})
