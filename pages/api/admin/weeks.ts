import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session: any = await getServerSession(req, res, authOptions as any);

  if (!session) return res.status(401).send("Unauthorized");
  if ((session as any).user?.role !== "ADMIN") return res.status(404).send("Not found");

  if (req.method === "GET") {
    const weeks = await prisma.week.findMany({
      orderBy: { id: "desc" },
      select: { id: true, label: true },
    });
    return res.status(200).json({ weeks });
  }

  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  try {
    const label = String((req.body?.label ?? req.query?.label ?? "")).trim();
    if (!label) return res.status(400).send("Missing label");

    // ✅ Create the week, plus 6 blank fixtures
    const week = await prisma.week.create({
      data: {
        label,
        fixtures: {
          create: [1, 2, 3, 4, 5, 6].map((position) => ({
            position,
            homeTeam: "TBC",
            awayTeam: "TBC",
            result: null,
          })),
        },
      },
      select: { id: true },
    });

    // send back to admin with that week selected
    return res.redirect(302, `/admin?weekId=${week.id}`);
  } catch (err: any) {
    console.error("create week error:", err);
    return res.status(500).send(err?.message || "Server error");
  }
}
