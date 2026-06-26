import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Cart } from "./Cart";
import { useCartStore } from "@/stores/cart";
import { useSettingsStore } from "@/stores/settings";

describe("<Cart />", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
    useSettingsStore.getState().setLanguage("es");
    useSettingsStore.getState().setCurrency("Q", "GTQ");
  });

  it("shows the empty state when the cart has no items", () => {
    render(<Cart onCheckout={() => {}} />);
    expect(screen.getByText("El carrito está vacío")).toBeInTheDocument();
  });

  it("renders cart lines and the total", () => {
    // Populate the store before rendering so the component reads the items.
    useCartStore.getState().addItem(
      { id: 1, name: "Lápiz" } as never,
      { id: 1, name: "Unidad", sell_price: 2, quantity_in_base_units: 1 } as never,
      3
    );
    render(<Cart onCheckout={() => {}} />);
    expect(screen.getByText("Lápiz")).toBeInTheDocument();
    // Q6.00 appears as both the line subtotal and the cart total.
    expect(screen.getAllByText("Q6.00").length).toBeGreaterThanOrEqual(1);
  });

  it("translates to English when the language changes", () => {
    useSettingsStore.getState().setLanguage("en");
    render(<Cart onCheckout={() => {}} />);
    expect(screen.getByText("The cart is empty")).toBeInTheDocument();
  });

  it("fires onCheckout is disabled while empty", () => {
    const calls: number[] = [];
    render(<Cart onCheckout={() => calls.push(1)} />);
    const btn = screen.getByRole("button", { name: "Completar venta" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(calls).toHaveLength(0);
  });
});
