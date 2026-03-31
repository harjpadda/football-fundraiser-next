import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../../../lib/prisma";

// If you already have an admin-only guard, you can add it here.
// For now, assume your /admin is already locked.

type Result = "HOME" | "DRAW" | "AWAY" | null;

type IncomingFixture = {
  id?: number; // optional existing fixture id
  position: number; // 1..6
  homeTeam: string;
  awayTeam: string;
  result?: Result;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const weekId = Number(req.query.weekId);

  if (!Number.isFinite(weekId)) return res.status(400).json({ error: "Bad weekId" });

  if (req.method === "GET") {
    const fixtures = await prisma.fixture.findMany({
      where: { weekId },
      orderBy: { position: "asc" },
    });
    return res.status(200).json({ fixtures });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { fixtures } = req.body as { fixtures: IncomingFixture[] };

    if (!Array.isArray(fixtures)) {
      return res.status(400).json({ error: "fixtures must be an array" });
    }

    // Basic validation + normalize into exactly 6 positions
    for (const f of fixtures) {
      if (!f.position || f.position < 1 || f.position > 6) {
        return res.status(400).json({ error: "Each fixture needs position 1..6" });
      }
      if (!f.homeTeam?.trim() || !f.awayTeam?.trim()) {
        return res.status(400).json({ error: "Each fixture needs homeTeam and awayTeam" });
      }
      if (f.result && !["HOME", "DRAW", "AWAY"].includes(f.result)) {
        return res.status(400).json({ error: "Invalid result" });
      }
    }

    // Upsert by (weekId, position) is ideal, but requires a unique constraint.
    // So we do: for each position, find existing, then update or create.
    for (const f of fixtures) {
      const existing = await prisma.fixture.findFirst({
        where: { weekId, position: f.position },
        select: { id: true },
      });

      if (existing) {
        await prisma.fixture.update({
          where: { id: existing.id },
          data: {
            homeTeam: f.homeTeam.trim(),
            awayTeam: f.awayTeam.trim(),
            result: (f.result ?? null) as any,
          },
        });
      } else {
        await prisma.fixture.create({
          data: {
            weekId,
            position: f.position,
            homeTeam: f.homeTeam.trim(),
            awayTeam: f.awayTeam.trim(),
            result: (f.result ?? null) as any,
          },
        });
      }
    }

    const updated = await prisma.fixture.findMany({
      where: { weekId },
      orderBy: { position: "asc" },
    });

    return res.status(200).json({ ok: true, fixtures: updated });
  } catch (err: any) {
    console.error("save fixtures error:", err);
    return res.status(500).json({ error: "Internal Server Error", details: err?.message || String(err) });
  }
}
