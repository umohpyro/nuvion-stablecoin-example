import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toDecimal } from "@/lib/money";

/** An amount field with a Max button that fills in the whole available balance. */
export function AmountInput({ maxMinor, onValue, wrapClassName = "max-w-56", ...props }: Omit<ComponentProps<typeof Input>, "onChange"> & { maxMinor?: number; onValue: (value: string) => void; value: string; wrapClassName?: string }) {
  return (
    <div className={`flex gap-2 ${wrapClassName}`}>
      <Input inputMode="decimal" onChange={(e) => onValue(e.target.value)} {...props} />
      {maxMinor !== undefined && maxMinor > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={() => onValue(toDecimal(maxMinor))}>
          Max
        </Button>
      )}
    </div>
  );
}
