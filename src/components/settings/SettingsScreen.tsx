import { useEffect, useState } from "react";
import {
  Palette,
  Languages,
  Coins,
  Store,
  Database,
  FolderOpen,
  Copy,
  Save,
  FileSpreadsheet,
  ShieldCheck,
  DownloadCloud,
  HelpCircle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStore, type ThemeMode } from "@/stores/settings";
import { useT } from "@/i18n";
import type { Lang } from "@/i18n";
import { toast } from "@/stores/toast";
import { cn } from "@/lib/utils";
import {
  getDataDir,
  openDataFolder,
  backupDatabase,
} from "@/services/system";
import {
  exportInventory,
  exportSales,
  exportStockMovements,
} from "@/services/excel";
import {
  currentVersion,
  checkForUpdate,
  installUpdate,
  type UpdateInfo,
} from "@/services/updater";
import { SetPasswordModal } from "./SetPasswordModal";

interface Props {
  onShowGuide: () => void;
}

export function SettingsScreen({ onShowGuide }: Props) {
  const t = useT();
  const s = useSettingsStore();

  const [dataDir, setDataDir] = useState("");
  const [storeName, setStoreNameLocal] = useState(s.storeName);
  const [symbol, setSymbol] = useState(s.currencySymbol);
  const [code, setCode] = useState(s.currencyCode);

  const [version, setVersion] = useState("");
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);

  const [pwModalOpen, setPwModalOpen] = useState(false);

  useEffect(() => {
    getDataDir().then(setDataDir).catch(() => setDataDir("—"));
    currentVersion().then(setVersion);
  }, []);

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(dataDir);
      toast.success(t("settings.pathCopied"));
    } catch {
      /* clipboard may be unavailable */
    }
  }

  async function doBackup() {
    try {
      const ok = await backupDatabase();
      if (ok) toast.success(t("settings.backupDone"));
    } catch (e) {
      toast.error(t("settings.backupError", { error: String(e) }));
    }
  }

  async function runExport(
    fn: () => Promise<boolean>,
    successKey: Parameters<typeof t>[0]
  ) {
    try {
      const ok = await fn();
      if (ok) toast.success(t(successKey));
    } catch (e) {
      toast.error(String(e));
    }
  }

  async function check() {
    setChecking(true);
    setUpdate(null);
    try {
      const info = await checkForUpdate();
      setUpdate(info);
      if (!info.available) toast.success(t("settings.upToDate"));
    } catch (e) {
      toast.error(t("settings.updateError", { error: String(e) }));
    } finally {
      setChecking(false);
    }
  }

  async function doInstall() {
    if (!update?.update) return;
    setInstalling(true);
    try {
      await installUpdate(update.update);
    } catch (e) {
      toast.error(t("settings.updateError", { error: String(e) }));
      setInstalling(false);
    }
  }

  function toggleLock() {
    if (s.lockEnabled) {
      s.setLock(false, null);
      toast.success(t("settings.lockDisabled"));
    } else {
      setPwModalOpen(true);
    }
  }

  const themes: { id: ThemeMode; labelKey: Parameters<typeof t>[0] }[] = [
    { id: "light", labelKey: "settings.themeLight" },
    { id: "dark", labelKey: "settings.themeDark" },
    { id: "system", labelKey: "settings.themeSystem" },
  ];
  const langs: { id: Lang; labelKey: Parameters<typeof t>[0] }[] = [
    { id: "es", labelKey: "settings.spanish" },
    { id: "en", labelKey: "settings.english" },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>

        {/* Appearance */}
        <Section icon={Palette} title={t("settings.appearance")}>
          <Row label={t("settings.theme")}>
            <SegGroup
              options={themes.map((th) => ({
                id: th.id,
                label: t(th.labelKey),
              }))}
              value={s.theme}
              onChange={(v) => s.setTheme(v as ThemeMode)}
            />
          </Row>
          <Row label={t("settings.language")} icon={Languages}>
            <SegGroup
              options={langs.map((l) => ({ id: l.id, label: t(l.labelKey) }))}
              value={s.language}
              onChange={(v) => s.setLanguage(v as Lang)}
            />
          </Row>
        </Section>

        {/* Currency + store */}
        <Section icon={Coins} title={t("settings.currency")}>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>{t("settings.currencySymbol")}</Label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-24"
                maxLength={4}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.currencyCode")}</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-28"
                maxLength={4}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                s.setCurrency(symbol || "Q", code || "GTQ");
                toast.success(t("common.save"));
              }}
            >
              <Save className="h-4 w-4" /> {t("common.save")}
            </Button>
          </div>
          <Row label={t("settings.storeName")} icon={Store}>
            <div className="flex w-full max-w-sm gap-2">
              <Input
                value={storeName}
                onChange={(e) => setStoreNameLocal(e.target.value)}
                onBlur={() => s.setStoreName(storeName || "Mi Librería")}
              />
            </div>
          </Row>
          <p className="text-xs text-muted-foreground">
            {t("settings.storeNameHint")}
          </p>
        </Section>

        {/* Data & backups */}
        <Section icon={Database} title={t("settings.data")}>
          <div className="space-y-1.5">
            <Label>{t("settings.dataLocation")}</Label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 text-xs">
                {dataDir}
              </code>
              <Button variant="outline" size="icon" onClick={copyPath} title={t("settings.copyPath")}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={openDataFolder}>
                <FolderOpen className="h-4 w-4" /> {t("settings.openFolder")}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={doBackup}>
              <Database className="h-4 w-4" /> {t("settings.backup")}
            </Button>
          </div>

          <div className="pt-2">
            <Label className="mb-2 block">{t("settings.exportData")}</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => runExport(exportInventory, "inv.exported")}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t("settings.exportInventory")}
              </Button>
              <Button
                variant="outline"
                onClick={() => runExport(() => exportSales(), "sales.exported")}
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t("settings.exportSales")}
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  runExport(
                    () => exportStockMovements(),
                    "settings.movementsExported"
                  )
                }
              >
                <FileSpreadsheet className="h-4 w-4" />
                {t("settings.exportMovements")}
              </Button>
            </div>
          </div>
        </Section>

        {/* Security */}
        <Section icon={ShieldCheck} title={t("settings.security")}>
          <Row label={t("settings.lock")}>
            <Toggle checked={s.lockEnabled} onChange={toggleLock} />
          </Row>
          <p className="text-xs text-muted-foreground">{t("settings.lockHint")}</p>
          {s.lockEnabled && (
            <Button
              variant="outline"
              className="mt-1 w-fit"
              onClick={() => setPwModalOpen(true)}
            >
              {t("settings.lockChange")}
            </Button>
          )}
        </Section>

        {/* Updates */}
        <Section icon={DownloadCloud} title={t("settings.updates")}>
          <Row label={t("settings.version", { version })}>
            <Button variant="outline" onClick={check} disabled={checking}>
              {checking ? t("settings.checking") : t("settings.checkUpdates")}
            </Button>
          </Row>
          {update?.available && (
            <div className="flex items-center justify-between rounded-lg border border-primary/40 bg-primary/10 p-3">
              <p className="text-sm font-medium">
                {t("settings.updateAvailable", { version: update.version ?? "" })}
              </p>
              <Button onClick={doInstall} disabled={installing}>
                {installing ? t("settings.checking") : t("settings.installUpdate")}
              </Button>
            </div>
          )}
          {update && !update.available && (
            <p className="flex items-center gap-1.5 text-sm text-success">
              <Check className="h-4 w-4" /> {t("settings.upToDate")}
            </p>
          )}
        </Section>

        {/* Guide */}
        <Section icon={HelpCircle} title={t("nav.help")}>
          <Button variant="outline" className="w-fit" onClick={onShowGuide}>
            <HelpCircle className="h-4 w-4" /> {t("settings.showGuide")}
          </Button>
        </Section>
      </div>

      <SetPasswordModal
        open={pwModalOpen}
        onClose={() => setPwModalOpen(false)}
      />
    </div>
  );
}

// --- small layout helpers -------------------------------------------------

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Palette;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: typeof Palette;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {label}
      </span>
      {children}
    </div>
  );
}

function SegGroup({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
