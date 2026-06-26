import * as React from "react";
import { Input, type InputProps } from "./input";
import { useSettingsStore } from "@/stores/settings";
import { cn } from "@/lib/utils";

/** Numeric input with the configured currency symbol shown as a prefix. */
const MoneyInput = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const symbol = useSettingsStore((s) => s.currencySymbol);
    return (
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
          {symbol}
        </span>
        <Input
          ref={ref}
          type="number"
          inputMode="decimal"
          step="any"
          className={cn("pl-8", className)}
          {...props}
        />
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
