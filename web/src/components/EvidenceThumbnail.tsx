export function EvidenceThumbnail({ evidenceKey, label }: { evidenceKey: string; label?: string }) {
  return (
    <div className="evidence-thumb" title={evidenceKey}>
      <div className="evidence-thumb-placeholder">{label ?? 'IMG'}</div>
      <span className="evidence-thumb-key">{evidenceKey.split('/').pop()}</span>
    </div>
  )
}
