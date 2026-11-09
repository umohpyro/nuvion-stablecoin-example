import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { LiveRefresh } from "@/components/live-refresh";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_APP_URL?.trim() || "http://localhost:3000"), // makes the Open Graph image URL absolute
  title: { default: "Stablecoin Treasury", template: "%s · Stablecoin Treasury" },
  description: "An example treasury that holds, converts and sends USDC and USDT through the Nuvion sandbox. No real funds move.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${mono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("theme")||"system";if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}` }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* usePathname() reads the URL, so the header streams in behind a placeholder of the same height. */}
        <Suspense fallback={<div className="h-[57px] bg-band" />}>
          <SiteHeader />
        </Suspense>
        <Suspense fallback={null}>
          <LiveRefresh />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="border-t py-8 text-center text-sm text-muted-foreground">
          <p>Independent demo. Sandbox only, no real funds move on-chain. Not financial or investment advice. Not affiliated with or endorsed by Circle, Tether or any stablecoin issuer.</p>
          <p className="mt-2">Your API key is sealed in an encrypted cookie in this browser and expires after eight hours. <Link href="/privacy" className="underline underline-offset-4">Privacy</Link></p>
        </footer>
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
