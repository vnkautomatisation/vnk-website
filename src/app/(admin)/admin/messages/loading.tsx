export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15" />
            <div className="space-y-2">
              <div className="h-6 w-32 rounded bg-white/20" />
              <div className="h-4 w-72 rounded bg-white/10" />
            </div>
          </div>
          <div className="h-9 w-36 rounded-lg bg-white/20" />
        </div>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (<div key={i} className="h-20 rounded-lg border bg-muted/30" />))}
      </div>
      <div className="grid md:grid-cols-[340px_1fr] gap-4 min-h-[600px]">
        <div className="rounded-xl border overflow-hidden">
          <div className="p-3 border-b space-y-2">
            <div className="h-9 rounded bg-muted" />
            <div className="h-7 rounded bg-muted/50" />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-3 py-3 border-b last:border-0">
              <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-full rounded bg-muted/60" />
                <div className="h-3 w-3/4 rounded bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-xl border overflow-hidden flex items-center justify-center">
          <div className="h-12 w-12 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
