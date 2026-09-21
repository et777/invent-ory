import { useEffect, useState } from 'react'
import { api, type Session, type SessionSummary } from '../api'

export function ScanComparisonPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [leftId, setLeftId] = useState<string>('')
  const [rightId, setRightId] = useState<string>('')
  const [leftSummary, setLeftSummary] = useState<SessionSummary | null>(null)
  const [rightSummary, setRightSummary] = useState<SessionSummary | null>(null)

  useEffect(() => {
    api.listSessions().then((s) => {
      setSessions(s)
      if (s.length >= 2) {
        setLeftId(s[0].sessionId)
        setRightId(s[1].sessionId)
      }
    })
  }, [])

  useEffect(() => {
    if (leftId) api.getSummary(leftId).then(setLeftSummary)
  }, [leftId])

  useEffect(() => {
    if (rightId) api.getSummary(rightId).then(setRightSummary)
  }, [rightId])

  const allSkus = Array.from(
    new Set([
      ...(leftSummary?.visibleCounts.map((c) => c.sku) ?? []),
      ...(rightSummary?.visibleCounts.map((c) => c.sku) ?? []),
    ]),
  )

  function countFor(summary: SessionSummary | null, sku: string): number {
    return summary?.visibleCounts.find((c) => c.sku === sku)?.visibleCount ?? 0
  }

  return (
    <div>
      <h2>Scan comparison</h2>
      <p className="muted">
        Each scan is a separate visible-shelf snapshot. Counts across sessions are not summed as inventory stock.
      </p>
      <div className="compare-selectors">
        <label>
          Session A
          <select value={leftId} onChange={(e) => setLeftId(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.sessionId}
              </option>
            ))}
          </select>
        </label>
        <label>
          Session B
          <select value={rightId} onChange={(e) => setRightId(e.target.value)}>
            {sessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.sessionId}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>{leftId || 'A'}</th>
            <th>{rightId || 'B'}</th>
            <th>Delta</th>
          </tr>
        </thead>
        <tbody>
          {allSkus.map((sku) => {
            const l = countFor(leftSummary, sku)
            const r = countFor(rightSummary, sku)
            return (
              <tr key={sku}>
                <td>{sku}</td>
                <td>{l}</td>
                <td>{r}</td>
                <td>{r - l}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
