import { NextResponse } from "next/server";
import { runGmailIntake } from "@/lib/gmail/intake-runner";

// Vercel Cron hits this on a schedule (see vercel.json). Protected by
// CRON_SECRET so it can't be triggered by anyone who finds the URL — fails
// closed if the secret isn't configured at all, rather than silently
// allowing unauthenticated access.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runGmailIntake();

  if ("notConfigured" in result) {
    return NextResponse.json({ error: "GMAIL_USER/GMAIL_APP_PASSWORD not configured" }, { status: 400 });
  }

  return NextResponse.json(result);
}
