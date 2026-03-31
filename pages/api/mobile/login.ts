import bcrypt from "bcryptjs";
import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../../lib/prisma";
import { signMobileToken } from "../../../lib/mobileAuth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password" });
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).trim().toLowerCase() },
      select: { id: true, passwordHash: true },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid login" });
    }

    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid login" });
    }

    const token = signMobileToken({ userId: user.id });
    return res.status(200).json({ token });
  } catch (err: any) {
    console.error("mobile login error:", err);
    return res.status(500).json({ error: "Server error", details: err?.message || String(err) });
  }
}
