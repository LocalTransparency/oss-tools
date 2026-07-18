import Calculator from '@/components/Calculator';
import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          Hamilton County School Referendums: what they mean for your property taxes
        </h1>
        <p className="text-sm text-muted">
          On November 3, 2026, voters across Hamilton County will decide school operating referendums.
          Enter your address to see an estimate of your property tax bill today, if your district&rsquo;s
          referendum passes, and if it fails — with every number sourced and every step of the math shown.
          The tool covers Noblesville, Hamilton Southeastern, Carmel Clay, Westfield Washington, and
          Sheridan; if your address is in another district, it will tell you.{' '}
          <Link className="text-accent underline" href="/methodology">How these estimates work</Link>.
        </p>
      </header>
      <Calculator />
    </main>
  );
}
