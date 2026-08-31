import { AppShell } from "@/components/app-shell";
import { requireEmployee } from "@/lib/auth/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const employee = await requireEmployee();

  return (
    <AppShell employee={{ name: employee.name, email: employee.email }}>
      {children}
    </AppShell>
  );
}
