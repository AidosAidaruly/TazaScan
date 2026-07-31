import { NavLink, useHistory } from 'react-router-dom'
import { useAuth } from '../../core/auth/use-auth'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth()
  const history = useHistory()

  function handleLogout() {
    logout()
    history.replace('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">Project</div>
        <nav>
          <NavLink to="/products" exact activeClassName="active">
            Products
          </NavLink>
          <NavLink to="/products/new" activeClassName="active">
            Create Product
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <small>{user?.email}</small>
          <button type="button" className="ghost-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>
      <main className="content">
        {children}
      </main>
    </div>
  )
}
