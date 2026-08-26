"use server";

import { revalidatePath } from "next/cache";
import { runGmailIntake, type GmailIntakeSummary } from "@/lib/gmail/intake-runner";

export type GmailCheckResult =
  | ({ status: "ok" } & GmailIntakeSummary)
  | { status: "not_configured" }
  | { status: "error"; message: string };

export async function checkGmailNow(): Promise<GmailCheckResult> {
  let result: Awaited<ReturnType<typeof runGmailIntake>>;
  try {
    result = await runGmailIntake();
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : "Failed to check Gmail." };
  }

  if ("notConfigured" in result) {
    return { status: "not_configured" };
  }

  if (result.processed > 0) {
    revalidatePath("/dashboard");
    revalidatePath("/leads");
    revalidatePath("/", "layout");
  }

  return { status: "ok", ...result };
}
