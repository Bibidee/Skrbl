'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { clientLogger } from '@/lib/logger/client';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    clientLogger.error('route error boundary', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold text-text-dark">Something went wrong.</h1>
        <p className="mt-2 text-sm text-text-muted">
          We logged the error. You can try again, or head back home.
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-text-muted">digest: {error.digest}</p>
        ) : null}
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={reset}>Try again</Button>
          <Button variant="secondary" onClick={() => (window.location.href = '/')}>
            Go home
          </Button>
        </div>
      </div>
    </main>
  );
}
