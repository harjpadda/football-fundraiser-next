import bcrypt from "bcryptjs";
import type { NextApiRequest, NextApiResponse } from "next";
import { signMobileToken } from "../../../lib/mobileAuth";
import { prisma } from "../../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { name, email, password, teamSlug } = req.body || {};

    if (!name || !email || !password || !teamSlug) {
      return res.status(400).json({ error: "Missing name, email, password, or teamSlug" });
    }

    const team = await prisma.team.findUnique({ where: { slug: String(teamSlug) } });
    if (!team) return res.status(400).json({ error: "Invalid team" });

    const existing = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (existing) return res.status(400).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: {
        name: String(name),
        email: String(email).toLowerCase(),
        passwordHash,
        teamId: team.id, // ✅ assign team at registration
      },
      select: { id: true },
    });

    const token = signMobileToken({ userId: user.id });
    return res.status(200).json({ token });
  } catch (err: any) {
    console.error("mobile register error:", err);
    return res.status(500).json({ error: "Server error", details: err?.message || String(err) });
  }
}