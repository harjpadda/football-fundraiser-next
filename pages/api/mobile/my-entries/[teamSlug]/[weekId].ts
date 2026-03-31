import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../../lib/prisma";
import { getMobileUserId } from "../../../../../lib/mobileAuth";

type Result = "HOME" | "DRAW" | "AWAY";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = getMobileUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const teamSlug = String(req.query.teamSlug || "");
    const weekId = Number(req.query.weekId);

    if (!teamSlug || !Number.isFinite(weekId)) {
      return res.status(400).json({ error: "Bad params" });
    }

    const team = await prisma.team.findUnique({
      where: { slug: teamSlug },
      select: { id: true, name: true, slug: true },
    });
    if (!team) return res.status(404).json({ error: "Team not found" });

    const week = await prisma.week.findUnique({
      where: { id: weekId },
      select: { id: true, label: true },
    });
    if (!week) return res.status(404).json({ error: "Week not found" });

    // ✅ IMPORTANT: fetch ALL orders (paid + unpaid) so lines appear
    const orders = await prisma.order.findMany({
      where: { userId, teamId: team.id, weekId: week.id },
      include: {
        lines: {
          select: {
            fixtureId: true,
            lineIndex: true,
            result: true,
            fixture: {
              select: { id: true, homeTeam: true, awayTeam: true, position: true, result: true },
            },
          },
          orderBy: [{ lineIndex: "asc" }],
        },
      },
      orderBy: [{ id: "asc" }],
    });

    // Fixtures for the week (so UI can always show correct list/order)
    const fixtures = await prisma.fixture.findMany({
      where: { weekId: week.id },
      select: { id: true, homeTeam: true, awayTeam: true, position: true, result: true },
      orderBy: { position: "asc" },
    });

    // Build "lines" array from all predictions across all orders.
    // If multiple orders exist, re-index lines globally (0..N-1)
    const lines: Array<{ lineIndex: number; picks: { fixtureId: number; result: Result }[] }> = [];

    let globalLineIndex = 0;
    let totalPoints = 0;

    for (const o of orders) {
      // Group predictions by lineIndex within this order
      const byLine = new Map<number, { fixtureId: number; result: Result; correct: boolean }[]>();

      for (const lp of o.lines) {
        const li = lp.lineIndex;
        const pick = lp.result as Result;

        const correct = !!lp.fixture?.result && lp.fixture.result === pick;

        const arr = byLine.get(li) || [];
        arr.push({ fixtureId: lp.fixtureId, result: pick, correct });
        byLine.set(li, arr);
      }

      // Turn each local lineIndex into a global line entry
      const localIndexes = Array.from(byLine.keys()).sort((a, b) => a - b);

      for (const li of localIndexes) {
        const picks = byLine.get(li)!;

        // ✅ Points: count correct picks ONLY if this order is paid (optional)
        // If you want points even for unpaid orders, remove the `if (o.paid)` wrapper.
        if (o.paid) {
          for (const p of picks) if (p.correct) totalPoints += 1;
        }

        lines.push({
          lineIndex: globalLineIndex,
          picks: picks.map((p) => ({ fixtureId: p.fixtureId, result: p.result })),
        });

        globalLineIndex += 1;
      }
    }

    return res.status(200).json({
      team: { name: team.name, slug: team.slug },
      week: { id: week.id, label: week.label },
      totals: {
        lines: lines.length,
        points: totalPoints, // paid-only points (as above)
      },
      fixtures,
      lines,
    });
  } catch (err: any) {
    console.error("my-entries detail error:", err);
    return res.status(500).json({ error: "Internal Server Error", details: err?.message || String(err) });
  }
}
