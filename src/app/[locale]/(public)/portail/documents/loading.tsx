export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-6 w-40 rounded bg-muted" />
          <div className="h-4 w-56 rounded bg-muted" />
        </div>
      </div>
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border p-2.5 sm:p-4 space-y-2">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-7 w-12 rounded bg-muted" />
          </div>
        ))}
      </div>
      {/* Table skeleton */}
      <div className="rounded-xl border overflow-hidden">
        <div className="h-10 bg-muted/50 border-b" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
            <div className="h-9 w-9 rounded-lg bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-48 rounded bg-muted" />
            </div>
            <div className="h-6 w-16 rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
