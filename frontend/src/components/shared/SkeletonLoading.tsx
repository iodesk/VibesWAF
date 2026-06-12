// Reusable Skeleton Loading Components

export function SkeletonCard() {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div className="h-4 w-32 bg-muted rounded animate-pulse"></div>
      <div className="h-6 w-24 bg-muted/50 rounded animate-pulse"></div>
      <div className="h-3 w-40 bg-muted/50 rounded animate-pulse"></div>
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* Table Header */}
      <div className="flex gap-4 pb-3 border-b border-border">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-4 flex-1 bg-muted rounded animate-pulse"></div>
        ))}
      </div>
      {/* Table Rows */}
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b border-border/50">
          {[...Array(4)].map((_, j) => (
            <div key={j} className="h-4 flex-1 bg-muted/50 rounded animate-pulse"></div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonForm() {
  return (
    <div className="space-y-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 bg-muted rounded animate-pulse"></div>
          <div className="h-10 w-full bg-muted/50 rounded animate-pulse"></div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonList({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(items)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 border border-border rounded-lg">
          <div className="w-10 h-10 bg-muted rounded animate-pulse"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse"></div>
            <div className="h-3 w-1/2 bg-muted/50 rounded animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 bg-muted rounded-lg animate-pulse"></div>
            <div className="w-12 h-5 bg-muted/50 rounded animate-pulse"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 w-20 bg-muted/50 rounded animate-pulse"></div>
            <div className="h-7 w-16 bg-muted rounded animate-pulse"></div>
            <div className="h-3 w-24 bg-muted/50 rounded animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function SkeletonPage() {
  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-6 w-48 bg-muted rounded animate-pulse"></div>
        <div className="h-4 w-64 bg-muted/50 rounded animate-pulse"></div>
      </div>
      {/* Content */}
      <div className="space-y-4">
        <div className="h-40 w-full bg-muted/50 rounded-lg animate-pulse"></div>
        <div className="h-60 w-full bg-muted/50 rounded-lg animate-pulse"></div>
      </div>
    </div>
  )
}
