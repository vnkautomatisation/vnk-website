export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-7 w-28 rounded bg-muted" />
        <div className="h-4 w-56 rounded bg-muted" />
      </div>
      {/* Avatar + name section */}
      <div className="rounded-xl border p-6">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-4 w-28 rounded bg-muted" />
            <div className="h-8 w-28 rounded-lg bg-muted" />
          </div>
        </div>
      </div>
      {/* Personal info form */}
      <div className="rounded-xl border p-6 space-y-6">
        <div className="h-5 w-48 rounded bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-10 w-full rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
      {/* Security section */}
      <div className="rounded-xl border p-6 space-y-6">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-10 w-full rounded-lg bg-muted" />
            </div>
          ))}
        </div>
      </div>
      {/* Save button */}
      <div className="flex justify-end">
        <div className="h-10 w-36 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
