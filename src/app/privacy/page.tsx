import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight">Privacy</h1>
      <p className="mt-2 text-muted-foreground">What this demo keeps about you, which is almost nothing.</p>
      <ul className="mt-6 list-disc space-y-3 pl-5">
        <li>The app has no database and stores nothing about visitors.</li>
        <li>The only thing kept is a cookie that holds your sandbox API key and chosen entity. It is sealed with AES-256-GCM, marked httpOnly so page scripts cannot read it, and expires after eight hours. Disconnect on the Settings page to remove it sooner.</li>
        <li>Any stablecoin wallet and recipient details you enter goes to your own Nuvion sandbox and is saved there, in your tenant. This app does not keep a copy.</li>
        <li>Use fake details only. This is an independent demo, sandbox only, with no real payments.</li>
      </ul>
    </div>
  );
}
