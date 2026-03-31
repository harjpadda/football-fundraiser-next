import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../../lib/prisma";

const PRICE_PER_LINE_PENCE = 200;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method not allowed");

  const slug = String(req.query.slug || "");
  const { email, name, weekId, lineCount, picks } = req.body || {};

  if (!email || !name || !weekId || !lineCount || !Array.isArray(picks)) {
    return res.status(400).json({ error: "Missing email, name, weekId, lineCount, or picks" });
  }

  const team = await prisma.team.findUnique({ where: { slug } });
  if (!team) return res.status(404).json({ error: "Team not found" });

  const week = await prisma.week.findUnique({ where: { id: Number(weekId) } });
  if (!week) return res.status(404).json({ error: "Week not found" });

  // Upsert user by email
  const user = await prisma.user.upsert({
    where: { email: String(email) },
    update: { name: String(name) },
    create: { email: String(email), name: String(name) },
  });

  const lc = Number(lineCount);
  const amountPence = lc * PRICE_PER_LINE_PENCE;

  // picks format expected:
  // [
  //   { fixtureId: 1, lineIndex: 0, result: "HOME" },
  //   ...
  // ]
  await prisma.order.create({
    data: {
      userId: user.id,
      teamId: team.id,
      weekId: week.id,
      lineCount: lc,
      amountPence,
      paid: true, // ✅ TEST MODE: mark paid to simplify
      stripeSessionId: `test_${Date.now()}`,
      lines: {
        create: picks.map((p: any) => ({
          fixture: { connect: { id: Number(p.fixtureId) } },
          week: { connect: { id: week.id } },
          lineIndex: Number(p.lineIndex),
          result: String(p.result),
        })),
      },

    },
  });

  res.status(200).json({ ok: true });
}
