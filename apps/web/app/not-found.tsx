import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-sm text-primary">404</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight text-text-dark">
        We couldn&apos;t find that page.
      </h1>
      <p className="mt-2 max-w-md text-sm text-text-muted">
        The link may be broken or the room may have closed. Head back home and pick a game.
      </p>
      <Link href="/" className="mt-6">
        <Button>Go home</Button>
      </Link>
    </main>
  );
}
