import { useEffect, useState } from "react";
import { CloudCog, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";
import { toast } from "@/stores/toast";
import { useSettingsStore } from "@/stores/settings";
import { useSyncUiStore, disconnectGoogleDrive, syncNow } from "@/services/sync";
import { formatDateTime } from "@/lib/utils";
import { Section, Row, Toggle } from "./SettingsScreen";
import { ConnectGoogleModal } from "./ConnectGoogleModal";

export function DriveSyncSection() {
  const t = useT();
  const s = useSettingsStore();
  const schemaBlocked = useSyncUiStore((st) => st.schemaBlocked);
  const [connectOpen, setConnectOpen] = useState(false);
  const [deviceName, setDeviceName] = useState(s.deviceName);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setDeviceName(s.deviceName);
  }, [s.deviceName]);

  const connected = !!s.driveFileId;

  async function handleDisconnect() {
    if (!confirm(t("settings.syncDisconnectConfirm"))) return;
    await disconnectGoogleDrive();
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      await syncNow();
    } catch (e) {
      toast.error(t("settings.syncError", { error: String(e) }));
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Section icon={CloudCog} title={t("settings.sync")}>
      <p className="text-xs text-muted-foreground">{t("settings.syncHint")}</p>

      {!connected ? (
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => setConnectOpen(true)}
        >
          {t("settings.syncConnect")}
        </Button>
      ) : (
        <>
          <Row label={t("settings.syncEnable")}>
            <Toggle
              checked={s.driveSyncEnabled}
              onChange={() => s.setDriveSyncEnabled(!s.driveSyncEnabled)}
            />
          </Row>

          <Row label={t("settings.syncDeviceName")}>
            <Input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              onBlur={() =>
                deviceName.trim() && s.setDeviceName(deviceName.trim())
              }
              className="w-48"
            />
          </Row>

          <p className="text-sm text-muted-foreground">
            {s.lastSyncedAt
              ? t("settings.syncLastSyncBy", {
                  date: formatDateTime(s.lastSyncedAt),
                  device:
                    s.lastSyncedByDeviceName || t("settings.syncUnknownDevice"),
                })
              : t("settings.syncNeverSynced")}
          </p>

          {schemaBlocked && (
            <p className="text-sm text-amber-600">
              {t("settings.syncSchemaBlocked")}
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={handleSyncNow} disabled={syncing}>
              <RefreshCw className="h-4 w-4" />
              {syncing ? t("settings.syncing") : t("settings.syncNow")}
            </Button>
            <Button variant="outline" onClick={handleDisconnect}>
              {t("settings.syncDisconnect")}
            </Button>
          </div>
        </>
      )}

      <ConnectGoogleModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
      />
    </Section>
  );
}
