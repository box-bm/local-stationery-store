import { create } from "zustand";
import { countStockAlerts } from "@/services/db";

export type Screen = "pos" | "inventory" | "sales" | "settings";

interface AppState {
  screen: Screen;
  setScreen: (s: Screen) => void;

  /** Collapsed (icon-only) sidebar — also used as the responsive default. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  /** Centralized stock alert counts. */
  lowStockCount: number;
  outOfStockCount: number;
  refreshStockAlerts: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  screen: "pos",
  setScreen: (screen) => set({ screen }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  lowStockCount: 0,
  outOfStockCount: 0,
  refreshStockAlerts: async () => {
    try {
      const { low, out } = await countStockAlerts();
      set({ lowStockCount: low, outOfStockCount: out });
    } catch {
      // ignore — DB may not be ready yet
    }
  },
}));
