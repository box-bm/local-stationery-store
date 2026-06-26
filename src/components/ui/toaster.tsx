import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useToastStore, type ToastVariant } from "@/stores/toast";
import { cn } from "@/lib/utils";

const ICONS: Record<ToastVariant, typeof Info> = {
  default: Info,
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
};

const STYLES: Record<ToastVariant, string> = {
  default: "border-border bg-card text-card-foreground",
  success: "border-success/40 bg-card text-card-foreground",
  error: "border-destructive/40 bg-card text-card-foreground",
  warning: "border-warning/40 bg-card text-card-foreground",
};

const ICON_COLOR: Record<ToastVariant, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  error: "text-destructive",
  warning: "text-warning",
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  // Portal to <body> so toasts always sit above Radix dialog portals
  // (which use z-50) instead of being trapped in an ancestor stacking context.
  return createPortal(
    <div className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.variant];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-lg animate-in slide-in-from-right-5",
              STYLES[t.variant]
            )}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ICON_COLOR[t.variant])} />
            <p className="flex-1 text-sm">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
