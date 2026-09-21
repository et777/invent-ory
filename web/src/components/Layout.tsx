import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Layout({ children }: { children: ReactNode }) {
  const { username, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/sessions" className="brand">
          Invent-ory Review Console
        </Link>
        <nav>
          <Link to="/sessions">Sessions</Link>
          <Link to="/compare">Compare</Link>
        </nav>
        <div className="user-menu">
          <span className="muted">{username}</span>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer muted">
        Visible-shelf counts only. Not a stock-on-hand figure.
      </footer>
    </div>
  )
}
