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
      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Calendar grid skeleton */}
        <div className="rounded-xl border p-2.5 sm:p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-5 w-28 rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded bg-muted" />
              <div className="h-8 w-8 rounded bg-muted" />
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {[...Array(7)].map((_, i) => (
              <div key={`h-${i}`} className="h-4 rounded bg-muted" />
            ))}
            {[...Array(35)].map((_, i) => (
              <div key={i} className="h-9 rounded bg-muted/60" />
            ))}
          </div>
        </div>
        {/* Time slots skeleton */}
        <div className="rounded-xl border p-2.5 sm:p-4 space-y-3">
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="grid grid-cols-2 gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-muted/60" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
