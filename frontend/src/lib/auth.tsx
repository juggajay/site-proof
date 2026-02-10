import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from 'react'

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

// Role override key for dev testing
const ROLE_OVERRIDE_KEY = 'siteproof_role_override'

// Helper to get role override (used by RoleSwitcher) - dev only
export function getRoleOverride(): string | null {
  if (typeof window === 'undefined') return null
  if (!import.meta.env.DEV) return null
  return localStorage.getItem(ROLE_OVERRIDE_KEY)
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
  actualRole: string | null  // The user's actual role (without override)
  loading: boolean
  sessionExpired: boolean
  signIn: (email: string, password: string, rememberMe?: boolean, mfaCode?: string) => Promise<void>
  signUp: (email: string, password: string, metadata?: object) => Promise<void>
  signOut: () => Promise<void>
  handleSessionExpired: () => void
  refreshUser: () => Promise<void>
  setToken: (token: string) => Promise<void>  // Feature #414: OAuth callback support
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Storage keys for auth
const AUTH_STORAGE_KEY = 'siteproof_auth'
const REMEMBER_ME_KEY = 'siteproof_remember_me'

// Helper to get the appropriate storage based on remember me preference
export function getAuthStorage(): Storage {
  // Check if user chose to be remembered
  const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) === 'true'
  return rememberMe ? localStorage : sessionStorage
}

// Helper to clear auth from both storages (including any orphaned keys)
function clearAuthFromAllStorages() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  sessionStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(REMEMBER_ME_KEY)
  // Clean up orphaned token keys from older code paths
  localStorage.removeItem('auth_token')
  localStorage.removeItem('refresh_token')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [actualUser, setActualUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  // Apply role override for dev testing (only for admin/owner users)
  const user = useMemo(() => {
    if (!actualUser) return null

    const roleOverride = getRoleOverride()
    // Only allow override if actual user is admin/owner
    if (roleOverride && ['admin', 'owner'].includes(actualUser.role || '')) {
      return { ...actualUser, role: roleOverride }
    }
    return actualUser
  }, [actualUser])

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
            setActualUser(freshUser)
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

      setActualUser(data.user)
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

      setActualUser(data.user)
      setSessionExpired(false)
    } catch (error) {
      throw error
    }
  }

  const signOut = async () => {
    clearAuthFromAllStorages()
    setActualUser(null)
  }

  const handleSessionExpired = () => {
    clearAuthFromAllStorages()
    setActualUser(null)
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
        setActualUser(data.user)
      }
    } catch (e) {
      console.error('Failed to refresh user:', e)
    }
  }

  // Feature #414: Set token from OAuth callback
  const setToken = async (token: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

      // Verify the token and get user info
      const response = await fetch(`${apiUrl}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()

        // Clear any existing auth from both storages
        clearAuthFromAllStorages()

        // Store with remember me (OAuth users typically want persistent sessions)
        localStorage.setItem(REMEMBER_ME_KEY, 'true')
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          user: data.user,
          token: token,
        }))

        setActualUser(data.user)
        setSessionExpired(false)
      } else {
        throw new Error('Invalid token')
      }
    } catch (error) {
      clearAuthFromAllStorages()
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, actualRole: actualUser?.role || null, loading, sessionExpired, signIn, signUp, signOut, handleSessionExpired, refreshUser, setToken }}>
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
