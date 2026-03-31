// pages/payment/success.tsx
import { GetServerSideProps } from 'next';
import Link from 'next/link';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const teamSlug = ctx.query.team || null;

  return {
    props: {
      teamSlug,
    },
  };
};

export default function PaymentSuccess({ teamSlug }: { teamSlug: string }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-8 text-center shadow-xl">
        
        <h1 className="text-3xl font-bold mb-4">Payment Successful</h1>

        <p className="text-slate-300 mb-6">
          Thanks for supporting your team!
        </p>

        {teamSlug && (
          <Link
            href={`/team/${teamSlug}`}
            className="inline-block mt-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-6 py-2 rounded-xl shadow-lg shadow-emerald-500/20 transition"
          >
            Back to Team Page
          </Link>
        )}

      </div>
    </div>
  );
}
