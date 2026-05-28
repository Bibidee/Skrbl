import Link from 'next/link';
import Image from 'next/image';
import { AccountMenu } from '@/components/wallet/AccountMenu';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const NAV = [
  { href: '/lobby', label: 'Lobby' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/history', label: 'History' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2">
          <Image
            src="/skrbl-logo.jpg"
            alt="Skrbl"
            width={36}
            height={36}
            priority
            className="h-9 w-9 rounded-lg shadow-sm transition-transform group-hover:scale-105"
          />
          <span className="text-lg font-bold tracking-tight text-text-dark">
            Skr<span className="text-primary">bl</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-text-muted transition-colors hover:text-text-dark"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
