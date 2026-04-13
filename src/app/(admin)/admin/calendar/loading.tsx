export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded bg-muted" />
          <div className="h-4 w-56 rounded bg-muted" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-muted" />
          <div className="h-9 w-32 rounded-lg bg-muted" />
          <div className="h-9 w-9 rounded-lg bg-muted" />
        </div>
      </div>
      {/* Calendar grid */}
      <div className="rounded-xl border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="px-3 py-2 border-r last:border-0">
              <div className="h-4 w-8 rounded bg-muted mx-auto" />
            </div>
          ))}
        </div>
        {/* Calendar rows */}
        {[...Array(5)].map((_, row) => (
          <div key={row} className="grid grid-cols-7 border-b last:border-0">
            {[...Array(7)].map((_, col) => (
              <div key={col} className="min-h-24 px-2 py-1.5 border-r last:border-0 space-y-1">
                <div className="h-5 w-5 rounded bg-muted" />
                {row % 2 === 0 && col % 3 === 0 && (
                  <div className="h-5 w-full rounded bg-muted/60" />
                )}
                {row % 3 === 1 && col % 2 === 0 && (
                  <div className="h-5 w-full rounded bg-muted/60" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
