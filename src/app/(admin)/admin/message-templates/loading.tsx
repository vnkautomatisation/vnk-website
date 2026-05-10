export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15" />
            <div className="space-y-2">
              <div className="h-6 w-44 rounded bg-white/20" />
              <div className="h-4 w-72 rounded bg-white/10" />
            </div>
          </div>
          <div className="h-9 w-40 rounded-lg bg-white" />
        </div>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (<div key={i} className="h-20 rounded-lg border bg-muted/30" />))}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-72 rounded bg-muted" />
        <div className="h-9 w-44 rounded bg-muted" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div className="h-5 w-20 rounded bg-muted" />
              <div className="h-7 w-7 rounded bg-muted/50" />
            </div>
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-full rounded bg-muted/60" />
            <div className="h-3 w-2/3 rounded bg-muted/40" />
          </div>
        ))}
      </div>
    </div>
  );
}
