import { createContext } from 'react'
import type { AuthUser } from '../../features/auth/types'

export type AuthState = {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  login(email: string, password: string): Promise<void>
  logout(): void
}

export const AuthContext = createContext<AuthState | null>(null)
