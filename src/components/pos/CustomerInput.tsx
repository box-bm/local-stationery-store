import { useEffect, useRef, useState } from "react";
import { UserPlus, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/useDebounce";
import { searchCustomers } from "@/services/db";
import { useT } from "@/i18n";
import type { Customer } from "@/types";

interface Props {
  value: string;
  onChange: (name: string) => void;
}

/**
 * Customer name field with autocomplete. Picking a suggestion fills the name;
 * a brand-new name is created on sale completion (find-or-create in db).
 */
export function CustomerInput({ value, onChange }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Customer[]>([]);
  const debounced = useDebounce(value, 200);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    if (debounced.trim().length >= 1) {
      searchCustomers(debounced).then((r) => !cancelled && setResults(r));
    } else {
      setResults([]);
    }
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  // Whether the typed name matches an existing customer exactly.
  const exactMatch = results.some(
    (c) => c.name.toLowerCase() === value.trim().toLowerCase()
  );
  const showCreateHint = value.trim().length >= 1 && !exactMatch;

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={value}
          placeholder={t("checkout.customerPlaceholder")}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
      </div>

      {open && (results.length > 0 || showCreateHint) && (
        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange(c.name);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              {c.name}
            </button>
          ))}
          {showCreateHint && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
              <UserPlus className="h-3.5 w-3.5" />
              {t("checkout.customerCreate", { name: value.trim() })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
