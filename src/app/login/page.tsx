import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Pipeline Hub</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to continue.</p>
        <LoginForm />
      </div>
    </div>
  );
}
