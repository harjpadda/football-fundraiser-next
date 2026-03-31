import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions as any);

  if (!session) return res.status(401).send("Unauthorized");
  if ((session as any).user?.role !== "ADMIN") return res.status(404).send("Not found");

  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const weekId = Number(req.body.weekId);
    if (!Number.isFinite(weekId)) return res.status(400).send("Bad weekId");

    const fixtureIds = asArray(req.body.fixtureId).map((x) => Number(x));
    const homeTeams = asArray(req.body.homeTeam).map((x) => String(x ?? "").trim());
    const awayTeams = asArray(req.body.awayTeam).map((x) => String(x ?? "").trim());
    const results = asArray(req.body.result).map((x) => (String(x ?? "").trim() || null));

    if (
      fixtureIds.length === 0 ||
      fixtureIds.length !== homeTeams.length ||
      fixtureIds.length !== awayTeams.length ||
      fixtureIds.length !== results.length
    ) {
      return res.status(400).send("Bad fixtures payload");
    }

    // Update each fixture row
    for (let i = 0; i < fixtureIds.length; i++) {
      const id = fixtureIds[i];
      const homeTeam = homeTeams[i] || "TBC";
      const awayTeam = awayTeams[i] || "TBC";
      const result = results[i];

      if (result && !["HOME", "DRAW", "AWAY"].includes(result)) {
        return res.status(400).send("Invalid result value");
      }

      await prisma.fixture.update({
        where: { id },
        data: {
          homeTeam,
          awayTeam,
          result: result as any,
          weekId, // ensure it stays linked
        },
      });
    }

    return res.redirect(302, `/admin?weekId=${weekId}`);
  } catch (err: any) {
    console.error("save fixtures error:", err);
    return res.status(500).send(err?.message || "Server error");
  }
}
