import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fuzzyIncludes } from "@/lib/text";

interface Props {
  label: string;
  /** Text shown when nothing is selected. */
  allLabel: string;
  clearLabel: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

/** Dropdown with checkbox options for multi-selection (e.g. category filter). */
export function MultiSelect({
  label,
  allLabel,
  clearLabel,
  options,
  selected,
  onChange,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFilter("");
    filterRef.current?.focus();
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filteredOptions = filter.trim()
    ? options.filter((opt) => fuzzyIncludes(opt, filter))
    : options;

  function toggle(option: string) {
    onChange(
      selected.includes(option)
        ? selected.filter((s) => s !== option)
        : [...selected, option]
    );
  }

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? selected[0]
        : `${label} (${selected.length})`;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm",
          selected.length > 0 && "border-primary text-foreground"
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-56 rounded-md border border-border bg-popover p-1 shadow-lg">
          <div className="relative mb-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={filterRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={label}
              className="h-8 w-full rounded-sm border border-input bg-background pl-7 pr-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">—</p>
          ) : (
            filteredOptions.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input"
                    )}
                  >
                    {checked && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })
          )}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="mt-1 w-full rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
            >
              {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
