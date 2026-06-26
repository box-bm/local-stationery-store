import { useState } from "react";
import { Lock, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/stores/settings";
import { verifyPassword } from "@/lib/crypto";
import { useT } from "@/i18n";

interface Props {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: Props) {
  const { lockHash, storeName } = useSettingsStore();
  const t = useT();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lockHash && (await verifyPassword(password, lockHash))) {
      onUnlock();
    } else {
      setError(true);
      setPassword("");
    }
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-xs text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Store className="h-8 w-8" />
        </div>
        <h1 className="text-lg font-semibold">{storeName}</h1>
        <p className="mb-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Lock className="h-3.5 w-3.5" />
          {t("lock.subtitle")}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <Input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="••••"
            className="text-center text-lg tracking-widest"
          />
          {error && (
            <p className="text-sm text-destructive">{t("lock.wrong")}</p>
          )}
          <Button type="submit" className="w-full" size="lg">
            {t("lock.unlock")}
          </Button>
        </form>
      </div>
    </div>
  );
}
