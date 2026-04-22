import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { prisma } from "../../../../lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2025-11-17.clover",
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  // Require user to be signed in
  const session = await getServerSession(req, res, authOptions as any);
  if (!session?.user?.email) {
    return res.status(401).send("Please sign in to play.");
  }

  const slug = req.query.slug as string;
  const email = String(session.user.email);
  const name = String(session.user.name ?? "Player");

  const lineCount = parseInt(req.body.lineCount ?? "0", 10);
  if (!lineCount || lineCount <= 0) {
    return res.status(400).send("Missing line count.");
  }

  // Get team and its assigned week with fixtures
  const team = await prisma.team.findUnique({
    where: { slug },
    include: {
      currentWeek: {
        include: { fixtures: true },
      },
    },
  });

  if (!team) {
    return res.status(404).send("Team not found.");
  }

  let week = team.currentWeek;

  // Optional fallback to latest week if none assigned
  if (!week) {
    week = (await prisma.week.findFirst({
      orderBy: { id: "desc" },
      include: { fixtures: true },
    })) as any;
  }

  if (!week) {
    return res.status(400).send("No week assigned for this team.");
  }

  const fixtures = week.fixtures;

  // NEW: block entries if any fixture has already kicked off
  const now = new Date();
  const locked = fixtures.some(
    (fixture: any) => fixture.kickoff && new Date(fixture.kickoff) <= now
  );

  if (locked) {
    return res
      .status(400)
      .send("The fixtures have kicked off and no more selections are allowed for this week.");
  }

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { name, email },
    });
  }

  // Build predictions
  const linesData: { lineIndex: number; fixtureId: number; result: string }[] = [];

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
    for (const fixture of fixtures) {
      const fieldName = `prediction_${lineIndex}_${fixture.id}`;
      const val = req.body[fieldName];

      if (!val || !["HOME", "DRAW", "AWAY"].includes(val)) {
        return res.status(400).send("Missing or invalid predictions.");
      }

      linesData.push({
        lineIndex,
        fixtureId: fixture.id,
        result: val,
      });
    }
  }

  const amountPence = lineCount * 200; // £2 per line
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  // Stripe Checkout session
  const sessionStripe = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: lineCount,
        price_data: {
          currency: "gbp",
          unit_amount: 200,
          product_data: {
            name: `Predictions for ${team.name} - ${week.label}`,
          },
        },
      },
    ],
    success_url: `${baseUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&team=${team.slug}`,
    cancel_url: `${baseUrl}/team/${team.slug}`,
  });

  // Create order in DB
  await prisma.order.create({
    data: {
      userId: user.id,
      teamId: team.id,
      weekId: week.id,
      lineCount,
      amountPence,
      stripeSessionId: sessionStripe.id,
      paid: false,
      lines: {
        create: linesData.map((ld) => ({
          lineIndex: ld.lineIndex,
          result: ld.result,
          fixture: { connect: { id: ld.fixtureId } },
          week: { connect: { id: week.id } },
        })),
      },
    },
  });

  // Redirect to Stripe Checkout
  res.redirect(303, sessionStripe.url!);
}