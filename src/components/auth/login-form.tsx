"use client";

import { useActionState, useState } from "react";
import { Mail, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { login } from "@/lib/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="relative">
        <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="email"
          type="email"
          placeholder="Email Address"
          aria-label="Email"
          required
          autoComplete="email"
          autoFocus
          className="h-12 rounded-full border-transparent bg-muted/60 pl-11 focus-visible:border-ring"
        />
      </div>

      <div className="relative">
        <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name="password"
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          aria-label="Password"
          required
          autoComplete="current-password"
          className="h-12 rounded-full border-transparent bg-muted/60 pl-11 pr-11 focus-visible:border-ring"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending} className="h-12 rounded-full text-base">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? "Signing in…" : "Sign In"}
      </Button>
    </form>
  );
}
