export type Chain = "eth" | "base" | "matic" | "sol";

/**
 * `chain` is what account details use; `network` is what payment details use. They differ:
 * `matic` becomes `MATIC_MAINNET`, and `POLYGON_MAINNET` is rejected.
 */
export const CHAINS: Record<Chain, { name: string; network: string; family: "evm" | "solana"; example: string }> = {
  eth: { name: "Ethereum", network: "ETH_MAINNET", family: "evm", example: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
  base: { name: "Base", network: "BASE_MAINNET", family: "evm", example: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
  matic: { name: "Polygon", network: "MATIC_MAINNET", family: "evm", example: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
  sol: { name: "Solana", network: "SOLANA_MAINNET", family: "solana", example: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin" },
};

export const CHAIN_IDS = Object.keys(CHAINS) as Chain[];
export const isChain = (v: string): v is Chain => v in CHAINS;

const EVM = /^0x[0-9a-fA-F]{40}$/;
const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Checks the address shape for a chain. Returns an error message, or null when it looks valid.
 * Shortcut: no EIP-55 checksum check (needs keccak256); Nuvion validates the format again on its side.
 * An EVM address is valid on every EVM chain, so the shape can't tell Base from Ethereum: the review step covers that.
 */
export function validateAddress(chain: Chain, address: string): string | null {
  const a = address.trim();
  if (!a) return "Enter a wallet address.";
  const { family, name } = CHAINS[chain];
  if (family === "evm") {
    if (SOLANA.test(a) && !a.startsWith("0x")) return `That looks like a Solana address. ${name} addresses start with 0x.`;
    return EVM.test(a) ? null : `${name} addresses start with 0x followed by 40 hex characters.`;
  }
  if (EVM.test(a)) return "That looks like an Ethereum-style address. Solana addresses are Base58 and don't start with 0x.";
  return SOLANA.test(a) ? null : "Solana addresses are 32 to 44 Base58 characters.";
}
