import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BusinessDetailsForm } from "@/components/settings/business-details-form";
import { CatalogManager } from "@/components/settings/catalog-manager";
import { EmployeeManager } from "@/components/settings/employee-manager";
import { prisma } from "@/lib/db";
import { requireEmployee } from "@/lib/auth/session";

const DEMO_BUSINESS_ID = "demo-business";

export default async function SettingsPage() {
  await requireEmployee();

  const [business, catalogItems, employees] = await Promise.all([
    prisma.business.findUniqueOrThrow({ where: { id: DEMO_BUSINESS_ID } }),
    prisma.serviceCatalogItem.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      orderBy: { description: "asc" },
    }),
    prisma.employee.findMany({
      where: { businessId: DEMO_BUSINESS_ID },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Business details, the service price catalogue used to ground AI quote suggestions, and staff accounts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business details</CardTitle>
          <CardDescription>Name and address, printed on every quote PDF.</CardDescription>
        </CardHeader>
        <CardContent>
          <BusinessDetailsForm initialName={business.name} initialAddress={business.address ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Service catalogue</CardTitle>
          <CardDescription>
            Priced parts and labor entries the AI grounds its quote suggestions in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CatalogManager items={catalogItems} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
          <CardDescription>Staff accounts that can sign in to this app.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmployeeManager
            items={employees.map((e) => ({
              id: e.id,
              name: e.name,
              email: e.email,
              createdAt: e.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
