// pages/admin.tsx
import { GetServerSideProps } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/auth";
import { prisma } from "../lib/prisma";

type Fixture = {
  id: number;
  position: number;
  homeTeam: string;
  awayTeam: string;
  result: string | null; // "HOME" | "DRAW" | "AWAY" | null
};

type Week = {
  id: number;
  label: string;
  fixtures: Fixture[];
};

type Team = {
  id: number;
  name: string;
  slug: string;
  currentWeekId: number | null;
};

type Props = {
  weeks: Week[];
  teams: Team[];
  selectedWeekId: number | null;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions as any);

  if (!session) {
    return {
      redirect: {
        destination: `/auth/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  if ((session as any).user?.role !== "ADMIN") {
    return { notFound: true };
  }

  const selectedWeekId =
    ctx.query.weekId ? parseInt(String(ctx.query.weekId), 10) : null;

  // ✅ IMPORTANT: we select `result` so dropdown values persist after save
  const weeks = await prisma.week.findMany({
    orderBy: { id: "desc" },
    select: {
      id: true,
      label: true,
      fixtures: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          homeTeam: true,
          awayTeam: true,
          result: true, // ✅ load result
        },
      },
    },
  });

  const teams = await prisma.team.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      currentWeekId: true,
    },
  });

  // If no weekId in URL, default to most recent week
  const finalSelectedWeekId =
    selectedWeekId ?? (weeks.length > 0 ? weeks[0].id : null);

  return {
    props: {
      weeks,
      teams,
      selectedWeekId: finalSelectedWeekId,
    },
  };
};

function prettyResult(r: string | null) {
  if (!r) return "(Not set)";
  if (r === "HOME") return "Home";
  if (r === "DRAW") return "Draw";
  if (r === "AWAY") return "Away";
  return r;
}

export default function AdminPage({ weeks, teams, selectedWeekId }: Props) {
  const selectedWeek = weeks.find((w) => w.id === selectedWeekId) ?? null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Admin</h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage weeks, fixtures & team assignments
            </p>
          </div>

          <Link
            href="/"
            className="text-sm text-slate-300 hover:text-white border border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-800 transition"
          >
            Home
          </Link>
        </header>

        {/* Create week */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Create a new week</h2>

          <form
            method="POST"
            action="/api/admin/weeks"
            className="flex flex-col sm:flex-row gap-3"
          >
            <input
              name="label"
              placeholder="Week label (e.g. 12 Jan 2026)"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm"
              required
            />
            <button className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 text-sm">
              Add week
            </button>
          </form>

          <p className="text-xs text-slate-500">
            Tip: your “create week” API can auto-create 6 blank fixtures.
          </p>
        </section>

        {/* Select week */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Select week to edit</h2>

          {weeks.length === 0 ? (
            <p className="text-slate-300">No weeks yet — create one above.</p>
          ) : (
            <form method="GET" action="/admin" className="flex gap-3 items-center">
              <select
                name="weekId"
                defaultValue={selectedWeekId ?? undefined}
                className="rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm"
              >
                {weeks.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label} (ID {w.id})
                  </option>
                ))}
              </select>
              <button className="rounded-xl border border-slate-700 hover:bg-slate-800 px-4 py-2 text-sm">
                Load
              </button>
            </form>
          )}
        </section>

        {/* Edit fixtures */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Edit fixtures</h2>

          {!selectedWeek ? (
            <p className="text-slate-300">Select a week first.</p>
          ) : (
            <>
              <div className="text-sm text-slate-300">
                Editing: <span className="font-semibold">{selectedWeek.label}</span>{" "}
                <span className="text-slate-500">(Week ID {selectedWeek.id})</span>
              </div>

              <form method="POST" action="/api/admin/fixtures" className="space-y-4">
                <input type="hidden" name="weekId" value={selectedWeek.id} />

                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                      <tr>
                        <th className="text-left px-3 py-2 w-12">#</th>
                        <th className="text-left px-3 py-2">Home</th>
                        <th className="text-left px-3 py-2">Away</th>
                        <th className="text-left px-3 py-2 w-44">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedWeek.fixtures.map((f) => (
                        <tr key={f.id} className="border-b border-slate-900/60">
                          <td className="px-3 py-2 text-slate-400">
                            {f.position}
                            <input type="hidden" name="fixtureId" value={f.id} />
                          </td>

                          <td className="px-3 py-2">
                            <input
                              name="homeTeam"
                              defaultValue={f.homeTeam}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm"
                              required
                            />
                          </td>

                          <td className="px-3 py-2">
                            <input
                              name="awayTeam"
                              defaultValue={f.awayTeam}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm"
                              required
                            />
                          </td>

                          <td className="px-3 py-2">
                            {/* ✅ THIS keeps the selected value after saving */}
                            <select
                              name="result"
                              defaultValue={f.result ?? ""}
                              className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm"
                            >
                              <option value="">(Not set)</option>
                              <option value="HOME">Home</option>
                              <option value="DRAW">Draw</option>
                              <option value="AWAY">Away</option>
                            </select>
                            <div className="text-xs text-slate-500 mt-1">
                              Current: {prettyResult(f.result)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <button className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2.5 text-sm">
                    Save fixtures
                  </button>
                </div>
              </form>
            </>
          )}
        </section>

        {/* Assign week to team */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-semibold">Assign a week to a team</h2>

          {teams.length === 0 ? (
            <p className="text-slate-300">No teams found.</p>
          ) : weeks.length === 0 ? (
            <p className="text-slate-300">Create a week first.</p>
          ) : (
            <form
              method="POST"
              action="/api/admin/team-week"
              className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
            >
              <div>
                <label className="block text-xs text-slate-400 mb-1">Team</label>
                <select
                  name="teamId"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm"
                  required
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Week</label>
                <select
                  name="weekId"
                  defaultValue={selectedWeekId ?? undefined}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm"
                  required
                >
                  {weeks.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.label} (ID {w.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex gap-3">
                <button className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2.5 text-sm">
                  Assign
                </button>

                {selectedWeekId && (
                  <Link
                    href={`/team/${teams[0].slug}`}
                    className="rounded-xl border border-slate-700 hover:bg-slate-800 px-5 py-2.5 text-sm text-center"
                  >
                    Open a team page
                  </Link>
                )}
              </div>
            </form>
          )}

          <div className="mt-3 text-xs text-slate-500">
            Assigning a week sets the fixtures shown on the Team page.
          </div>
        </section>

        {/* Team overview */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-3">
          <h2 className="text-xl font-semibold">Teams overview</h2>
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                <tr>
                  <th className="text-left px-3 py-2">Team</th>
                  <th className="text-left px-3 py-2">Slug</th>
                  <th className="text-left px-3 py-2">Assigned week</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} className="border-b border-slate-900/60">
                    <td className="px-3 py-2 font-medium">{t.name}</td>
                    <td className="px-3 py-2 text-slate-300">{t.slug}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {t.currentWeekId ? `Week ID ${t.currentWeekId}` : "Not set"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
