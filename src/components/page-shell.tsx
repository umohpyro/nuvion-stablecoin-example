import type { ReactNode } from "react";

export function PageShell({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground text-pretty">{intro}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}
