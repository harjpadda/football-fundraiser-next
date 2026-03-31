import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getMobileUserId } from "../../../lib/mobileAuth";

function norm(v: any) {
  return typeof v === "string" ? v.toUpperCase() : v;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = getMobileUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Find logged-in user's team
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, teamId: true },
    });

    if (!user?.teamId) {
      return res.status(200).json({ team: null, scope: "ALL_TIME", rows: [] });
    }

    const team = await prisma.team.findUnique({
      where: { id: user.teamId },
      select: { id: true, name: true, slug: true },
    });

    if (!team) return res.status(200).json({ team: null, scope: "ALL_TIME", rows: [] });

    /**
     * ✅ ALL-TIME leaderboard:
     * - only PAID orders
     * - for this team
     * - across ALL weeks
     */
    const preds = await prisma.linePrediction.findMany({
      where: {
        order: {
          paid: true,
          teamId: team.id,
        },
      },
      include: {
        fixture: { select: { result: true } },
        order: {
          select: {
            id: true,
            userId: true,
            lineCount: true,
            user: { select: { name: true } },
          },
        },
      },
    });

    // Aggregate points + total lines per user
    const pointsByUser = new Map<number, number>();
    const linesByUser = new Map<number, number>();
    const nameByUser = new Map<number, string>();

    // Count each order's lineCount once per user
    const seenOrdersByUser = new Map<number, Set<number>>();

    for (const p of preds) {
      const uid = p.order.userId;
      nameByUser.set(uid, p.order.user?.name || "Unknown");

      // ✅ point if pick matches fixture result (fixture result must be set)
      const correct = p.fixture?.result ? norm(p.fixture.result) : null;
      const pick = norm(p.result);

      if (correct && pick && correct === pick) {
        pointsByUser.set(uid, (pointsByUser.get(uid) || 0) + 1);
      }

      // ✅ total lines bought (sum of order.lineCount, but only once per order)
      if (!seenOrdersByUser.has(uid)) seenOrdersByUser.set(uid, new Set());
      const seen = seenOrdersByUser.get(uid)!;

      if (!seen.has(p.order.id)) {
        seen.add(p.order.id);
        linesByUser.set(uid, (linesByUser.get(uid) || 0) + (p.order.lineCount || 0));
      }
    }

    // Build leaderboard rows
    const rowsRaw = Array.from(nameByUser.keys()).map((uid) => ({
      userId: uid,
      name: nameByUser.get(uid) || "Unknown",
      points: pointsByUser.get(uid) || 0,
      lines: linesByUser.get(uid) || 0,
    }));

    // Sort: points desc, then lines desc, then name
    rowsRaw.sort((a, b) => (b.points - a.points) || (b.lines - a.lines) || a.name.localeCompare(b.name));

    const rows = rowsRaw.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      points: r.points,
      lines: r.lines,
    }));

    return res.status(200).json({
      team: { name: team.name, slug: team.slug },
      scope: "ALL_TIME",
      rows,
    });
  } catch (err: any) {
    console.error("leaderboard error:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || String(err),
    });
  }
}
