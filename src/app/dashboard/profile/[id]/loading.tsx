export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-28 bg-muted rounded-lg" />
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 bg-muted rounded-full" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-muted rounded" />
            <div className="h-4 w-24 bg-muted rounded" />
          </div>
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-20 bg-muted rounded" />
            <div className="h-4 w-full bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
