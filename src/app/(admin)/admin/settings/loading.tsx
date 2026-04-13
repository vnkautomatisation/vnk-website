export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-7 w-40 rounded bg-muted" />
        <div className="h-4 w-64 rounded bg-muted" />
      </div>
      {/* Settings sections */}
      <div className="rounded-xl border p-6 space-y-6">
        <div className="h-5 w-36 rounded bg-muted" />
        {/* Form fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="h-10 w-full rounded-lg bg-muted" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-24 w-full rounded-lg bg-muted" />
        </div>
      </div>
      <div className="rounded-xl border p-6 space-y-6">
        <div className="h-5 w-44 rounded bg-muted" />
        {/* Toggle rows */}
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="space-y-1">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-3 w-56 rounded bg-muted" />
            </div>
            <div className="h-6 w-11 rounded-full bg-muted" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border p-6 space-y-6">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-10 w-full rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
      {/* Save button */}
      <div className="flex justify-end">
        <div className="h-10 w-32 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
