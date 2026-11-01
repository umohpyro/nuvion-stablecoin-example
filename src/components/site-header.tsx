import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const LINKS = [
  { href: "/", label: "Balances" },
  { href: "/deposit", label: "Deposit" },
  { href: "/convert", label: "Convert" },
  { href: "/send", label: "Send" },
  { href: "/activity", label: "Activity" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-lg font-extrabold tracking-tight">Stablecoin Treasury</span>
          <Badge variant="secondary">Sandbox</Badge>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 text-sm font-medium">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg px-2.5 py-2 text-muted-foreground hover:bg-muted hover:text-foreground">
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
