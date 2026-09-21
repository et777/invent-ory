import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!username || !password) {
      setError('Username and password are required.')
      return
    }
    try {
      await login(username, password)
      navigate('/sessions')
    } catch {
      setError('Login failed.')
    }
  }

  return (
    <div className="centered-page">
      <form className="card login-form" onSubmit={handleSubmit}>
        <h1>Invent-ory Review Console</h1>
        <p className="muted">Phase 1 stub login. Real Cognito auth is wired in a later phase.</p>
        <label>
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Sign in</button>
      </form>
    </div>
  )
}
