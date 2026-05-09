export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Hero header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15" />
            <div className="space-y-2">
              <div className="h-6 w-40 rounded bg-white/20" />
              <div className="h-4 w-72 rounded bg-white/10" />
            </div>
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-32 rounded-lg bg-white/20" />
            <div className="h-9 w-32 rounded-lg bg-white/20" />
            <div className="h-9 w-32 rounded-lg bg-white" />
          </div>
        </div>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg border bg-muted/30" />
        ))}
      </div>
      {/* Toolbar */}
      <div className="flex justify-between gap-2">
        <div className="h-9 w-72 rounded bg-muted" />
        <div className="h-9 w-48 rounded bg-muted" />
      </div>
      {/* Calendar grid avec sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        <div className="h-72 rounded-xl border bg-muted/20" />
        <div className="rounded-xl border overflow-hidden">
          <div className="grid grid-cols-7 border-b">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="px-3 py-2 border-r last:border-0">
                <div className="h-4 w-8 rounded bg-muted mx-auto" />
              </div>
            ))}
          </div>
          {[...Array(5)].map((_, row) => (
            <div key={row} className="grid grid-cols-7 border-b last:border-0">
              {[...Array(7)].map((_, col) => (
                <div key={col} className="min-h-20 px-2 py-1.5 border-r last:border-0 space-y-1">
                  <div className="h-5 w-5 rounded bg-muted" />
                  {row % 2 === 0 && col % 3 === 0 && (
                    <div className="h-5 w-full rounded bg-muted/60" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
