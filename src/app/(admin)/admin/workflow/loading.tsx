export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded bg-muted" />
          <div className="h-4 w-56 rounded bg-muted" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-muted" />
      </div>
      {/* Workflow columns / kanban */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, col) => (
          <div key={col} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="h-5 w-24 rounded bg-muted" />
              <div className="h-5 w-6 rounded bg-muted" />
            </div>
            {[...Array(col === 0 ? 4 : col === 1 ? 3 : 2)].map((_, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="h-4 w-full rounded bg-muted" />
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="flex items-center justify-between pt-1">
                  <div className="h-6 w-6 rounded-full bg-muted" />
                  <div className="h-5 w-14 rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
