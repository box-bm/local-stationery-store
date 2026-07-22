import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useT } from "@/i18n";
import { toast } from "@/stores/toast";
import { useSettingsStore } from "@/stores/settings";
import {
  connectGoogleDrive,
  adoptRemote,
  pushLocalAsInitial,
  type DeviceCodeInfo,
  type DriveFileMeta,
} from "@/services/sync";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Phase = "terms" | "code" | "choose" | "applying";

export function ConnectGoogleModal({ open, onClose }: Props) {
  const t = useT();
  const settings = useSettingsStore();
  const [phase, setPhase] = useState<Phase>("terms");
  const [termsChecked, setTermsChecked] = useState(false);
  const [codeInfo, setCodeInfo] = useState<DeviceCodeInfo | null>(null);
  const [existing, setExisting] = useState<DriveFileMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startConnect() {
    setPhase("code");
    setCodeInfo(null);
    setError(null);
    try {
      const result = await connectGoogleDrive((info) => setCodeInfo(info));
      if (result.existing) {
        setExisting(result.existing);
        setPhase("choose");
      } else {
        settings.setDriveSyncEnabled(true);
        await pushLocalAsInitial(null);
        toast.success(t("settings.syncConnectedDone"));
        onClose();
      }
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    if (!open) return;
    setTermsChecked(false);
    setCodeInfo(null);
    setExisting(null);
    setError(null);
    if (settings.driveSyncTermsAcceptedAt) {
      startConnect();
    } else {
      setPhase("terms");
    }
    // Only re-run when the modal opens/closes, not on every settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function acceptTerms() {
    settings.acceptDriveSyncTerms();
    startConnect();
  }

  async function chooseCloud() {
    if (!existing) return;
    setPhase("applying");
    setError(null);
    try {
      settings.setDriveSyncEnabled(true);
      await adoptRemote(existing.id);
      // adoptRemote relaunches the app on success; nothing else to do.
    } catch (e) {
      setError(String(e));
      setPhase("choose");
    }
  }

  async function chooseLocal() {
    setPhase("applying");
    setError(null);
    try {
      settings.setDriveSyncEnabled(true);
      await pushLocalAsInitial(existing?.id ?? null);
      toast.success(t("settings.syncConnectedDone"));
      onClose();
    } catch (e) {
      setError(String(e));
      setPhase("choose");
    }
  }

  async function copyCode() {
    if (!codeInfo) return;
    try {
      await navigator.clipboard.writeText(codeInfo.userCode);
      toast.success(t("settings.syncCodeCopied"));
    } catch {
      /* clipboard may be unavailable */
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" hideClose={phase === "applying"}>
        {phase === "terms" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("settings.syncTermsTitle")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {t("settings.syncTermsBody")}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={(e) => setTermsChecked(e.target.checked)}
                className="h-4 w-4"
              />
              {t("settings.syncTermsAccept")}
            </label>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
              <Button disabled={!termsChecked} onClick={acceptTerms}>
                {t("settings.syncTermsContinue")}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "code" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("settings.syncDeviceCodeTitle")}</DialogTitle>
              <DialogDescription>
                {t("settings.syncDeviceCodeBody")}
              </DialogDescription>
            </DialogHeader>
            {codeInfo ? (
              <div className="space-y-3 text-center">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted p-4">
                  <p className="flex-1 text-2xl font-bold tracking-widest">
                    {codeInfo.userCode}
                  </p>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyCode}
                    title={t("settings.syncCopyCode")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => openUrl(codeInfo.verificationUrl)}
                >
                  {t("settings.syncOpenBrowser")}
                </Button>
                <p className="text-sm text-muted-foreground">
                  {t("settings.syncWaitingApproval")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
            )}
            {error && (
              <p className="text-sm text-destructive">
                {t("settings.syncConnectError", { error })}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t("common.cancel")}
              </Button>
            </DialogFooter>
          </>
        )}

        {phase === "choose" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("settings.syncChooseVersionTitle")}</DialogTitle>
              <DialogDescription>
                {t("settings.syncChooseVersionBody")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={chooseCloud}
                >
                  {t("settings.syncUseCloud")}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("settings.syncUseCloudHint")}
                </p>
              </div>
              <div>
                <Button
                  className="w-full justify-start"
                  variant="outline"
                  onClick={chooseLocal}
                >
                  {t("settings.syncUseLocal")}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("settings.syncUseLocalHint")}
                </p>
              </div>
            </div>
            {error && (
              <p className="text-sm text-destructive">
                {t("settings.syncConnectError", { error })}
              </p>
            )}
          </>
        )}

        {phase === "applying" && (
          <>
            <DialogHeader>
              <DialogTitle>{t("settings.syncDeviceCodeTitle")}</DialogTitle>
            </DialogHeader>
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("settings.syncing")}
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
