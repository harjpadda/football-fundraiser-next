import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { prisma } from '../lib/prisma';

type Team = {
  id: number;
  name: string;
  slug: string;
};

type Props = {
  teams: Team[];
};

export const getServerSideProps: GetServerSideProps<Props> = async () => {
 const teams = await prisma.team.findMany({
  orderBy: { name: 'asc' },
  select: {
    id: true,
    name: true,
    slug: true,
  },
});

  return { props: { teams } };
};

export default function Home({ teams }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            Football Fundraiser
          </h1>
          <p className="text-slate-300 mt-2">
            Support your team by predicting this week&apos;s matches.
          </p>
        </header>

        <section className="bg-slate-900 rounded-2xl p-6 shadow-lg border border-slate-800">
          <h2 className="text-xl font-semibold mb-4">Choose your team</h2>
          {teams.length === 0 && (
            <p className="text-slate-400">
              No teams created yet. Add some teams via Prisma Studio (for now).
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/team/${team.slug}`}
                className="block rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800 transition p-4"
              >
                <h3 className="font-semibold text-lg">{team.name}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  Click to view this week&apos;s predictor.
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
