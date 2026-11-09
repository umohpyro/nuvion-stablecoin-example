/** The Treasury mark: a vault dial in the category blue. */
export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-[11px] bg-c text-white" style={{ width: size, height: size }} aria-hidden>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3v2.6M12 18.4V21M3 12h2.6M18.4 12H21" />
      </svg>
    </span>
  );
}
