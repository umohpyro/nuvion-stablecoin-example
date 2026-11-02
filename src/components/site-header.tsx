"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { Badge } from "@/components/ui/badge";

const LINKS = [
  { href: "/", label: "Balances" },
  { href: "/deposit", label: "Deposit" },
  { href: "/convert", label: "Convert" },
  { href: "/send", label: "Send" },
  { href: "/payout", label: "Cash out" },
  { href: "/recipients", label: "Recipients" },
  { href: "/activity", label: "Activity" },
];

/** `gated` is true when a sign-in password is configured. The sign-in page itself shows no navigation. */
export function SiteHeader({ gated }: { gated: boolean }) {
  const pathname = usePathname();
  const signedOutPage = pathname === "/login";
  const current = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-extrabold tracking-tight">Stablecoin Treasury</span>
          <Badge variant="secondary">Sandbox</Badge>
        </Link>
        {!signedOutPage && (
          <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={current(l.href) ? "page" : undefined}
                className={`rounded-lg px-2.5 py-2 hover:bg-muted ${current(l.href) ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {l.label}
              </Link>
            ))}
            {gated && (
              <form action={signOut}>
                <button type="submit" className="rounded-lg px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">Sign out</button>
              </form>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
