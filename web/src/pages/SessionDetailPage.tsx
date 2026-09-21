import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, type Observation, type ReviewTask, type Session, type SessionSummary } from '../api'
import { EvidenceThumbnail } from '../components/EvidenceThumbnail'

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<Session | null>(null)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([])
  const [error, setError] = useState<string | null>(null)
  const [finalizeMessage, setFinalizeMessage] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!sessionId) return
    Promise.all([
      api.getSession(sessionId),
      api.getSummary(sessionId),
      api.getObservations(sessionId),
      api.getReviewTasks(sessionId),
    ])
      .then(([s, summ, obs, tasks]) => {
        setSession(s)
        setSummary(summ)
        setObservations(obs)
        setReviewTasks(tasks)
      })
      .catch((e: Error) => setError(e.message))
  }, [sessionId])

  useEffect(() => {
    load()
  }, [load])

  async function handleExport() {
    if (!sessionId) return
    const csv = await api.exportSessionCsv(sessionId)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sessionId}-export.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFinalize() {
    if (!sessionId) return
    setFinalizeMessage(null)
    try {
      await api.finalizeSession(sessionId)
      setFinalizeMessage('Session finalized.')
      load()
    } catch (e) {
      setFinalizeMessage((e as Error).message)
    }
  }

  if (error) return <p className="error">{error}</p>
  if (!session || !summary) return <p>Loading session…</p>

  const openTaskCount = reviewTasks.filter((t) => t.status === 'OPEN').length
  const canFinalize = openTaskCount === 0 && session.state !== 'FINAL'

  return (
    <div>
      <div className="page-heading">
        <h2>
          {session.siteId} — {session.zone} / {session.shelf}
        </h2>
        <span className={`state-badge state-${session.state.toLowerCase()}`}>{session.state}</span>
      </div>

      <section className="card">
        <h3>Live capture preview</h3>
        <div className="live-preview-placeholder">
          Live capture preview — connects in Phase 2 (real iOS camera capture and provisional overlay).
        </div>
      </section>

      <section className="card">
        <h3>Confirmed visible count by SKU</h3>
        <p className="muted">
          This reflects visible shelf facings observed during this scan, not stock on hand. Coverage:{' '}
          <strong>{summary.coverageStatus}</strong>
        </p>
        <table className="data-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Visible count</th>
            </tr>
          </thead>
          <tbody>
            {summary.visibleCounts.map((c) => (
              <tr key={c.sku}>
                <td>{c.sku}</td>
                <td>{c.name}</td>
                <td>{c.visibleCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          Unknown items: <strong>{summary.unknownCount}</strong>
        </p>
      </section>

      <section className="card">
        <h3>Observations &amp; evidence</h3>
        <ul className="observation-list">
          {observations.map((o) => (
            <li key={o.objectId} className="observation-row">
              <div>
                <strong>{o.assignedSku ?? 'Unassigned'}</strong>{' '}
                <span className={`state-badge state-${o.state.toLowerCase()}`}>{o.state}</span>
                <div className="muted">
                  Confidence {(o.confidence * 100).toFixed(0)}% · {o.shelfPosition}
                </div>
              </div>
              <div className="evidence-row">
                {o.evidenceKeys.map((k) => (
                  <EvidenceThumbnail key={k} evidenceKey={k} label={o.assignedSku ?? '?'} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card actions-row">
        <button onClick={handleExport}>Export CSV</button>
        <Link to={`/sessions/${sessionId}/review`}>
          <button disabled={openTaskCount === 0}>Open review queue ({openTaskCount})</button>
        </Link>
        <span title={canFinalize ? '' : 'Resolve all open review tasks before finalizing'}>
          <button onClick={handleFinalize} disabled={!canFinalize}>
            Finalize session
          </button>
        </span>
        {finalizeMessage && <p>{finalizeMessage}</p>}
      </section>
    </div>
  )
}
