import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { formatDateTime } from "@/lib/utils";
import { backupDatabase } from "@/services/system";
import {
  useSyncUiStore,
  applyPendingRemoteChange,
  postponePendingRemoteChange,
} from "@/services/sync";
import { useSettingsStore } from "@/stores/settings";

const COUNTDOWN_SECONDS = 10;

/** Blocking confirmation for applying a remote change that would overwrite local data. */
export function ApplySyncModal() {
  const t = useT();
  const pending = useSyncUiStore((s) => s.pendingRemoteChange);
  const syncPending = useSettingsStore((s) => s.syncPending);
  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const [withBackup, setWithBackup] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    setSeconds(COUNTDOWN_SECONDS);
    setWithBackup(false);
    setError(null);
    const id = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [pending]);

  if (!pending) return null;

  async function confirm() {
    setApplying(true);
    setError(null);
    try {
      if (withBackup) {
        await backupDatabase();
      }
      await applyPendingRemoteChange();
      // Success relaunches the app; nothing else to do here.
    } catch (e) {
      setError(String(e));
      setApplying(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && postponePendingRemoteChange()}>
      <DialogContent className="max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle>{t("settings.syncApplyTitle")}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("settings.syncApplyBody", {
            device: pending.deviceName || t("settings.syncUnknownDevice"),
            date: pending.syncedAt ? formatDateTime(pending.syncedAt) : "",
          })}
        </p>
        {syncPending && (
          <p className="text-sm font-medium text-destructive">
            {t("settings.syncApplyPendingWarning")}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withBackup}
            onChange={(e) => setWithBackup(e.target.checked)}
            className="h-4 w-4"
          />
          {t("settings.syncApplyBackupCheckbox")}
        </label>
        {error && (
          <p className="text-sm text-destructive">
            {t("settings.syncApplyError", { error })}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={postponePendingRemoteChange}
            disabled={applying}
          >
            {t("settings.syncApplyPostpone")}
          </Button>
          <Button onClick={confirm} disabled={seconds > 0 || applying}>
            {seconds > 0
              ? t("settings.syncApplyConfirmWait", { n: seconds })
              : t("settings.syncApplyConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
