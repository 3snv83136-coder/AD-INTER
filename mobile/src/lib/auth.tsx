import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import { api, loginRequest, setOnUnauthorized, setTokenGetter } from './api'
import type { AuthUser } from './types'

const TOKEN_KEY = 'allo.mobile.token'
const USER_KEY = 'allo.mobile.user'

type AuthContextValue = {
  ready: boolean
  user: AuthUser | null
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function readStore(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return null
  }
}

async function writeStore(key: string, value: string | null): Promise<void> {
  try {
    if (value == null) await SecureStore.deleteItemAsync(key)
    else await SecureStore.setItemAsync(key, value)
  } catch {
    /* web / indisponible */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const tokenRef = useRef<string | null>(null)

  const logout = useCallback(async () => {
    tokenRef.current = null
    setToken(null)
    setUser(null)
    await writeStore(TOKEN_KEY, null)
    await writeStore(USER_KEY, null)
  }, [])

  useEffect(() => {
    setTokenGetter(async () => tokenRef.current)
  }, [])

  useEffect(() => {
    setOnUnauthorized(() => {
      void logout()
    })
    return () => setOnUnauthorized(null)
  }, [logout])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const storedToken = await readStore(TOKEN_KEY)
      const storedUser = await readStore(USER_KEY)
      if (cancelled) return
      if (!storedToken) {
        setReady(true)
        return
      }
      tokenRef.current = storedToken
      setToken(storedToken)
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser) as AuthUser)
        } catch {
          /* ignore */
        }
      }
      try {
        const data = await api<{ user: AuthUser }>('/api/auth/mobile')
        if (cancelled) return
        setUser(data.user)
        await writeStore(USER_KEY, JSON.stringify(data.user))
      } catch {
        if (!cancelled) await logout()
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [logout])

  const login = useCallback(async (username: string, password: string) => {
    const data = await loginRequest(username.trim(), password)
    tokenRef.current = data.token
    setToken(data.token)
    setUser(data.user)
    await writeStore(TOKEN_KEY, data.token)
    await writeStore(USER_KEY, JSON.stringify(data.user))
  }, [])

  const value = useMemo(
    () => ({ ready, user, token, login, logout }),
    [ready, user, token, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth hors AuthProvider')
  return ctx
}
