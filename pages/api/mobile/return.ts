import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const to = String(req.query.to || "");

  // Allow Expo Go (exp://) and later your own scheme (footballfundraiser://)
  if (!to.startsWith("exp://") && !to.startsWith("footballfundraiser://")) {
    return res.status(400).send("Bad return URL");
  }

  res.writeHead(302, { Location: to });
  res.end();
}
