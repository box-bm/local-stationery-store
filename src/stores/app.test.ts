import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/services/db", () => ({ countStockAlerts: vi.fn() }));

import { countStockAlerts } from "@/services/db";
import { useAppStore } from "./app";

beforeEach(() => {
  useAppStore.setState({ screen: "pos", sidebarCollapsed: false, lowStockCount: 0, outOfStockCount: 0 });
});

describe("app store", () => {
  it("switches screens", () => {
    useAppStore.getState().setScreen("inventory");
    expect(useAppStore.getState().screen).toBe("inventory");
  });

  it("toggles and sets the sidebar", () => {
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarCollapsed).toBe(true);
    useAppStore.getState().setSidebarCollapsed(false);
    expect(useAppStore.getState().sidebarCollapsed).toBe(false);
  });

  it("refreshStockAlerts loads counts from the DB", async () => {
    vi.mocked(countStockAlerts).mockResolvedValue({ low: 3, out: 1 });
    await useAppStore.getState().refreshStockAlerts();
    expect(useAppStore.getState()).toMatchObject({ lowStockCount: 3, outOfStockCount: 1 });
  });

  it("refreshStockAlerts keeps the previous counts if the DB isn't ready", async () => {
    useAppStore.setState({ lowStockCount: 2 });
    vi.mocked(countStockAlerts).mockRejectedValue(new Error("not ready"));
    await expect(useAppStore.getState().refreshStockAlerts()).resolves.toBeUndefined();
    expect(useAppStore.getState().lowStockCount).toBe(2);
  });
});
