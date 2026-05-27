'use client';

/**
 * Last-resort error boundary that catches errors thrown by the root layout itself.
 * Must include <html> and <body> tags because the layout has already failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: '4rem 1.5rem',
          background: '#F8F7FF',
          color: '#1F1F1F',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>WordCourt failed to render.</h1>
        <p style={{ marginTop: '0.5rem', color: '#6B7280' }}>
          {error.digest ? `digest: ${error.digest}` : 'Please try again.'}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '1.5rem',
            background: '#6D28D9',
            color: '#FFFFFF',
            padding: '0.6rem 1.2rem',
            border: 'none',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
