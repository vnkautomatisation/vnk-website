export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Hero header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15" />
            <div className="space-y-2">
              <div className="h-6 w-32 rounded bg-white/20" />
              <div className="h-4 w-56 rounded bg-white/10" />
            </div>
          </div>
          <div className="h-9 w-36 rounded-lg bg-white/20" />
        </div>
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg border bg-muted/30" />
        ))}
      </div>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-72 rounded bg-muted" />
        <div className="h-9 w-72 rounded bg-muted" />
        <div className="h-9 w-24 rounded bg-muted" />
      </div>
      {/* Table */}
      <div className="rounded-xl border overflow-hidden">
        <div className="h-10 bg-muted/50 border-b" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
            <div className="h-4 w-4 rounded bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-48 rounded bg-muted" />
            </div>
            <div className="h-6 w-16 rounded-full bg-muted" />
            <div className="h-1.5 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
