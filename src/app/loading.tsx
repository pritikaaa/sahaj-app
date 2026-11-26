export default function Loading() {
  return (
    <div className="space-y-3 py-6" aria-busy="true" aria-label="Loading">
      <div className="bg-muted h-7 w-48 animate-pulse rounded" />
      <div className="bg-muted h-32 animate-pulse rounded-2xl" />
      <div className="bg-muted h-32 animate-pulse rounded-2xl" />
    </div>
  );
}
