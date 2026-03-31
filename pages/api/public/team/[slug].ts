import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end("Method not allowed");

  const slug = String(req.query.slug || "");

  const team = await prisma.team.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      currentWeekId: true,
    },
  });

  if (!team) return res.status(404).json({ error: "Team not found" });

  const week =
    (team.currentWeekId
      ? await prisma.week.findUnique({
          where: { id: team.currentWeekId },
          select: { id: true, label: true },
        })
      : null) ||
    (await prisma.week.findFirst({
      orderBy: { id: "desc" },
      select: { id: true, label: true },
    }));

  if (!week) return res.status(200).json({ team, week: null, fixtures: [], totalLinesThisWeek: 0, pricePerLinePence: 200 });

  const fixtures = await prisma.fixture.findMany({
    where: { weekId: week.id },
    orderBy: { position: "asc" },
    select: { id: true, position: true, homeTeam: true, awayTeam: true, result: true, kickoff: true, },
  });

  const agg = await prisma.order.aggregate({
    where: { teamId: team.id, weekId: week.id },
    _sum: { lineCount: true },
  });

  res.status(200).json({
    team,
    week,
    fixtures,
    totalLinesThisWeek: agg._sum.lineCount || 0,
    pricePerLinePence: 200,
  });
}
