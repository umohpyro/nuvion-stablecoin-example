import { CHAINS, type Chain } from "@/lib/chains";
import { isStablecoin, ticker } from "@/lib/money";

/** The token colour of an asset, so a balance is recognisable at a glance. Tokens only; see globals.css. */
const TONE: Record<string, string> = { USC: "bg-asset-usdc", UST: "bg-asset-usdt", RLD: "bg-asset-rlusd" };
export const assetTone = (currency: string) => TONE[currency] ?? "bg-asset-fiat";

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

const LETTER: Record<string, string> = { USC: "C", UST: "T", RLD: "R" };

/** A round glyph for an asset: the currency symbol for fiat, one distinguishing letter for a stablecoin (C for USDC, T for USDT). */
export function AssetGlyph({ currency, size = 44, className = "" }: { currency: string; size?: number; className?: string }) {
  const label = isStablecoin(currency) ? (LETTER[currency] ?? ticker(currency)[0]) : (SYMBOL[currency] ?? currency.slice(0, 1));
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-extrabold text-white ring-4 ring-card ${assetTone(currency)} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.44 }}
    >
      {label}
    </span>
  );
}

/** A small chip naming a network. The short code is monospace so it lines up in a row of chips. */
export function ChainChip({ chain }: { chain: Chain }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-c-soft px-2.5 py-1 text-xs font-semibold text-c-text">
      <span className="font-mono text-[0.68rem] uppercase tracking-wide opacity-80">{chain}</span>
      {CHAINS[chain].name}
    </span>
  );
}

/** A neutral chip for an asset ticker or any short fact. */
export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{children}</span>;
}
