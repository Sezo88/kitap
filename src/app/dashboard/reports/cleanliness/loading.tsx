export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-5 space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-8 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-4 w-full bg-muted rounded" />
        ))}
      </div>
    </div>
  );
}
