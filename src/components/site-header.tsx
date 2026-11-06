"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import { ThemeSwitcher } from "@/components/theme-switcher";

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
    <header className="sticky top-0 z-30 bg-band text-band-foreground">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-[10px] bg-primary text-sm font-extrabold text-primary-foreground" aria-hidden>S</span>
          <span className="text-lg font-extrabold tracking-tight">Stablecoin Treasury</span>
          <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-semibold text-sand-fixed">Sandbox</span>
        </Link>
        {!signedOutPage && (
          <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={current(l.href) ? "page" : undefined}
                className={`rounded-full px-3 py-2 hover:bg-white/10 ${current(l.href) ? "bg-white/15 text-band-foreground" : "text-band-foreground/75 hover:text-band-foreground"}`}
              >
                {l.label}
              </Link>
            ))}
            {gated && (
              <form action={signOut}>
                <button type="submit" className="rounded-full px-3 py-2 text-band-foreground/75 hover:bg-white/10 hover:text-band-foreground">Sign out</button>
              </form>
            )}
            <ThemeSwitcher />
          </nav>
        )}
      </div>
    </header>
  );
}
