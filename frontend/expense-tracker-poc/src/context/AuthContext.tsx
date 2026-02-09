import type { ReactNode } from 'react'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const API_BASE = 'http://localhost:8000'
const TOKEN_KEY = 'expense_tracker_token'
const FETCH_TIMEOUT_MS = 15000

type AuthContextType = {
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  isReady: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY)
  )
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setIsReady(true)
  }, [])

  const setToken = useCallback((newToken: string | null) => {
    setTokenState(newToken)
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken)
    } else {
      localStorage.removeItem(TOKEN_KEY)
    }
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || 'Login failed')
        }
        const data = await res.json()
        setToken(data.access_token)
      } catch (err) {
        clearTimeout(timeoutId)
        if (err instanceof Error) {
          if (err.name === 'AbortError') throw new Error('Connection timeout. Is the backend running at http://localhost:8000?')
          if (err.message === 'Failed to fetch' || err.name === 'TypeError') throw new Error('Cannot reach the server. Is the backend running? Start it with: uvicorn app.main:app --reload --port 8000')
          throw err
        }
        throw new Error('Login failed')
      }
    },
    [setToken]
  )

  const register = useCallback(
    async (email: string, password: string) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      try {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.detail || 'Registration failed')
        }
        const data = await res.json()
        setToken(data.access_token)
      } catch (err) {
        clearTimeout(timeoutId)
        if (err instanceof Error) {
          if (err.name === 'AbortError') throw new Error('Connection timeout. Is the backend running at http://localhost:8000?')
          if (err.message === 'Failed to fetch' || err.name === 'TypeError') throw new Error('Cannot reach the server. Is the backend running? Start it with: uvicorn app.main:app --reload --port 8000')
          throw err
        }
        throw new Error('Registration failed')
      }
    },
    [setToken]
  )

  const logout = useCallback(() => {
    setToken(null)
  }, [setToken])

  return (
    <AuthContext.Provider
      value={{ token, login, register, logout, isReady }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
