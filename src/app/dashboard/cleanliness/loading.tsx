export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sınıf listesi skeleton */}
        <div className="md:col-span-1 border rounded-lg p-4 bg-card space-y-3">
          <div className="h-6 w-24 bg-muted rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 w-full bg-muted rounded" />
          ))}
        </div>
        {/* Puanlama formu skeleton */}
        <div className="md:col-span-2 border rounded-lg p-5 bg-card space-y-4">
          <div className="h-6 w-32 bg-muted rounded" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-28 bg-muted rounded" />
              <div className="flex gap-2">
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="h-9 w-9 bg-muted rounded-full" />
                ))}
              </div>
            </div>
          ))}
          <div className="h-10 w-28 bg-muted rounded pt-4" />
        </div>
      </div>
    </div>
  );
}
