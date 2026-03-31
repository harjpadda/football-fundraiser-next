import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { getMobileUserId } from "../../../lib/mobileAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = getMobileUserId(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      team: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!user) return res.status(401).json({ error: "Unauthorized" });

  return res.status(200).json({ user });
}
