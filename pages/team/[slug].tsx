// pages/team/[slug].tsx
import { GetServerSideProps } from "next";
import { useMemo, useState } from "react";
import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";
import TopNav from "../../components/TopNav";

type Fixture = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  position: number;
};

type Week = {
  id: number;
  label: string;
};

type Team = {
  id: number;
  name: string;
  slug: string;
};

type Props = {
  team: Team | null;
  week: Week | null;
  fixtures: Fixture[];
  totalLines: number;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  // ✅ Require login
  const session: any = await getServerSession(ctx.req, ctx.res, authOptions as any);
  if (!session) {
    return {
      redirect: {
        destination: `/auth/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const slug = ctx.params?.slug as string;

  // ✅ Get team + its assigned week (and fixtures)
  const teamRecord = await prisma.team.findUnique({
    where: { slug },
    include: {
      currentWeek: {
        include: {
          fixtures: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!teamRecord) {
    return { props: { team: null, week: null, fixtures: [], totalLines: 0 } };
  }

  let weekRecord = teamRecord.currentWeek;

  // Fallback: latest week if none assigned
  if (!weekRecord) {
    weekRecord = (await prisma.week.findFirst({
      orderBy: { id: "desc" },
      include: { fixtures: { orderBy: { position: "asc" } } },
    })) as any;
  }

  if (!weekRecord) {
    return {
      props: {
        team: { id: teamRecord.id, name: teamRecord.name, slug: teamRecord.slug },
        week: null,
        fixtures: [],
        totalLines: 0,
      },
    };
  }

  // ✅ Total lines for this team + week (dev includes unpaid)
  const agg = await prisma.order.aggregate({
    where: { teamId: teamRecord.id, weekId: weekRecord.id },
    _sum: { lineCount: true },
  });

  const totalLines = agg._sum.lineCount || 0;

  return {
    props: {
      team: { id: teamRecord.id, name: teamRecord.name, slug: teamRecord.slug },
      week: { id: weekRecord.id, label: weekRecord.label },
      fixtures: weekRecord.fixtures.map((f: any) => ({
        id: f.id,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        position: f.position,
      })),
      totalLines,
    },
  };
};

const PRICE_PER_LINE_POUNDS = 2;

export default function TeamPage({ team, week, fixtures, totalLines }: Props) {
  const [lineCount, setLineCount] = useState<number>(1);

  const cost = useMemo(() => lineCount * PRICE_PER_LINE_POUNDS, [lineCount]);
  const linesArray = useMemo(() => Array.from({ length: lineCount }, (_, i) => i), [lineCount]);

  if (!team) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        Team not found.
      </div>
    );
  }

  if (!week) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
        No week assigned to this team yet (set it in /admin).
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <TopNav
        title={team.name}
        subtitle={`Week: ${week.label}`}
        rightSlot={
          <Link
            href={`/leaderboard/${team.slug}/${week.id}`}
            className="flex-1 sm:flex-none text-center text-sm text-slate-200 border border-slate-700 rounded-xl px-3 py-2.5 hover:bg-slate-800 transition"
          >
            Leaderboard
          </Link>
        }
      />

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Total lines pill */}
        <div className="inline-flex items-center gap-3 text-sm bg-slate-900/80 border border-slate-800 rounded-full px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            Total lines purchased this week: <strong>{totalLines}</strong>
          </span>
        </div>

        {/* Main Card */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-lg p-4 sm:p-6 space-y-5 sm:space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-semibold">Enter your predictions</h2>
            <p className="text-sm text-slate-400">£{PRICE_PER_LINE_POUNDS} per line</p>
          </div>

          <form method="POST" action={`/api/team/${team.slug}/play`} className="space-y-5 sm:space-y-6">
            <input type="hidden" name="lineCount" value={lineCount} />

            <div className="space-y-5">
              {linesArray.map((lineIndex) => (
                <div key={lineIndex} className="border border-slate-800 rounded-2xl overflow-hidden">
                  <div className="bg-slate-800/60 px-4 py-3 flex items-center justify-between">
                    <div className="font-medium">Line {lineIndex + 1}</div>
                    <div className="text-xs text-slate-300 hidden sm:block">Choose one outcome per match</div>
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-900/80 text-slate-300">
                        <tr>
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left">Fixture</th>
                          <th className="px-3 py-2 text-center w-24">Home</th>
                          <th className="px-3 py-2 text-center w-24">Draw</th>
                          <th className="px-3 py-2 text-center w-24">Away</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fixtures.map((f, idx) => (
                          <tr key={f.id} className={idx % 2 === 0 ? "bg-slate-950/60" : "bg-slate-900/40"}>
                            <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <span className="font-medium">{f.homeTeam}</span>{" "}
                              <span className="text-slate-400 text-xs">vs</span>{" "}
                              <span className="font-medium">{f.awayTeam}</span>
                            </td>

                            {["HOME", "DRAW", "AWAY"].map((value) => (
                              <td key={value} className="px-3 py-2 text-center">
                                <input
                                  required
                                  type="radio"
                                  value={value}
                                  name={`prediction_${lineIndex}_${f.id}`}
                                  className="h-4 w-4"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="sm:hidden p-3 space-y-3">
                    {fixtures.map((f, idx) => (
                      <div key={f.id} className="border border-slate-800 rounded-2xl p-3 bg-slate-950/40">
                        <div className="text-xs text-slate-400 mb-1">Match {idx + 1}</div>
                        <div className="font-medium mb-3 leading-snug">
                          {f.homeTeam} <span className="text-slate-500 text-xs">vs</span> {f.awayTeam}
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { v: "HOME", label: "Home" },
                            { v: "DRAW", label: "Draw" },
                            { v: "AWAY", label: "Away" },
                          ].map((opt) => (
                            <label
                              key={opt.v}
                              className="flex items-center justify-center gap-2 border border-slate-700 rounded-xl py-2.5 text-sm active:scale-[0.99]"
                            >
                              <input
                                required
                                type="radio"
                                value={opt.v}
                                name={`prediction_${lineIndex}_${f.id}`}
                                className="h-4 w-4"
                              />
                              <span>{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop totals + line controls */}
            <div className="hidden sm:flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 pt-4">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">
                  Lines: <span className="font-semibold">{lineCount}</span>
                </span>

                <div className="inline-flex items-center border border-slate-700 rounded-full overflow-hidden text-sm">
                  <button
                    type="button"
                    onClick={() => setLineCount((c) => (c > 1 ? c - 1 : 1))}
                    className="px-3 py-2 hover:bg-slate-800"
                  >
                    −
                  </button>
                  <span className="px-4 py-2 bg-slate-900 min-w-[3rem] text-center">{lineCount}</span>
                  <button
                    type="button"
                    onClick={() => setLineCount((c) => c + 1)}
                    className="px-3 py-2 hover:bg-slate-800"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm text-slate-300">
                  Total: <span className="font-semibold">£{cost}.00</span>
                </p>
                <p className="text-xs text-slate-500">£{PRICE_PER_LINE_POUNDS} per line</p>
              </div>
            </div>

            {/* Desktop submit */}
            <div className="hidden sm:flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2.5 text-sm"
              >
                Submit &amp; Pay
              </button>
            </div>

            {/* Mobile sticky bar */}
            <div className="sm:hidden sticky bottom-0 left-0 right-0 -mx-4 px-4 pt-3 pb-4 bg-slate-950/90 backdrop-blur border-t border-slate-800">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400">Lines</div>
                    <div className="text-lg font-semibold">{lineCount}</div>
                  </div>

                  <div className="inline-flex items-center border border-slate-700 rounded-full overflow-hidden text-sm">
                    <button
                      type="button"
                      onClick={() => setLineCount((c) => (c > 1 ? c - 1 : 1))}
                      className="px-3 py-2 hover:bg-slate-800"
                    >
                      −
                    </button>
                    <span className="px-4 py-2 bg-slate-900 min-w-[3rem] text-center">{lineCount}</span>
                    <button
                      type="button"
                      onClick={() => setLineCount((c) => c + 1)}
                      className="px-3 py-2 hover:bg-slate-800"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400">Total</div>
                    <div className="text-lg font-semibold">£{cost}.00</div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-3 text-sm"
                >
                  Submit &amp; Pay
                </button>

                <div className="text-center text-xs text-slate-500">£{PRICE_PER_LINE_POUNDS} per line</div>
              </div>
            </div>
          </form>
        </section>

        <p className="text-xs text-slate-500">
          Tip: You can view past entries and results via <span className="text-slate-300">My entries</span>.
        </p>
      </div>
    </div>
  );
}
