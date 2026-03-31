import type { NextApiRequest, NextApiResponse } from "next";
import { getMobileUserId } from "../../../lib/mobileAuth";
import { prisma } from "../../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const userId = getMobileUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // ✅ show ALL orders (paid + unpaid) so user can see their entries
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        team: { select: { id: true, name: true, slug: true } },
        week: { select: { id: true, label: true } },
      },
      orderBy: { id: "desc" },
    });

    if (orders.length === 0) return res.status(200).json({ entries: [] });

    // Group orders by team+week and sum lineCount/amount
    const key = (teamId: number, weekId: number) => `${teamId}:${weekId}`;

    const grouped = new Map<
      string,
      {
        team: { id: number; name: string; slug: string };
        week: { id: number; label: string };
        lineCount: number;
        amountPence: number;
        orderIds: number[];
        // if any order is paid, treat group as paid
        paid: boolean;
      }
    >();

    for (const o of orders) {
      const k = key(o.teamId, o.weekId);
      const cur =
        grouped.get(k) || {
          team: o.team,
          week: o.week,
          lineCount: 0,
          amountPence: 0,
          orderIds: [],
          paid: false,
        };

      cur.lineCount += o.lineCount;
      cur.amountPence += o.amountPence;
      cur.orderIds.push(o.id);
      cur.paid = cur.paid || o.paid;

      grouped.set(k, cur);
    }

    // Compute points ONLY from PAID orders (so leaderboard/points are fair)
    const entries = [];
    for (const g of grouped.values()) {
      const paidOrderIds = await prisma.order
        .findMany({
          where: { id: { in: g.orderIds }, paid: true },
          select: { id: true },
        })
        .then((x) => x.map((o) => o.id));

      let points = 0;

      if (paidOrderIds.length > 0) {
        const preds = await prisma.linePrediction.findMany({
          where: { orderId: { in: paidOrderIds } },
          include: { fixture: { select: { result: true } } },
        });

        for (const p of preds) {
          if (p.fixture?.result && p.fixture.result === p.result) points += 1;
        }
      }

      entries.push({
        team: g.team,
        week: g.week,
        lineCount: g.lineCount,
        amountPence: g.amountPence,
        paid: g.paid,
        points,
      });
    }

    entries.sort((a, b) => (b.week.id - a.week.id) || a.team.name.localeCompare(b.team.name));

    return res.status(200).json({ entries });
  } catch (err: any) {
    console.error("my-entries error:", err);
    return res.status(500).json({ error: "Internal Server Error", details: err?.message || String(err) });
  }
}
