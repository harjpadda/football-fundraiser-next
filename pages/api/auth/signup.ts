import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const name = String(req.body.name ?? "").trim();
  const email = String(req.body.email ?? "").toLowerCase().trim();
  const password = String(req.body.password ?? "");

  if (!name || !email || password.length < 6) {
    return res.status(400).send("Please provide name, email, and a password (6+ chars).");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).send("Email already in use.");

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { name, email, passwordHash },
  });

  return res.status(200).json({ ok: true });
}
