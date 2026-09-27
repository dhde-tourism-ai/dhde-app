export function Loading({ what }: { what: string }) {
  return (
    <div className="state-msg" role="status">
      <div>
        <div className="spinner" aria-hidden="true"></div>
        {what}
      </div>
    </div>
  )
}

export function LoadError({ file, error }: { file: string; error: Error | null }) {
  return (
    <div className="state-msg error" role="alert">
      <div>
        <p>Could not load data/{file}. Make sure this file is served alongside index.html.</p>
        <p className="muted">{error ? error.message : 'Unknown error'}</p>
      </div>
    </div>
  )
}
