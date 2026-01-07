import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Simple user type for local development
interface User {
  id: string
  email: string
  fullName?: string
  role?: string
  companyId?: string | null
  companyName?: string | null
}

interface AuthContextType {
  user: User | null
  loading: boolean
  sessionExpired: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, metadata?: object) => Promise<void>
  signOut: () => Promise<void>
  handleSessionExpired: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Local storage key for auth
const AUTH_STORAGE_KEY = 'siteproof_auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    // Check for stored auth on mount and verify token is valid
    const verifySession = async () => {
      const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
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
            setUser(parsed.user)
          } else {
            // Token is invalid or expired
            localStorage.removeItem(AUTH_STORAGE_KEY)
            setSessionExpired(true)
          }
        } catch (e) {
          localStorage.removeItem(AUTH_STORAGE_KEY)
        }
      }
      setLoading(false)
    }

    verifySession()
  }, [])

  const signIn = async (email: string, password: string) => {
    // For local development, use backend API for auth
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'

    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Login failed')
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
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setUser(null)
  }

  const handleSessionExpired = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setUser(null)
    setSessionExpired(true)
  }

  return (
    <AuthContext.Provider value={{ user, loading, sessionExpired, signIn, signUp, signOut, handleSessionExpired }}>
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
  const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY)
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
