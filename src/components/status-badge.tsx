import { Badge } from "@/components/ui/badge";
import type { TransferStatus } from "@/lib/nuvion";

const LABEL: Record<TransferStatus, string> = { new: "Created", pending: "Pending", successful: "Successful", failed: "Failed" };

export function StatusBadge({ status }: { status: TransferStatus }) {
  const tone = status === "successful" ? "bg-emerald-100 text-emerald-800" : status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
  return <Badge className={tone}>{LABEL[status] ?? status}</Badge>;
}
