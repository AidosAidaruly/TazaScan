import { screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Switch } from 'react-router-dom'
import { AuthProvider } from '../auth/auth-context'
import { ProtectedRoute } from './ProtectedRoute'

function renderRoutes(path: string) {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Switch>
          <Route path="/login">
            <div>Login Page</div>
          </Route>
          <ProtectedRoute>
            <Route path="/products">
              <div>Products Page</div>
            </Route>
          </ProtectedRoute>
        </Switch>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('redirects unauthenticated users to login', async () => {
    renderRoutes('/products')

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument()
    })
  })

  it('logs out automatically when session verification returns 401', async () => {
    sessionStorage.setItem('project_admin_access_token', 'expired-token')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: 'Token expired' } }),
    } as Response)

    renderRoutes('/products')

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument()
      expect(sessionStorage.getItem('project_admin_access_token')).toBeNull()
    })
  })
})
