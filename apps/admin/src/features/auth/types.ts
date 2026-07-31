export type AuthUser = {
  id: string
  email: string
  role: 'admin' | 'user'
}

export type LoginResponse = {
  data: {
    accessToken: string
    user: AuthUser
  }
}

export type MeResponse = {
  data: AuthUser
}
