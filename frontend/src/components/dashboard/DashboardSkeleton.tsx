export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
          <div className="h-3.5 w-56 bg-muted/60 rounded animate-pulse" />
        </div>
        <div className="h-8 w-28 bg-muted/60 rounded-lg animate-pulse" />
      </div>
      <div className="h-10 w-full bg-muted/40 rounded-lg animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-3">
            <div className="w-8 h-8 bg-muted rounded-lg animate-pulse" />
            <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" />
            <div className="h-6 w-14 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="border border-border rounded-lg">
        <div className="p-5 border-b border-border">
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="p-6 h-72 bg-muted/20 animate-pulse" />
      </div>
    </div>
  )
}
