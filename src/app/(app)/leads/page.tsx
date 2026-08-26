import Link from "next/link";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/leads/kanban-board";
import { GmailCheckButton } from "@/components/leads/gmail-check-button";
import { prisma } from "@/lib/db";

const DEMO_BUSINESS_ID = "demo-business";

export default async function LeadsPage() {
  const leads = await prisma.lead.findMany({
    where: { businessId: DEMO_BUSINESS_ID },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">Move leads through the pipeline.</p>
        </div>
        <div className="flex items-start gap-2">
          <GmailCheckButton />
          <Button render={<Link href="/leads/simulate" />} nativeButton={false} variant="outline">
            Simulate email intake
          </Button>
          <Button render={<Link href="/leads/new" />} nativeButton={false}>
            Add lead
          </Button>
        </div>
      </div>
      <KanbanBoard leads={leads} />
    </div>
  );
}
