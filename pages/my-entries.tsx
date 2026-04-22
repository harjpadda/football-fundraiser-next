// pages/my-entries.tsx
import { GetServerSideProps } from "next";
import Link from "next/link";
import TopNav from "../components/TopNav";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../lib/auth";
import { prisma } from "../lib/prisma";

type EntryRow = {
  teamName: string;
  teamSlug: string;
  weekId: number;
  weekLabel: string;
  lines: number;
  amountPence: number;
  lastPlayedAt: string; // ISO string
};

type Props = {
  entries: EntryRow[];
  email: string;
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session: any = await getServerSession(ctx.req, ctx.res, authOptions as any);

  if (!session?.user?.email) {
    return {
      redirect: {
        destination: `/auth/signin?callbackUrl=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const email = String(session.user.email);

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      orders: {
        include: {
          team: true,
          week: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const orders = user?.orders ?? [];

  // Group by team+week
  const map = new Map<string, EntryRow>();

  for (const o of orders) {
    const key = `${o.teamId}-${o.weekId}`;
    const existing = map.get(key);

    const amountPence = o.amountPence ?? o.lineCount * 200; // fallback

    if (!existing) {
      map.set(key, {
        teamName: o.team.name,
        teamSlug: o.team.slug,
        weekId: o.weekId,
        weekLabel: o.week.label,
        lines: o.lineCount,
        amountPence,
        lastPlayedAt: o.createdAt.toISOString(),
      });
    } else {
      existing.lines += o.lineCount;
      existing.amountPence += amountPence;

      // keep most recent date
      if (new Date(o.createdAt).getTime() > new Date(existing.lastPlayedAt).getTime()) {
        existing.lastPlayedAt = o.createdAt.toISOString();
      }

      map.set(key, existing);
    }
  }

  const entries = Array.from(map.values()).sort(
    (a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime()
  );

  return { props: { entries, email } };
};

export default function MyEntries({ entries, email }: Props) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <TopNav title="My entries" subtitle={`Signed in as ${email}`} />

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {entries.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
            <p className="text-slate-300">You haven’t entered any games yet.</p>
            <Link
              href="/"
              className="inline-block mt-4 rounded-xl border border-slate-700 hover:bg-slate-800 px-4 py-2.5 text-sm"
            >
              Go to Home
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-300 border-b border-slate-800">
                  <tr>
                    <th className="text-left px-4 py-3">Team</th>
                    <th className="text-left px-4 py-3">Week</th>
                    <th className="text-right px-4 py-3">Lines</th>
                    <th className="text-right px-4 py-3">Spent</th>
                    <th className="text-right px-4 py-3">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={`${e.teamSlug}-${e.weekId}`} className="border-b border-slate-900/60">
                      <td className="px-4 py-3 font-medium">{e.teamName}</td>
                      <td className="px-4 py-3 text-slate-300">{e.weekLabel}</td>
                      <td className="px-4 py-3 text-right">{e.lines}</td>
                      <td className="px-4 py-3 text-right">£{(e.amountPence / 100).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/my-entries/${e.teamSlug}/${e.weekId}`}
                          className="text-emerald-400 hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {entries.map((e) => (
                <div
                  key={`${e.teamSlug}-${e.weekId}`}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4"
                >
                  <div className="font-semibold text-lg leading-snug">{e.teamName}</div>
                  <div className="text-sm text-slate-300 mt-1">{e.weekLabel}</div>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    <div className="text-slate-400">Lines</div>
                    <div className="text-right font-medium">{e.lines}</div>
                    <div className="text-slate-400">Spent</div>
                    <div className="text-right font-medium">£{(e.amountPence / 100).toFixed(2)}</div>
                  </div>

                  <Link
                    href={`/my-entries/${e.teamSlug}/${e.weekId}`}
                    className="mt-3 inline-block w-full text-center rounded-xl border border-slate-700 hover:bg-slate-800 px-4 py-2.5 text-sm"
                  >
                    View entries
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-xs text-slate-500">
          This list groups your plays by <span className="text-slate-300">team</span> and{" "}
          <span className="text-slate-300">week</span>.
        </p>
      </div>
    </div>
  );
}
