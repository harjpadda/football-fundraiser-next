// pages/api/admin/team-weeks.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const session: any = await getServerSession(req, res, authOptions as any);
if (!session) return res.status(401).send("Please sign in.");

if ((session as any).user?.role !== "ADMIN") {
  return res.status(403).send("Admins only.");
}


  const teamIdsRaw = req.body.teamId;
  const weekIdsRaw = req.body.currentWeekId;

  const teamIds = Array.isArray(teamIdsRaw) ? teamIdsRaw : [teamIdsRaw];
  const weekIds = Array.isArray(weekIdsRaw) ? weekIdsRaw : [weekIdsRaw];

  for (let i = 0; i < teamIds.length; i++) {
    const teamId = parseInt(teamIds[i], 10);
    const weekIdStr = weekIds[i];

    const currentWeekId =
      weekIdStr && weekIdStr !== '' ? parseInt(weekIdStr, 10) : null;

    if (!Number.isNaN(teamId)) {
      await prisma.team.update({
        where: { id: teamId },
        data: { currentWeekId },
      });
    }
  }

  res.redirect(302, '/admin');
}
