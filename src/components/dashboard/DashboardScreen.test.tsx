import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useSettingsStore } from "@/stores/settings";
import type { SalesSegment } from "@/types";

const getSalesSummary = vi.fn();
const getSalesSegments = vi.fn();
const getTopProductsFiltered = vi.fn();
vi.mock("@/services/db", () => ({
  getSalesSummary: (...args: unknown[]) => getSalesSummary(...args),
  getSalesSegments: (...args: unknown[]) => getSalesSegments(...args),
  getTopProductsFiltered: (...args: unknown[]) => getTopProductsFiltered(...args),
  listProducts: vi.fn(async () => []),
  listCustomersWithCounts: vi.fn(async () => []),
}));

import { DashboardScreen } from "./DashboardScreen";

// Most recent first, as getSalesSegments returns them.
const SEGMENTS: SalesSegment[] = [
  { period: "2026-10-03", count: 3, total: 90, profit: 20 },
  { period: "2026-10-02", count: 1, total: 15, profit: 4 },
  { period: "2026-10-01", count: 2, total: 40, profit: 10 },
];

// The line chart's polyline (lucide icons also draw polylines, in a 24×24 viewBox).
const LINE = 'svg[viewBox="0 0 100 100"] polyline';

function chartButton(name: string) {
  return screen.getByRole("button", { name });
}

async function renderDashboard(segments: SalesSegment[] = SEGMENTS) {
  getSalesSegments.mockResolvedValue(segments);
  const view = render(<DashboardScreen />);
  await waitFor(() => expect(getSalesSegments).toHaveBeenCalled());
  return view;
}

describe("<DashboardScreen />", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-16T12:00:00"));
    useSettingsStore.getState().setLanguage("es");
    getSalesSummary.mockReset().mockResolvedValue({ count: 6, total: 145, profit: 34 });
    getSalesSegments.mockReset();
    getTopProductsFiltered.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("BUG-039: shows the dashboard in Spanish, with no Cyrillic text", async () => {
    const { container } = await renderDashboard();
    expect(screen.getByRole("heading", { name: "Dashboard de ventas" })).toBeInTheDocument();
    for (const label of ["Barras", "Líneas", "Círculo", "Dona", "Aplicar"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(container.textContent).not.toMatch(/[Ѐ-ӿ]/);
  });

  it("BUG-042: each chart button shows its own chart type", async () => {
    const { container } = await renderDashboard();
    await waitFor(() => expect(container.querySelector('[title^="2026-10-01"]')).not.toBeNull());

    fireEvent.click(chartButton("Barras"));
    expect(container.querySelectorAll('[title^="2026-10-0"]')).toHaveLength(3);
    expect(container.querySelector(LINE)).toBeNull();
    expect(container.querySelector('[style*="conic-gradient"]')).toBeNull();

    fireEvent.click(chartButton("Líneas"));
    expect(container.querySelector(LINE)).not.toBeNull();
    expect(container.querySelector('[title^="2026-10-0"]')).toBeNull();
    expect(container.querySelector('[style*="conic-gradient"]')).toBeNull();

    fireEvent.click(chartButton("Círculo"));
    const pie = container.querySelector('[style*="conic-gradient"]');
    expect(pie).not.toBeNull();
    expect(pie!.children).toHaveLength(0);
    expect(container.querySelector(LINE)).toBeNull();

    fireEvent.click(chartButton("Dona"));
    const donut = container.querySelector('[style*="conic-gradient"]');
    expect(donut).not.toBeNull();
    expect(donut!.children).toHaveLength(1); // the hole
  });

  it("BUG-040: does not apply a range whose «Desde» is after «Hasta»", async () => {
    await renderDashboard();
    await waitFor(() => expect(getSalesSummary).toHaveBeenCalledTimes(1));
    const initialRange = getSalesSummary.mock.calls[0][0];

    // Desde → 10/10/2026, Hasta → 09/10/2026.
    fireEvent.click(screen.getByRole("button", { name: /2026-10-01/ }));
    fireEvent.click(screen.getByRole("button", { name: "10" }));
    fireEvent.click(screen.getByRole("button", { name: /2026-10-16/ }));
    fireEvent.click(screen.getByRole("button", { name: "9" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(
      await screen.findByText("La fecha «Desde» no puede ser posterior a «Hasta».")
    ).toBeInTheDocument();
    expect(getSalesSummary).toHaveBeenCalledTimes(1);
    expect(getSalesSummary.mock.calls[0][0]).toEqual(initialRange);
  });

  it("BUG-040: applies a valid range and clears the message", async () => {
    await renderDashboard();
    fireEvent.click(screen.getByRole("button", { name: /2026-10-01/ }));
    fireEvent.click(screen.getByRole("button", { name: "5" }));
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await waitFor(() =>
      expect(getSalesSummary).toHaveBeenLastCalledWith({ from: "2026-10-05", to: "2026-10-16" }, {})
    );
    expect(screen.queryByText("La fecha «Desde» no puede ser posterior a «Hasta».")).toBeNull();
  });

  it("BUG-041: shows «no data» instead of sample data when there are no sales", async () => {
    const { container } = await renderDashboard([]);
    await waitFor(() => expect(getTopProductsFiltered).toHaveBeenCalled());
    // Both the chart and «top products» are empty.
    await waitFor(() => expect(screen.getAllByText("No hay datos para este rango")).toHaveLength(2));
    expect(container.querySelector('[title^="2026-10-0"]')).toBeNull();
    for (const label of ["Líneas", "Círculo", "Dona"]) {
      fireEvent.click(chartButton(label));
      expect(container.querySelector(LINE)).toBeNull();
      expect(container.querySelector('[style*="conic-gradient"]')).toBeNull();
    }
  });
});
