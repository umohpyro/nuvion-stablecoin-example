import type { ReactNode } from "react";

/**
 * Every page opens with the Treasury hero: a blue band that curves into the page. `children` is the page body;
 * `band` is extra content that belongs inside the band (totals, quick actions).
 */
export function PageShell({ eyebrow, title, intro, band, children }: { eyebrow?: string; title: string; intro: string; band?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-[28px] p-6 text-band-foreground sm:p-9" style={{ background: "var(--hero)" }}>
          <p className="text-[0.72rem] font-bold tracking-[0.12em] text-sand-fixed/80 uppercase">{eyebrow ?? "Sandbox treasury"}</p>
          <h1 className="mt-2 text-[clamp(1.9rem,4vw,2.8rem)] leading-tight font-extrabold tracking-[-0.02em]">{title}</h1>
          <p className="mt-2 max-w-2xl text-band-foreground/85 text-pretty">{intro}</p>
          {band && <div className="mt-6">{band}</div>}
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pt-8 pb-10 sm:px-6">{children}</div>
    </>
  );
}
