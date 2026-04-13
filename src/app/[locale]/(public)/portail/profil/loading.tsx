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
      {/* Avatar + name section */}
      <div className="rounded-xl border p-6 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted" />
        <div className="space-y-2">
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="h-4 w-48 rounded bg-muted" />
        </div>
      </div>
      {/* Form fields skeleton */}
      <div className="rounded-xl border p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-10 w-full rounded-lg bg-muted/60" />
            </div>
          ))}
        </div>
        {/* Full-width field */}
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted/60" />
        </div>
        {/* Save button */}
        <div className="flex justify-end">
          <div className="h-10 w-32 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
