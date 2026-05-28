import { Header } from '@/components/layout/Header';
import { AuthCard } from '@/components/auth/AuthCard';

export default function SignupPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <AuthCard mode="signup" />
      </main>
    </>
  );
}
