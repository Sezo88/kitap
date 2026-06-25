export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-44 bg-muted rounded-lg" />
      <div className="rounded-lg border bg-card overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-5 w-16 bg-muted rounded-full" />
            <div className="h-4 w-20 bg-muted rounded ml-auto" />
            <div className="flex gap-1">
              <div className="h-7 w-16 bg-muted rounded" />
              <div className="h-7 w-7 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
