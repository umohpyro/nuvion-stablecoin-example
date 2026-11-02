import { validateAddress, type Chain } from "./chains.ts";
import { UserError } from "./errors.ts";

export interface SavedRecipient {
  id: string;
  name: string;
  chain: Chain;
  address: string;
}

export interface Destination {
  chain: Chain;
  address: string;
  holder: string;
  /** Set when the destination is a saved recipient; its counterparty already holds the address. */
  recipientId?: string;
}

/**
 * Decides where a send goes. A saved recipient wins over anything typed, because the browser can't be trusted
 * to say where funds go. With the allow list on, a send that isn't to a saved recipient is refused.
 */
export function destination(saved: SavedRecipient | null, typed: { chain: Chain; address: string; name: string }, onlyToSaved: boolean): Destination {
  if (saved) return { chain: saved.chain, address: saved.address, holder: saved.name, recipientId: saved.id };
  if (onlyToSaved) throw new UserError("This treasury only sends to saved recipients. Add one on the Recipients page.");
  const address = typed.address.trim();
  const holder = typed.name.trim();
  if (!holder) throw new UserError("Enter the recipient's name.");
  const bad = validateAddress(typed.chain, address);
  if (bad) throw new UserError(bad);
  return { chain: typed.chain, address, holder };
}
