import Link from 'next/link';
import { ArrowRight, Gavel, Sparkles, ShieldCheck, Trophy, Users2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Card, CardDescription, CardTitle } from '@/components/ui/Card';
import { DICTIONARY_MODE_LABELS, MVP_DICTIONARY_MODES } from '@wordcourt/shared';

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <WhySection />
        <ModesSection />
        <HowItWorksSection />
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-surface-soft via-background to-background" />
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pt-28">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Gavel size={14} aria-hidden /> GenLayer-refereed Scrabble
            </span>
            <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight text-text-dark sm:text-5xl lg:text-6xl">
              Every word has to{' '}
              <span className="bg-gradient-to-r from-primary to-primary-dark bg-clip-text text-transparent">
                stand in court.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-text-muted">
              WordCourt is a multiplayer word game where{' '}
              <strong className="text-text-dark">Supabase</strong> powers rooms, realtime
              play, private racks, and chat &mdash; while{' '}
              <strong className="text-text-dark">GenLayer</strong> acts as the trusted referee
              for board state, word validation, scoring, challenges, and final settlement.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/lobby">
                <Button size="lg">
                  Enter the lobby <ArrowRight size={18} />
                </Button>
              </Link>
              <Link href="/leaderboard">
                <Button size="lg" variant="secondary">
                  See leaderboard
                </Button>
              </Link>
            </div>
          </div>

          <BoardPreview />
        </div>
      </div>
    </section>
  );
}

/** Static decorative 15x15 preview using shared palette tokens. */
function BoardPreview() {
  const rows = 15;
  const cols = 15;
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-board-border/40 bg-board-base p-3 shadow-xl shadow-primary/10">
        <div
          className="grid gap-[2px]"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: rows * cols }).map((_, i) => {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const cls = previewClass(r, c);
            const isCenter = r === 7 && c === 7;
            return (
              <div
                key={i}
                className={`aspect-square rounded-[3px] ${cls} flex items-center justify-center`}
                aria-hidden
              >
                {isCenter && <span className="text-[10px] text-white">★</span>}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-text-muted">
        Standard 15&times;15 board with classic premium squares.
      </p>
    </div>
  );
}

function previewClass(row: number, col: number): string {
  // Mirrors the official premium layout in @wordcourt/shared/board.ts
  const layout = [
    'T..d...T...d..T',
    '.D...t...t...D.',
    '..D...d.d...D..',
    'd..D...d...D..d',
    '....D.....D....',
    '.t...t...t...t.',
    '..d...d.d...d..',
    'T..d...*...d..T',
    '..d...d.d...d..',
    '.t...t...t...t.',
    '....D.....D....',
    'd..D...d...D..d',
    '..D...d.d...D..',
    '.D...t...t...D.',
    'T..d...T...d..T',
  ];
  const sym = layout[row]?.[col] ?? '.';
  switch (sym) {
    case 'T':
      return 'bg-square-tw';
    case 'D':
      return 'bg-square-dw';
    case 't':
      return 'bg-square-tl';
    case 'd':
      return 'bg-square-dl';
    case '*':
      return 'bg-square-centre';
    default:
      return 'bg-square-normal';
  }
}

function WhySection() {
  const items = [
    {
      icon: ShieldCheck,
      title: 'Verifiable referee',
      body: 'Every move, score, and challenge is validated by a GenLayer Intelligent Contract. The official board, scores, and winner live on-chain.',
    },
    {
      icon: Sparkles,
      title: 'Realtime that feels instant',
      body: 'Supabase Realtime powers presence, chat, and turn updates. Your private rack is fetched only by you.',
    },
    {
      icon: Gavel,
      title: 'Challenges that get judged',
      body: 'Disputes go to the contract. If a challenge succeeds, the move is rejected. If it fails, the challenger loses their next turn.',
    },
    {
      icon: Trophy,
      title: 'Auditable history',
      body: 'Tile bag, rack commitments, formed words, and per-move scoring are all kept on-chain for inspection.',
    },
  ];
  return (
    <section className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-black tracking-tight text-text-dark sm:text-4xl">
            Why GenLayer makes Scrabble fair.
          </h2>
          <p className="mt-3 text-text-muted">
            Scrabble has trust problems: who dealt the tiles, was the word valid, was the
            score right, did the challenge resolve fairly? GenLayer settles all of it.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, title, body }) => (
            <Card key={title}>
              <Icon className="text-primary" size={28} aria-hidden />
              <CardTitle className="mt-4">{title}</CardTitle>
              <CardDescription>{body}</CardDescription>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function ModesSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black tracking-tight text-text-dark sm:text-4xl">
              Pick your dictionary.
            </h2>
            <p className="mt-3 text-text-muted">
              Start with one of the MVP modes. More join later, including tournament and
              wager play.
            </p>
          </div>
          <div className="hidden items-center gap-2 text-sm text-text-muted sm:flex">
            <Users2 size={16} aria-hidden /> 2&ndash;4 players
          </div>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {MVP_DICTIONARY_MODES.map((mode) => (
            <Card key={mode}>
              <div className="flex items-center justify-between">
                <CardTitle>{DICTIONARY_MODE_LABELS[mode]}</CardTitle>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  MVP
                </span>
              </div>
              <CardDescription>{describeMode(mode)}</CardDescription>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function describeMode(mode: string): string {
  switch (mode) {
    case 'classic':
      return 'Standard Scrabble dictionary. Validation happens through GenLayer consensus over an authoritative word source.';
    case 'crypto':
      return 'A curated dictionary of crypto terms: TOKEN, ROLLUP, BRIDGE, ORACLE, VALIDATOR, CONSENSUS, STAKING.';
    case 'genlayer':
      return 'GenLayer ecosystem terms: GENLAYER, VALIDATOR, CONSENSUS, GREYBOX, PROMPT, EQUIVALENCE, INTELLIGENT, CONTRACT.';
    default:
      return 'Community curated word list.';
  }
}

function HowItWorksSection() {
  const steps = [
    { n: '01', t: 'Connect wallet', d: 'Sign in with your wallet to create or join a room.' },
    { n: '02', t: 'Create or join', d: 'Pick a mode and seat count, share the room code, ready up.' },
    { n: '03', t: 'Get your private rack', d: 'Supabase deals tiles; only you can read your own rack.' },
    { n: '04', t: 'Play a word', d: 'Drag tiles, preview the score, then submit. GenLayer validates.' },
    { n: '05', t: 'Challenge or pass', d: 'Dispute a word or skip a turn. Resolutions are recorded on-chain.' },
    { n: '06', t: 'Settle the match', d: 'GenLayer crowns the winner and writes the final settlement.' },
  ];
  return (
    <section className="border-t border-border bg-surface-soft">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="max-w-2xl text-3xl font-black tracking-tight text-text-dark sm:text-4xl">
          A game of words, judged by code.
        </h2>
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.n}
              className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
            >
              <span className="font-mono text-sm text-primary">{s.n}</span>
              <h3 className="mt-2 text-lg font-bold text-text-dark">{s.t}</h3>
              <p className="mt-1 text-sm text-text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-black tracking-tight text-text-dark sm:text-4xl">
          Ready to play words that prove themselves?
        </h2>
        <p className="mt-3 text-text-muted">
          Connect a wallet, jump in the lobby, and let the contract referee the game.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/lobby">
            <Button size="lg">
              Open the lobby <ArrowRight size={18} />
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button size="lg" variant="ghost">
              View leaderboard
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
