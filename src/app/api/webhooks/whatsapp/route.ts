import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { processWhatsAppMessage } from "@/lib/whatsapp/intake-runner";

// Meta's handshake when you configure the webhook subscription URL in the
// app dashboard — echo back hub.challenge if the mode/token check out.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function isValidSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const sigBuf = Buffer.from(signatureHeader);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

export async function POST(request: Request) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  // Fails closed, same policy as the Gmail cron route's CRON_SECRET check —
  // this is a public endpoint that writes to the database, unlike email's
  // fail-open-to-simulated (a safe no-op).
  if (!appSecret) {
    return NextResponse.json({ error: "WHATSAPP_APP_SECRET not configured" }, { status: 500 });
  }

  // Meta signs the raw bytes, so verify before JSON.parse-ing.
  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];

  // Status-update events (sent/delivered/read) and non-text messages have
  // no text body to extract from — nothing to process, 200 so Meta doesn't
  // keep retrying.
  if (!message || message.type !== "text") {
    return NextResponse.json({ ok: true });
  }

  try {
    await processWhatsAppMessage({
      from: message.from,
      text: message.text.body,
      messageId: message.id,
      senderName: value?.contacts?.[0]?.profile?.name,
    });
  } catch (err) {
    console.error("WhatsApp intake: failed to process message", message.id, err);
    // Non-200 so Meta's own webhook retry handles transient failures (DB
    // blip, etc.) — no bespoke retry logic needed.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
