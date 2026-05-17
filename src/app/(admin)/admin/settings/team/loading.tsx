// Skeleton loading pour /admin/settings/team
export default function TeamLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Hero skeleton */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-5 h-[88px]" />

      {/* Tabs skeleton */}
      <div className="border-b">
        <div className="flex gap-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 w-32 bg-muted rounded-t-md" />
          ))}
        </div>
      </div>

      {/* Toolbar skeleton */}
      <div className="flex gap-2 flex-wrap">
        <div className="h-9 w-72 bg-muted rounded-md" />
        <div className="h-9 w-32 bg-muted rounded-md" />
        <div className="h-9 w-32 bg-muted rounded-md" />
        <div className="h-9 w-40 bg-muted rounded-md" />
      </div>

      {/* Compteur */}
      <div className="h-5 w-40 bg-muted rounded" />

      {/* Liste skeleton */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="divide-y">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-11 w-11 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-72 bg-muted rounded" />
              </div>
              <div className="h-5 w-24 bg-muted rounded-full" />
              <div className="h-8 w-8 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
