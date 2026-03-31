import jwt from "jsonwebtoken";
import type { NextApiRequest } from "next";

const secret = process.env.MOBILE_JWT_SECRET as string;

export function signMobileToken(payload: { userId: number }) {
  if (!secret) throw new Error("Missing MOBILE_JWT_SECRET in .env");
  return jwt.sign(payload, secret, { expiresIn: "30d" });
}

export function getMobileUserId(req: NextApiRequest): number | null {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!token) return null;

    const decoded = jwt.verify(token, secret) as any;
    const userId = Number(decoded.userId);
    if (!userId) return null;

    return userId;
  } catch {
    return null;
  }
}
