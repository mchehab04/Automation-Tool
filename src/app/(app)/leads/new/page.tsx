import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LeadForm } from "@/components/leads/lead-form";

export default function NewLeadPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add lead</h1>
        <p className="text-sm text-muted-foreground">
          Manually add a lead into the pipeline.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lead details</CardTitle>
          <CardDescription>Name, email, and phone are required — company and note are optional.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadForm />
        </CardContent>
      </Card>
    </div>
  );
}
