import { create } from "zustand";
import { countLowStock } from "@/services/db";

export type Screen = "pos" | "inventory" | "sales" | "settings";

interface AppState {
  screen: Screen;
  setScreen: (s: Screen) => void;

  /** Collapsed (icon-only) sidebar — also used as the responsive default. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  lowStockCount: number;
  refreshLowStock: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  screen: "pos",
  setScreen: (screen) => set({ screen }),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  lowStockCount: 0,
  refreshLowStock: async () => {
    try {
      const n = await countLowStock();
      set({ lowStockCount: n });
    } catch {
      // ignore — DB may not be ready yet
    }
  },
}));
