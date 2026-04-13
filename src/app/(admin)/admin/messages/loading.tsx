export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded bg-muted" />
          <div className="h-4 w-52 rounded bg-muted" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-muted" />
      </div>
      {/* Messages list */}
      <div className="rounded-xl border overflow-hidden">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 border-b last:border-0">
            <div className="h-10 w-10 rounded-full bg-muted mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="h-4 w-32 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted" />
              </div>
              <div className="h-4 w-48 rounded bg-muted" />
              <div className="h-3 w-full max-w-md rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
