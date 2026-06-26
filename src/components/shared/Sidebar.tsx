import {
  ShoppingCart,
  Package,
  Receipt,
  Settings,
  Moon,
  Sun,
  Store,
  HelpCircle,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useAppStore, type Screen } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import { useT, type TranslationKey } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NAV: { id: Screen; key: TranslationKey; icon: typeof ShoppingCart }[] = [
  { id: "pos", key: "nav.pos", icon: ShoppingCart },
  { id: "inventory", key: "nav.inventory", icon: Package },
  { id: "sales", key: "nav.sales", icon: Receipt },
  { id: "settings", key: "nav.settings", icon: Settings },
];

interface Props {
  onShowGuide: () => void;
}

export function Sidebar({ onShowGuide }: Props) {
  const {
    screen,
    setScreen,
    lowStockCount,
    outOfStockCount,
    sidebarCollapsed,
    toggleSidebar,
  } = useAppStore();
  const { isDark, setTheme, storeName } = useSettingsStore();
  const t = useT();
  const collapsed = sidebarCollapsed;

  // Out-of-stock (error) takes precedence over low stock (warning).
  const alertCount = outOfStockCount || lowStockCount;
  const alertVariant = outOfStockCount > 0 ? "destructive" : "warning";

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200",
        collapsed ? "w-16" : "w-60"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-5",
          collapsed && "justify-center"
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {storeName || t("nav.appName")}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {t("nav.appSubtitle")}
            </p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setScreen(item.id)}
              title={collapsed ? t(item.key) : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <span className="relative shrink-0">
                <Icon className="h-5 w-5" />
                {item.id === "inventory" && alertCount > 0 && collapsed && (
                  <span className={cn(
                    "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    alertVariant === "destructive"
                      ? "bg-destructive text-destructive-foreground"
                      : "bg-warning text-warning-foreground"
                  )}>
                    {alertCount}
                  </span>
                )}
              </span>
              {!collapsed && <span className="flex-1 text-left">{t(item.key)}</span>}
              {item.id === "inventory" && alertCount > 0 && !collapsed && (
                <Badge variant={active ? "secondary" : alertVariant} className="h-5 px-1.5">
                  {alertCount}
                </Badge>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-1 px-3 py-4">
        <SideAction
          collapsed={collapsed}
          icon={<HelpCircle className="h-5 w-5 shrink-0" />}
          label={t("nav.help")}
          onClick={onShowGuide}
        />
        <SideAction
          collapsed={collapsed}
          icon={
            isDark ? (
              <Sun className="h-5 w-5 shrink-0" />
            ) : (
              <Moon className="h-5 w-5 shrink-0" />
            )
          }
          label={isDark ? t("nav.lightMode") : t("nav.darkMode")}
          onClick={() => setTheme(isDark ? "light" : "dark")}
        />
        <SideAction
          collapsed={collapsed}
          icon={
            collapsed ? (
              <PanelLeft className="h-5 w-5 shrink-0" />
            ) : (
              <PanelLeftClose className="h-5 w-5 shrink-0" />
            )
          }
          label={collapsed ? "" : "Colapsar"}
          onClick={toggleSidebar}
        />
      </div>
    </aside>
  );
}

function SideAction({
  collapsed,
  icon,
  label,
  onClick,
}: {
  collapsed: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-0"
      )}
    >
      {icon}
      {!collapsed && label && <span>{label}</span>}
    </button>
  );
}
