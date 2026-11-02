import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Stablecoin Treasury", template: "%s · Stablecoin Treasury" },
  description: "An example treasury that holds, converts and sends USDC and USDT through the Nuvion sandbox. No real funds move.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* usePathname() reads the URL, so the header streams in behind a placeholder of the same height. */}
        <Suspense fallback={<div className="h-[57px] border-b" />}>
          <SiteHeader gated={Boolean(process.env.DEMO_PASSWORD?.trim())} />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="border-t py-8 text-center text-sm text-muted-foreground">
          <p>An example app on the Nuvion sandbox. Nothing here is real and no funds move on-chain.</p>
        </footer>
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
