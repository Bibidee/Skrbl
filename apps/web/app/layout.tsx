import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'WordCourt — GenLayer-refereed Scrabble',
    template: '%s · WordCourt',
  },
  description:
    'WordCourt is a multiplayer Scrabble-style word game refereed by GenLayer. Every word has to stand in court.',
  applicationName: 'WordCourt',
  keywords: ['Scrabble', 'GenLayer', 'word game', 'multiplayer', 'web3', 'Supabase'],
  authors: [{ name: 'WordCourt' }],
  openGraph: {
    title: 'WordCourt',
    description: 'GenLayer-refereed Scrabble. Every word has to stand in court.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'WordCourt' },
};

export const viewport: Viewport = {
  themeColor: '#6D28D9',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-text-dark antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
