import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStore } from "@/stores/settings";
import { hashPassword } from "@/lib/crypto";
import { useT } from "@/i18n";
import { toast } from "@/stores/toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SetPasswordModal({ open, onClose }: Props) {
  const t = useT();
  const { lockEnabled, setLock } = useSettingsStore();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPw("");
      setConfirm("");
      setError(null);
    }
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 4) {
      setError(t("settings.lockTooShort"));
      return;
    }
    if (pw !== confirm) {
      setError(t("settings.lockMismatch"));
      return;
    }
    const hash = await hashPassword(pw);
    setLock(true, hash);
    toast.success(lockEnabled ? t("settings.lockChanged") : t("settings.lockEnabled"));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {lockEnabled ? t("settings.lockChange") : t("settings.lockSet")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("settings.lockPassword")}</Label>
            <Input
              type="password"
              autoFocus
              value={pw}
              onChange={(e) => {
                setPw(e.target.value);
                setError(null);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.lockConfirm")}</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                setError(null);
              }}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
