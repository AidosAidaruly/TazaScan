export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="page-state" role="status">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  )
}
