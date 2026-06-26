import { useEffect, useState } from "react";
import { Sidebar } from "@/components/shared/Sidebar";
import { OnboardingGuide } from "@/components/shared/OnboardingGuide";
import { LockScreen } from "@/components/shared/LockScreen";
import { Toaster } from "@/components/ui/toaster";
import { POSScreen } from "@/components/pos/POSScreen";
import { InventoryScreen } from "@/components/inventory/InventoryScreen";
import { SalesScreen } from "@/components/sales/SalesScreen";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import { checkForUpdate } from "@/services/updater";
import { toast } from "@/stores/toast";
import { t } from "@/i18n";

export default function App() {
  const { screen, refreshStockAlerts, setSidebarCollapsed } = useAppStore();
  const { lockEnabled, onboardingDone, setOnboardingDone } = useSettingsStore();

  const [unlocked, setUnlocked] = useState(!lockEnabled);
  const [showGuide, setShowGuide] = useState(false);

  // First-run guide.
  useEffect(() => {
    if (!onboardingDone) setShowGuide(true);
  }, [onboardingDone]);

  // Initial data + responsive default + silent update check.
  useEffect(() => {
    refreshStockAlerts();

    const onResize = () => setSidebarCollapsed(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);

    // Non-blocking update check; quietly ignore failures (e.g. dev builds).
    checkForUpdate()
      .then((info) => {
        if (info.available) {
          toast.info(t("settings.updateAvailable", { version: info.version ?? "" }));
        }
      })
      .catch(() => {});

    return () => window.removeEventListener("resize", onResize);
  }, [refreshStockAlerts, setSidebarCollapsed]);

  function closeGuide() {
    setShowGuide(false);
    setOnboardingDone(true);
  }

  if (lockEnabled && !unlocked) {
    return (
      <>
        <LockScreen onUnlock={() => setUnlocked(true)} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar onShowGuide={() => setShowGuide(true)} />
      <main className="flex-1 overflow-hidden">
        {screen === "pos" && <POSScreen />}
        {screen === "inventory" && <InventoryScreen />}
        {screen === "sales" && <SalesScreen />}
        {screen === "settings" && (
          <SettingsScreen onShowGuide={() => setShowGuide(true)} />
        )}
      </main>

      <OnboardingGuide open={showGuide} onClose={closeGuide} />
      <Toaster />
    </div>
  );
}
