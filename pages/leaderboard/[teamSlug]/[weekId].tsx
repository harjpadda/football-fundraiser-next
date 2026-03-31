// pages/leaderboard/[teamSlug]/[weekId].tsx
import { GetServerSideProps } from "next";
import Link from "next/link";
import { prisma } from "../../../lib/prisma";

type Row = {
  userName: string;
  userEmail: string;
  points: number;
  lines: number;
};

type Props = {
  teamName: string;
  teamSlug: string;
  weekLabel: string;
  weekId: number;
  rows: Row[];
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const teamSlug = ctx.params?.teamSlug as string;
  const weekId = parseInt(ctx.params?.weekId as string, 10);
  if (!teamSlug || Number.isNaN(weekId)) return { notFound: true };

  const team = await prisma.team.findUnique({
    where: { slug: teamSlug },
    select: { id: true, name: true, slug: true },
  });
  if (!team) return { notFound: true };

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    select: { id: true, label: true },
  });
  if (!week) return { notFound: true };

  const orders = await prisma.order.findMany({
    where: {
      teamId: team.id,
      weekId: week.id,
      // In production you probably want: paid: true
    },
    include: {
      user: { select: { name: true, email: true } },
      lines: {
        include: {
          fixture: { select: { result: true } },
        },
      },
    },
  });

  const map = new Map<string, Row>();

  for (const o of orders) {
    const key = o.user.email;
    const existing =
      map.get(key) ?? {
        userName: o.user.name,
        userEmail: o.user.email,
        points: 0,
        lines: 0,
      };

    existing.lines += o.lineCount;

    for (const lp of o.lines) {
      const actual = lp.fixture.result;
      if (actual && lp.result === actual) {
        existing.points += 1;
      }
    }

    map.set(key, existing);
  }

  const rows = Array.from(map.values()).sort((a, b) => {
    // Sort by points desc, then lines desc (nice tie-breaker)
    if (b.points !== a.points) return b.points - a.points;
    return b.lines - a.lines;
  });

  return {
    props: {
      teamName: team.name,
      teamSlug: team.slug,
      weekLabel: week.label,
      weekId: week.id,
      rows,
    },
  };
};

export default function Leaderboard({ teamName, teamSlug, weekLabel, weekId, rows }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <header className="space-y-3 sm:space-y-0 sm:flex sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Leaderboard</h1>
            <p className="text-slate-300 mt-1 text-sm sm:text-base">
              {teamName} · {weekLabel}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href={`/team/${teamSlug}`}
              className="flex-1 sm:flex-none text-center text-sm text-slate-300 hover:text-white border border-slate-700 rounded-xl px-3 py-2.5 hover:bg-slate-800 transition"
            >
              Team page
            </Link>

            <Link
              href={`/my-entries/${teamSlug}/${weekId}`}
              className="flex-1 sm:flex-none text-center text-sm text-slate-300 hover:text-white border border-slate-700 rounded-xl px-3 py-2.5 hover:bg-slate-800 transition"
            >
              My entries
            </Link>
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            No entries yet.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                  <tr>
                    <th className="text-left px-4 py-3 w-20">Rank</th>
                    <th className="text-left px-4 py-3">Player</th>
                    <th className="text-right px-4 py-3 w-28">Points</th>
                    <th className="text-right px-4 py-3 w-24">Lines</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={r.userEmail} className="border-b border-slate-900/60">
                      <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium">{r.userName}</td>
                      <td className="px-4 py-3 text-right font-semibold">{r.points}</td>
                      <td className="px-4 py-3 text-right">{r.lines}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {rows.map((r, idx) => (
                <div key={r.userEmail} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-400">Rank</div>
                    <div className="text-sm font-semibold">#{idx + 1}</div>
                  </div>

                  <div className="mt-2 font-semibold text-lg">{r.userName}</div>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    <div className="text-slate-400">Points</div>
                    <div className="text-right font-semibold">{r.points}</div>

                    <div className="text-slate-400">Lines</div>
                    <div className="text-right font-semibold">{r.lines}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-xs text-slate-500">
          Scoring: 1 point per correct prediction (6 predictions per line).
        </p>
      </div>
    </div>
  );
}
