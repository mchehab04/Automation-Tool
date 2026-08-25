import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EmailIntakeSimulator } from "@/components/leads/email-intake-simulator";

export default function SimulateEmailIntakePage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Simulate email intake</h1>
        <p className="text-sm text-muted-foreground">
          Paste a customer email to see how AI triage would read it, ask for anything
          missing, and add it to the pipeline automatically — no real inbox connected yet.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Inbound message</CardTitle>
          <CardDescription>
            A demo of the automatic intake from the Phase 0 plan. Replies are drafted by
            AI but never sent for real — you approve each one to continue the thread.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailIntakeSimulator />
        </CardContent>
      </Card>
    </div>
  );
}
