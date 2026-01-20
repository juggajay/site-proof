import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Simple user type for local development
interface User {
  id: string
  email: string
  fullName?: string
  name?: string
  phone?: string
  role?: string
  companyId?: string | null
  companyName?: string | null
  createdAt?: string
  avatarUrl?: string | null
}

// MFA Challenge error class (Feature #22, #421)
export class MfaRequiredError extends Error {
  userId: string
  constructor(userId: string) {
    super('MFA verification required')
    this.name = 'MfaRequiredError'
    this.userId = userId
  }
}

interface AuthContextType {
  user: User | null
  loading: boolean
  sessionExpired: boolean
  signIn: (email: string, password: string, rememberMe?: boolean, mfaCode?: string) => Promise<void>
  signUp: (email: string, password: string, metadata?: object) => Promise<void>
  signOut: () => Promise<void>
  handleSessionExpired: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Storage keys for auth
const AUTH_STORAGE_KEY = 'siteproof_auth'
const REMEMBER_ME_KEY = 'siteproof_remember_me'

// Helper to get the appropriate storage based on remember me preference
function getAuthStorage(): Storage {
  // Check if user chose to be remembered
  const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) === 'true'
  return rememberMe ? localStorage : sessionStorage
}

// Helper to clear auth from both storages
function clearAuthFromAllStorages() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(REMEMBER_ME_KEY)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    // Check for stored auth on mount and verify token is valid
    const verifySession = async () => {
      // Check localStorage first (remember me), then sessionStorage
      let storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
      let storage: Storage = localStorage

      if (!storedAuth) {
        storedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY)
        storage = sessionStorage
      }

      if (storedAuth) {
        try {
          const parsed = JSON.parse(storedAuth)
          const token = parsed.token

          // Verify the token is still valid by calling /api/auth/me
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
          const response = await fetch(`${apiUrl}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (response.ok) {
            // Use fresh user data from the API response
            const data = await response.json()
            const freshUser = data.user
            // Update storage with fresh user data
            const updatedAuth = { ...parsed, user: freshUser }
            storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedAuth))
            setUser(freshUser)
          } else {
            // Token is invalid or expired
            clearAuthFromAllStorages()
            setSessionExpired(true)
          }
        } catch (e) {
          clearAuthFromAllStorages()
        }
      }
      setLoading(false)
    }

    verifySession()
  }, [])

  const signIn = async (email: string, password: string, rememberMe: boolean = true, mfaCode?: string) => {
    // For local development, use backend API for auth
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, mfaCode }),
      })

      const data = await response.json()

      // Check for MFA challenge (Feature #22, #421)
      if (response.ok && data.mfaRequired) {
        throw new MfaRequiredError(data.userId)
      }

      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }

      // Clear any existing auth from both storages first
      clearAuthFromAllStorages()

      // Store the remember me preference
      if (rememberMe) {
        localStorage.setItem(REMEMBER_ME_KEY, 'true')
      }

      // Store auth data in the appropriate storage
      const storage = rememberMe ? localStorage : sessionStorage
      storage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        user: data.user,
        token: data.token,
      }))

      setUser(data.user)
      setSessionExpired(false)
    } catch (error) {
      throw error
    }
  }

  const signUp = async (email: string, password: string, metadata?: object) => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, ...metadata }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Registration failed')
      }

      const data = await response.json()

      // Store auth data
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        user: data.user,
        token: data.token,
      }))

      setUser(data.user)
      setSessionExpired(false)
    } catch (error) {
      throw error
    }
  }

  const signOut = async () => {
    clearAuthFromAllStorages()
    setUser(null)
  }

  const handleSessionExpired = () => {
    clearAuthFromAllStorages()
    setUser(null)
    setSessionExpired(true)
  }

  const refreshUser = async () => {
    // Check localStorage first (remember me), then sessionStorage
    let storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
    let storage: Storage = localStorage

    if (!storedAuth) {
      storedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY)
      storage = sessionStorage
    }

    if (!storedAuth) return

    try {
      const parsed = JSON.parse(storedAuth)
      const token = parsed.token
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        // Update user in state and the appropriate storage
        const updatedAuth = {
          ...parsed,
          user: data.user,
        }
        storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedAuth))
        setUser(data.user)
      }
    } catch (e) {
      console.error('Failed to refresh user:', e)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, sessionExpired, signIn, signUp, signOut, handleSessionExpired, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper to get the stored token
export function getAuthToken(): string | null {
  // Check localStorage first (remember me), then sessionStorage
  let storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!storedAuth) {
    storedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY)
  }

  if (storedAuth) {
    try {
      const parsed = JSON.parse(storedAuth)
      return parsed.token
    } catch {
      return null
    }
  }
  return null
}

// Helper to get the current user from stored auth
export function getCurrentUser(): { id: string; email: string; role?: string } | null {
  // Check localStorage first (remember me), then sessionStorage
  let storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!storedAuth) {
    storedAuth = sessionStorage.getItem(AUTH_STORAGE_KEY)
  }

  if (storedAuth) {
    try {
      const parsed = JSON.parse(storedAuth)
      return parsed.user || null
    } catch {
      return null
    }
  }
  return null
}
