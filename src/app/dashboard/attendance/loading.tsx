export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-32 bg-muted rounded-lg" />
      <div className="flex gap-3">
        <div className="h-9 w-36 bg-muted rounded-md" />
        <div className="h-9 w-28 bg-muted rounded-md" />
        <div className="h-9 w-24 bg-muted rounded-md" />
      </div>
      <div className="rounded-lg border bg-card overflow-hidden">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-5 w-16 bg-muted rounded-full" />
            <div className="h-5 w-10 bg-muted rounded-full ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
