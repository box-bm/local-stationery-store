import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const completeSale = vi.fn(async () => ({ saleNumber: 1, total: 15 }));
vi.mock("@/services/db", () => ({
  completeSale: (...args: unknown[]) => completeSale(...(args as [])),
  searchCustomers: vi.fn(async () => []),
  countStockAlerts: vi.fn(async () => ({ low: 0, out: 0 })),
}));

import { CheckoutModal } from "./CheckoutModal";
import { useCartStore } from "@/stores/cart";
import { useSettingsStore } from "@/stores/settings";

// "Marcador permanente negro": Q7.50 per unit.
function fillCart(quantity: number) {
  useCartStore.getState().addItem(
    { id: "4", name: "Marcador permanente negro", stock: 40, purchase_price: 4 } as never,
    { id: "41", name: "Unidad", sell_price: 7.5, quantity_in_base_units: 1 } as never,
    quantity
  );
}

function chargeButton() {
  return screen.getByRole("button", { name: /^Cobrar / });
}

describe("<CheckoutModal />", () => {
  beforeEach(() => {
    completeSale.mockClear();
    useCartStore.setState({ items: [] });
    useSettingsStore.getState().setLanguage("es");
    useSettingsStore.getState().setCurrency("Q", "GTQ");
    useSettingsStore.getState().setPaymentMethod("cash", true);
    useSettingsStore.getState().setPaymentMethod("transfer", true);
  });

  it("charges in cash without an amount received (the field is optional)", async () => {
    fillCart(2);
    render(<CheckoutModal open onClose={() => {}} />);
    expect(chargeButton()).toBeEnabled();
    fireEvent.click(chargeButton());
    await waitFor(() => expect(completeSale).toHaveBeenCalledTimes(1));
  });

  it("charges in cash when the amount received covers the total", async () => {
    fillCart(2);
    render(<CheckoutModal open onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Efectivo recibido/), { target: { value: "20" } });
    expect(screen.getByText("Cambio: Q5.00")).toBeInTheDocument();
    fireEvent.click(chargeButton());
    await waitFor(() => expect(completeSale).toHaveBeenCalledTimes(1));
  });

  // H-05 (S3-HA-001): total Q15.00, received Q10.00.
  it("H-05: blocks a cash charge while the amount received is below the total", async () => {
    fillCart(2);
    render(<CheckoutModal open onClose={() => {}} />);
    const cash = screen.getByLabelText(/Efectivo recibido/);
    fireEvent.change(cash, { target: { value: "10" } });
    expect(screen.getByText("Faltan Q5.00")).toBeInTheDocument();
    expect(chargeButton()).toBeDisabled();

    // Enter must not bypass the disabled button.
    fireEvent.keyDown(cash, { key: "Enter" });
    await new Promise((r) => setTimeout(r, 0));
    expect(completeSale).not.toHaveBeenCalled();
  });

  // H-06 (S3-HA-001): transfer with an empty authorization code.
  it("H-06: requires the authorization code for a transfer", async () => {
    fillCart(1);
    render(<CheckoutModal open onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Transferencia" }));
    expect(chargeButton()).toBeDisabled();
    expect(
      screen.getByText("Ingresá el código de autorización de la transferencia.")
    ).toBeInTheDocument();

    const ref = screen.getByLabelText("Código de autorización");
    fireEvent.change(ref, { target: { value: "   " } });
    expect(chargeButton()).toBeDisabled();
    fireEvent.keyDown(ref, { key: "Enter" });
    await new Promise((r) => setTimeout(r, 0));
    expect(completeSale).not.toHaveBeenCalled();

    fireEvent.change(ref, { target: { value: " AUT-123 " } });
    expect(chargeButton()).toBeEnabled();
    fireEvent.click(chargeButton());
    await waitFor(() => expect(completeSale).toHaveBeenCalledTimes(1));
    expect(completeSale.mock.calls[0]).toMatchObject([
      expect.anything(),
      { paymentMethod: "transfer", paymentReference: "AUT-123" },
    ]);
  });
});
