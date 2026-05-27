export default function RootLoading() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center" aria-busy="true">
      <div className="flex items-center gap-3 text-sm text-text-muted">
        <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-primary" />
        Loading WordCourt&hellip;
      </div>
    </main>
  );
}
