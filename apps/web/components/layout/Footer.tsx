import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-black text-white">
            W
          </span>
          <span>
            WordCourt &mdash; refereed by{' '}
            <Link
              href="https://genlayer.com"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary hover:underline"
            >
              GenLayer
            </Link>
            .
          </span>
        </div>
        <nav className="flex items-center gap-5 text-sm text-text-muted">
          <Link href="/leaderboard" className="hover:text-text-dark">
            Leaderboard
          </Link>
          <Link href="/history" className="hover:text-text-dark">
            History
          </Link>
          <Link
            href="https://docs.genlayer.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-text-dark"
          >
            Docs
          </Link>
        </nav>
      </div>
    </footer>
  );
}
