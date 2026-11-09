import { Settings, Users } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { ThemeSwitcher } from "@/components/theme-switcher";

const tool = "grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

/** A light bar that scrolls away: the brand on the left, the tools on the right. Navigation lives in the dock. */
export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
      <Link href="/" className="flex items-center gap-2.5">
        <BrandMark />
        <span className="text-lg font-extrabold tracking-tight">Treasury</span>
        <span className="hidden rounded-full bg-c-soft px-2.5 py-0.5 text-xs font-bold text-c-text sm:inline">Sandbox</span>
      </Link>
      <div className="flex items-center gap-0.5">
        <Link href="/recipients" className={tool} aria-label="Recipients" title="Recipients"><Users className="size-5" aria-hidden /></Link>
        <Link href="/settings" className={tool} aria-label="Settings" title="Settings"><Settings className="size-5" aria-hidden /></Link>
        <ThemeSwitcher />
      </div>
    </header>
  );
}
