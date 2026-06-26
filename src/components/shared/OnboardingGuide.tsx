import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Package,
  Receipt,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT, type TranslationKey } from "@/i18n";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS: {
  icon: typeof Sparkles;
  title: TranslationKey;
  body: TranslationKey;
}[] = [
  { icon: Sparkles, title: "guide.welcomeTitle", body: "guide.welcomeBody" },
  { icon: ShoppingCart, title: "guide.posTitle", body: "guide.posBody" },
  { icon: Package, title: "guide.inventoryTitle", body: "guide.inventoryBody" },
  { icon: Receipt, title: "guide.salesTitle", body: "guide.salesBody" },
  { icon: SettingsIcon, title: "guide.settingsTitle", body: "guide.settingsBody" },
];

export function OnboardingGuide({ open, onClose }: Props) {
  const t = useT();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const current = STEPS[step];
  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" hideClose>
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-semibold">{t(current.title)}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t(current.body)}</p>

          <div className="mt-5 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("guide.step", { n: step + 1, total: STEPS.length })}
          </p>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onClose}>
            {t("guide.skip")}
          </Button>
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                {t("guide.back")}
              </Button>
            )}
            {isLast ? (
              <Button onClick={onClose}>{t("guide.start")}</Button>
            ) : (
              <Button onClick={() => setStep((s) => s + 1)}>
                {t("guide.next")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
