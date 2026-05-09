export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-44 rounded bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-lg bg-muted" />
          <div className="h-9 w-24 rounded-lg bg-muted" />
        </div>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg border bg-muted/30" />
        ))}
      </div>
      {/* Conversion */}
      <div className="rounded-lg border bg-card p-3 h-16 bg-muted/20" />
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-72 rounded bg-muted" />
        <div className="h-9 w-24 rounded bg-muted" />
        <div className="h-9 w-24 rounded bg-muted" />
      </div>
      {/* Kanban — 6 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, col) => (
          <div key={col} className="space-y-2">
            <div className="rounded-lg border p-3 h-14 bg-muted/30" />
            {[...Array(col === 0 || col === 5 ? 1 : 2)].map((_, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2 bg-card">
                <div className="h-1 w-full rounded bg-muted" />
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
