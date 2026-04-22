import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { getMobileUserId } from "../../../../../lib/mobileAuth";
import { prisma } from "../../../../../lib/prisma";

const PRICE_PER_LINE_PENCE = 200;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-11-17.clover",
});

type PickValue = "HOME" | "DRAW" | "AWAY";
type Pick = { fixtureId: number; lineIndex: number; result: PickValue };

function getBaseUrl(req: NextApiRequest) {
  const host = req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // must be logged in
    const userId = getMobileUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const slug = String(req.query.slug || "");

    const { weekId, lineCount, picks, returnUrl } = req.body || {};
    if (!weekId || !lineCount || !Array.isArray(picks)) {
      return res.status(400).json({ error: "Missing weekId, lineCount, or picks" });
    }

    const team = await prisma.team.findUnique({ where: { slug } });
    if (!team) return res.status(404).json({ error: "Team not found" });

    const week = await prisma.week.findUnique({ where: { id: Number(weekId) } });
    if (!week) return res.status(404).json({ error: "Week not found" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, teamId: true },
    });
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // lock to user's team (if assigned)
    if (user.teamId && user.teamId !== team.id) {
      return res.status(403).json({ error: "You are not allowed to play for this team" });
    }

    const lc = Number(lineCount);
    if (!Number.isFinite(lc) || lc < 1 || lc > 50) {
      return res.status(400).json({ error: "Invalid lineCount" });
    }

    // Parse picks safely
    const castedPicks: Pick[] = picks.map((p: any) => ({
      fixtureId: Number(p.fixtureId),
      lineIndex: Number(p.lineIndex),
      result: String(p.result) as PickValue,
    }));

    for (const p of castedPicks) {
      if (!p.fixtureId || !Number.isFinite(p.lineIndex)) {
        return res.status(400).json({ error: "Bad picks payload" });
      }
      if (!["HOME", "DRAW", "AWAY"].includes(p.result)) {
        return res.status(400).json({ error: "Invalid result value" });
      }
      if (p.lineIndex < 0 || p.lineIndex >= lc) {
        return res.status(400).json({ error: "lineIndex out of range" });
      }
    }

    // Validate fixture IDs exist and belong to that week
    const fixtureIds = Array.from(new Set(castedPicks.map((p) => p.fixtureId)));
    const fixtures = await prisma.fixture.findMany({
      where: { id: { in: fixtureIds } },
      select: { id: true, weekId: true },
    });

    if (fixtures.length !== fixtureIds.length) {
      return res.status(400).json({ error: "One or more fixtures not found" });
    }
    if (fixtures.some((f) => f.weekId !== week.id)) {
      return res.status(400).json({ error: "One or more fixtures are not in this week" });
    }

    // Ensure each line has exactly all fixtures for the week
    const expectedFixtures = await prisma.fixture.count({ where: { weekId: week.id } });
    if (expectedFixtures > 0) {
      const expectedTotalPicks = expectedFixtures * lc;
      if (castedPicks.length !== expectedTotalPicks) {
        return res.status(400).json({
          error: `Expected ${expectedTotalPicks} picks (${expectedFixtures} fixtures × ${lc} lines) but got ${castedPicks.length}`,
        });
      }
    }

    // NEW: block entries if any fixture in this week has already kicked off
    const weekFixtures = await prisma.fixture.findMany({
      where: { weekId: week.id },
      select: { id: true, kickoff: true },
    });

    const now = new Date();
    const locked = weekFixtures.some((f) => f.kickoff && new Date(f.kickoff) <= now);

    if (locked) {
      return res.status(400).json({
        error: "The fixtures have kicked off and no more selections are allowed for this week.",
      });
    }

    const amountPence = lc * PRICE_PER_LINE_PENCE;

    // Build Stripe return URLs (return into app)
    const baseUrl = getBaseUrl(req);
    const safeReturnUrl = typeof returnUrl === "string" ? returnUrl : "";

    // Default to web team page if no returnUrl supplied
    let success_url = `${baseUrl}/team/${team.slug}?paid=1`;
    let cancel_url = `${baseUrl}/team/${team.slug}`;

    // If app provides returnUrl, use the server redirect endpoint
    if (safeReturnUrl) {
      const encoded = encodeURIComponent(safeReturnUrl);
      success_url = `${baseUrl}/api/mobile/return?to=${encoded}`;
      cancel_url = `${baseUrl}/api/mobile/return?to=${encoded}`;
    }

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `${team.name} fundraiser entry (${lc} line${lc > 1 ? "s" : ""})`,
            },
            unit_amount: amountPence,
          },
          quantity: 1,
        },
      ],
      success_url,
      cancel_url,
      metadata: {
        teamId: String(team.id),
        weekId: String(week.id),
        userId: String(user.id),
        lineCount: String(lc),
      },
    });

    // Create DB Order (unpaid) + LinePrediction rows
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        teamId: team.id,
        weekId: week.id,
        lineCount: lc,
        amountPence,
        paid: false,
        stripeSessionId: session.id,
        lines: {
          create: castedPicks.map((p) => ({
            fixture: { connect: { id: p.fixtureId } },
            week: { connect: { id: week.id } },
            lineIndex: p.lineIndex,
            result: p.result,
          })),
        },
      },
      select: { id: true },
    });

    return res.status(200).json({
      checkoutUrl: session.url,
      orderId: order.id,
    });
  } catch (err: any) {
    console.error("mobile play error:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err?.message || String(err),
    });
  }
}