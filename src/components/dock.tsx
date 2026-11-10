"use client";

import { ArrowDownToLine, ArrowLeftRight, Landmark, ListChecks, Send, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Balances", Icon: Wallet },
  { href: "/deposit", label: "Deposit", Icon: ArrowDownToLine },
  { href: "/convert", label: "Convert", Icon: ArrowLeftRight },
  { href: "/send", label: "Send", Icon: Send },
  { href: "/payout", label: "Cash out", Icon: Landmark },
  { href: "/activity", label: "Activity", Icon: ListChecks },
];

/**
 * The main navigation: a dock fixed to the bottom of the screen. A floating pill on desktop, a full-width bar on a phone.
 * The money actions sit under the thumb; the app has no sidebar and no top route bar.
 */
export function Dock() {
  const pathname = usePathname();
  const current = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-band px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-band-foreground sm:inset-x-auto sm:bottom-5 sm:left-1/2 sm:-translate-x-1/2 sm:rounded-full sm:border sm:p-1.5 sm:shadow-card"
    >
      <ul className="flex items-stretch justify-between gap-0.5 sm:gap-1">
        {ITEMS.map(({ href, label, Icon }) => {
          const on = current(href);
          return (
            <li key={href} className="flex-1 sm:flex-none">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[0.68rem] font-semibold transition-colors sm:min-h-11 sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:text-sm ${
                  on ? "bg-c text-white" : "text-band-foreground/75 hover:bg-white/10 hover:text-band-foreground"
                }`}
              >
                <Icon className="size-5 sm:size-4" aria-hidden />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
