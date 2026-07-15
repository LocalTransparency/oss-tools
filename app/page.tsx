import Calculator from '@/components/Calculator';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          Noblesville Schools Referendum: what it means for your property taxes
        </h1>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          On November 3, 2026, Noblesville voters will decide an operating referendum for Noblesville
          Schools. Enter your address to see an estimate of your property tax bill today, if the
          referendum passes, and if it fails — with every number sourced and every step of the math shown.{' '}
          <Link className="underline" href="/methodology">How these estimates work</Link>.
        </p>
      </header>
      <Calculator />
    </main>
  );
}
