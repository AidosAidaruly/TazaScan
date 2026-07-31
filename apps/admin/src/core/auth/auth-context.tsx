import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClient } from '../api/api-client'
import { ApiError } from '../errors/api-error'
import { tokenStorage } from './token-storage'
import { AuthApi } from '../../features/auth/api/auth-api'
import type { AuthUser } from '../../features/auth/types'
import { AuthContext } from './auth-context-value'

const authApi = new AuthApi(new ApiClient())

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(() => tokenStorage.get())
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    tokenStorage.clear()
    setToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function verifySession() {
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const response = await authApi.me(token)

        if (!isMounted) {
          return
        }

        if (response.data.role !== 'admin') {
          logout()
          return
        }

        setUser(response.data)
      } catch (error) {
        if (error instanceof ApiError && error.statusCode === 401) {
          logout()
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void verifySession()

    return () => {
      isMounted = false
    }
  }, [logout, token])

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password)

    if (response.data.user.role !== 'admin') {
      throw new ApiError(403, 'Only administrators can access this panel')
    }

    tokenStorage.set(response.data.accessToken)
    setToken(response.data.accessToken)
    setUser(response.data.user)
  }, [])

  const value = useMemo(
    () => ({ user, token, isLoading, login, logout }),
    [user, token, isLoading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
