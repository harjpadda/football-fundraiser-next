// pages/my-entries/[teamSlug]/[weekId].tsx
import { GetServerSideProps } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

type Fixture = {
  id: number;
  position: number;
  homeTeam: string;
  awayTeam: string;
  result: string | null; // "HOME" | "DRAW" | "AWAY" | null
};

type PredictionRow = {
  lineIndex: number;
  fixtureId: number;
  result: string; // user's pick: "HOME" | "DRAW" | "AWAY"
};

type OrderRow = {
  id: number;
  lineCount: number;
  amountPence: number;
  createdAt: string; // ISO
  paid: boolean;
  predictions: PredictionRow[];
};

type Props = {
  teamName: string;
  teamSlug: string;
  weekLabel: string;
  weekId: number;
  fixtures: Fixture[];
  orders: OrderRow[];
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions as any);
  if (!session?.user?.email) {
    return {
      redirect: {
        destination: `/auth/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const teamSlug = ctx.params?.teamSlug as string;
  const weekId = parseInt(ctx.params?.weekId as string, 10);
  if (!teamSlug || Number.isNaN(weekId)) return { notFound: true };

  const email = String(session.user.email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) return { notFound: true };

  const team = await prisma.team.findUnique({
    where: { slug: teamSlug },
    select: { id: true, name: true, slug: true },
  });
  if (!team) return { notFound: true };

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    select: {
      id: true,
      label: true,
      fixtures: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, homeTeam: true, awayTeam: true, result: true },
      },
    },
  });
  if (!week) return { notFound: true };

  const ordersRaw = await prisma.order.findMany({
    where: { userId: user.id, teamId: team.id, weekId: week.id },
    orderBy: { createdAt: "desc" },
    include: {
      lines: {
        orderBy: [{ lineIndex: "asc" }, { fixtureId: "asc" }],
        select: { lineIndex: true, fixtureId: true, result: true },
      },
    },
  });

  const fixtures: Fixture[] = week.fixtures.map((f) => ({
    id: f.id,
    position: f.position,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    result: f.result ?? null,
  }));

  const orders: OrderRow[] = ordersRaw.map((o) => ({
    id: o.id,
    lineCount: o.lineCount,
    amountPence: o.amountPence,
    createdAt: o.createdAt.toISOString(),
    paid: o.paid,
    predictions: o.lines.map((lp) => ({
      lineIndex: lp.lineIndex,
      fixtureId: lp.fixtureId,
      result: lp.result,
    })),
  }));

  return {
    props: {
      teamName: team.name,
      teamSlug: team.slug,
      weekLabel: week.label,
      weekId: week.id,
      fixtures,
      orders,
    },
  };
};

function prettyResult(r: string | null) {
  if (!r) return "—";
  if (r === "HOME") return "Home";
  if (r === "DRAW") return "Draw";
  if (r === "AWAY") return "Away";
  return r;
}

function calcPoint(pick: string | null, actual: string | null) {
  if (!actual || !pick) return null; // result not set or no pick
  return pick === actual ? 1 : 0;
}

export default function MyEntryDetail({ teamName, teamSlug, weekLabel, weekId, fixtures, orders }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <header className="space-y-3 sm:space-y-0 sm:flex sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{teamName}</h1>
            <p className="text-slate-300 mt-1 text-sm sm:text-base">
              My entries for <span className="font-medium">{weekLabel}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Link
              href="/my-entries"
              className="flex-1 sm:flex-none text-center text-sm text-slate-300 hover:text-white border border-slate-700 rounded-xl px-3 py-2.5 hover:bg-slate-800 transition"
            >
              Back
            </Link>

            <Link
              href={`/leaderboard/${teamSlug}/${weekId}`}
              className="flex-1 sm:flex-none text-center text-sm text-slate-300 hover:text-white border border-slate-700 rounded-xl px-3 py-2.5 hover:bg-slate-800 transition"
            >
              Leaderboard
            </Link>

            <Link
              href={`/team/${teamSlug}`}
              className="flex-1 sm:flex-none text-center text-sm text-slate-300 hover:text-white border border-slate-700 rounded-xl px-3 py-2.5 hover:bg-slate-800 transition"
            >
              Team page
            </Link>
          </div>
        </header>

        {orders.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-300">No entries found for this week.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((o) => {
              // Total points for this order (only where actual result exists)
              let orderPoints = 0;
              for (const p of o.predictions) {
                const actual = fixtures.find((f) => f.id === p.fixtureId)?.result ?? null;
                if (actual && p.result === actual) orderPoints += 1;
              }

              return (
                <div key={o.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4">
                  <div className="space-y-1 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
                    <div className="text-sm text-slate-300">
                      <span className="font-semibold">Order #{o.id}</span>{" "}
                      <span className="text-slate-500">· {new Date(o.createdAt).toLocaleString()}</span>
                    </div>

                    <div className="text-sm text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        Lines: <span className="font-semibold">{o.lineCount}</span>
                      </span>
                      <span>
                        Spent: <span className="font-semibold">£{(o.amountPence / 100).toFixed(2)}</span>
                      </span>
                      <span>
                        Points: <span className="font-semibold">{orderPoints}</span>
                      </span>
                      <span className={o.paid ? "text-emerald-300" : "text-amber-300"}>
                        {o.paid ? "Paid" : "Unpaid"}
                      </span>
                    </div>
                  </div>

                  {/* Each line */}
                  {Array.from({ length: o.lineCount }, (_, lineIndex) => {
                    const preds = o.predictions.filter((p) => p.lineIndex === lineIndex);

                    let linePoints = 0;
                    for (const p of preds) {
                      const actual = fixtures.find((f) => f.id === p.fixtureId)?.result ?? null;
                      if (actual && p.result === actual) linePoints += 1;
                    }

                    return (
                      <div key={lineIndex} className="border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="bg-slate-800/60 px-4 py-3 flex items-center justify-between">
                          <div className="font-medium">Line {lineIndex + 1}</div>
                          <div className="text-xs text-slate-300">
                            Points: <span className="font-semibold">{linePoints}</span>
                          </div>
                        </div>

                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                              <tr>
                                <th className="text-left px-4 py-2 w-10">#</th>
                                <th className="text-left px-4 py-2">Fixture</th>
                                <th className="text-left px-4 py-2 w-28">Pick</th>
                                <th className="text-left px-4 py-2 w-28">Result</th>
                                <th className="text-left px-4 py-2 w-20">Point</th>
                              </tr>
                            </thead>

                            <tbody>
                              {fixtures.map((f, idx) => {
                                const pick = preds.find((p) => p.fixtureId === f.id)?.result ?? null;
                                const actual = f.result;
                                const pt = calcPoint(pick, actual);

                                return (
                                  <tr key={f.id} className="border-b border-slate-900/60">
                                    <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                                    <td className="px-4 py-2">
                                      <span className="font-medium">{f.homeTeam}</span>{" "}
                                      <span className="text-slate-500 text-xs">vs</span>{" "}
                                      <span className="font-medium">{f.awayTeam}</span>
                                    </td>
                                    <td className="px-4 py-2 font-medium">{prettyResult(pick)}</td>
                                    <td className="px-4 py-2">{prettyResult(actual)}</td>
                                    <td className="px-4 py-2">{pt === null ? "—" : String(pt)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="sm:hidden p-3 space-y-3">
                          {fixtures.map((f, idx) => {
                            const pick = preds.find((p) => p.fixtureId === f.id)?.result ?? null;
                            const actual = f.result;
                            const pt = calcPoint(pick, actual);

                            const correct = pt === 1;

                            return (
                              <div key={f.id} className="border border-slate-800 rounded-2xl p-3 bg-slate-950/40">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs text-slate-400">Match {idx + 1}</div>
                                  {pt !== null && (
                                    <span
                                      className={`text-xs px-2 py-1 rounded-full border ${
                                        correct
                                          ? "border-emerald-500/50 text-emerald-200 bg-emerald-500/10"
                                          : "border-slate-700 text-slate-300 bg-slate-900/40"
                                      }`}
                                    >
                                      {correct ? "Correct +1" : "0 points"}
                                    </span>
                                  )}
                                </div>

                                <div className="font-medium mt-1 leading-snug">
                                  {f.homeTeam} <span className="text-slate-500 text-xs">vs</span> {f.awayTeam}
                                </div>

                                <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                                  <div className="text-slate-400">Pick</div>
                                  <div className="col-span-2 font-medium">{prettyResult(pick)}</div>

                                  <div className="text-slate-400">Result</div>
                                  <div className="col-span-2 font-medium">{prettyResult(actual)}</div>

                                  <div className="text-slate-400">Point</div>
                                  <div className="col-span-2 font-medium">{pt === null ? "—" : String(pt)}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-slate-500">
          Points: 1 for each correct prediction (once results are entered in Admin).
        </p>
      </div>
    </div>
  );
}
