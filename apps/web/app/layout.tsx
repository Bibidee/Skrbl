import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Skrbl — GenLayer-refereed Scrabble',
    template: '%s · Skrbl',
  },
  description:
    'Skrbl is a multiplayer Scrabble-style word game refereed by GenLayer. Every word has to stand in court.',
  applicationName: 'Skrbl',
  keywords: ['Scrabble', 'GenLayer', 'word game', 'multiplayer', 'web3', 'Supabase'],
  authors: [{ name: 'Skrbl' }],
  openGraph: {
    title: 'Skrbl',
    description: 'GenLayer-refereed Scrabble. Every word has to stand in court.',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Skrbl' },
  icons: {
    icon: '/skrbl-logo.jpg',
    apple: '/skrbl-logo.jpg',
  },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply persisted theme before paint to avoid a flash of the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('skrbl-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-text-dark antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
