export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-48 bg-muted rounded-lg" />
        <div className="h-4 w-64 bg-muted rounded mt-2" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-muted rounded-lg" />
              <div className="h-5 w-40 bg-muted rounded" />
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-4 w-full bg-muted rounded" />
              <div className="h-4 w-5/6 bg-muted rounded" />
            </div>
            <div className="h-4 w-28 bg-muted rounded pt-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
