"use client";

import { useState, useTransition } from "react";
import { signIn } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ next }: { next: string }) {
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          // signIn redirects on success, so it only returns when the password was wrong.
          setError(await signIn(password, next));
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="pw">Password</Label>
        <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" aria-invalid={Boolean(error)} required autoFocus />
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </div>
      <Button type="submit" disabled={pending || !password}>{pending ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}
