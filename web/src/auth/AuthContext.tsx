import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { clearAuthToken, getAuthToken, setAuthToken } from '../api/client'

interface AuthContextValue {
  isAuthenticated: boolean
  username: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Placeholder login: stores a fake bearer token so every API call already
 * attaches Authorization headers. Real Cognito Hosted UI / SRP login wiring
 * happens once the Cognito user pool is deployed.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() =>
    getAuthToken() ? sessionStorage.getItem('inventory_auth_username') : null,
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: username !== null,
      username,
      login: async (user: string, _password: string) => {
        // Phase 1 stub: any non-empty credentials produce a session token.
        const fakeJwt = `stub.${btoa(user)}.token`
        setAuthToken(fakeJwt)
        sessionStorage.setItem('inventory_auth_username', user)
        setUsername(user)
      },
      logout: () => {
        clearAuthToken()
        sessionStorage.removeItem('inventory_auth_username')
        setUsername(null)
      },
    }),
    [username],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
