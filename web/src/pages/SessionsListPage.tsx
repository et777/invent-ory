import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type Session } from '../api'

export function SessionsListPage() {
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .listSessions()
      .then(setSessions)
      .catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <p className="error">{error}</p>
  if (!sessions) return <p>Loading sessions…</p>

  return (
    <div>
      <h2>Sessions</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Site</th>
            <th>Zone / Shelf</th>
            <th>Operator</th>
            <th>State</th>
            <th>Started</th>
            <th>Ended</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.sessionId}>
              <td>
                <Link to={`/sessions/${s.sessionId}`}>{s.siteId}</Link>
              </td>
              <td>
                {s.zone} / {s.shelf}
              </td>
              <td>{s.operatorId}</td>
              <td>
                <span className={`state-badge state-${s.state.toLowerCase()}`}>{s.state}</span>
              </td>
              <td>{new Date(s.startedAt).toLocaleString()}</td>
              <td>{s.endedAt ? new Date(s.endedAt).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
