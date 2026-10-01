// Punto de venta: flujo de cobro (CheckoutModal), recibo y efectos en stock/BD.
// Técnicas: tabla de decisión (método de pago × efectivo × cliente) y
// transición de estados (carrito con ítems → confirmación → recibo → nueva venta).

const openCheckout = () => {
  cy.cart().contains("button", "Completar venta").click();
  return cy.dialog().should("contain", "Total a pagar");
};
const chargeButton = () => cy.get('[role="dialog"]').contains("button", /^Cobrar /);

describe("POS · Cobro", () => {
  beforeEach(() => cy.visitApp());

  it("TC-POS-039 el modal muestra total, cantidad de productos y métodos de pago habilitados", () => {
    cy.addToCart("Marcador permanente negro", { qty: 2 });
    cy.addToCart("Tijera escolar");
    openCheckout().within(() => {
      cy.contains("h2", "Completar venta");
      cy.contains("2 producto(s) en el carrito");
      cy.contains("p", "Q27.00");
      cy.contains("button", "Efectivo").should("have.class", "border-primary");
      cy.contains("button", "Transferencia").should("not.have.class", "border-primary");
      cy.get("#cash").should("be.visible");
      cy.get("#ref").should("not.exist");
      chargeButton().should("have.text", "Cobrar Q27.00").and("be.enabled");
    });
  });

  context("Efectivo recibido vs total (Q15.00)", () => {
    beforeEach(() => {
      cy.addToCart("Marcador permanente negro", { qty: 2 });
      openCheckout();
    });

    it("TC-POS-040 mayor al total: muestra el cambio", () => {
      cy.get("#cash").type("20");
      cy.dialog().contains("Cambio: Q5.00").should("not.have.class", "text-destructive");
    });

    it("TC-POS-041 igual al total: cambio Q0.00", () => {
      cy.get("#cash").type("15");
      cy.dialog().contains("Cambio: Q0.00");
    });

    it("TC-POS-042 menor al total: indica cuánto falta en rojo", () => {
      cy.get("#cash").type("10");
      cy.dialog().contains("Faltan Q5.00").should("have.class", "text-destructive");
    });

    it("TC-POS-043 vacío: no muestra cambio ni faltante", () => {
      cy.dialog().should("not.contain", "Cambio:").and("not.contain", "Faltan");
    });
  });

  it("TC-POS-044 venta en efectivo completa: recibo, aviso, stock descontado y registro en BD", () => {
    cy.addToCart("Marcador permanente negro", { qty: 2 });
    openCheckout();
    cy.get("#cash").type("20");
    chargeButton().click();

    cy.dialog().within(() => {
      cy.contains("¡Venta completada!");
      cy.contains("Recibo #1");
      cy.contains("li", "2× Marcador permanente negro").should("contain", "(Unidad)").and("contain", "Q15.00");
      cy.contains("span", "Total").next().should("have.text", "Q15.00");
      cy.contains("span", "Cambio").next().should("have.text", "Q5.00");
    });
    cy.toast("Venta #1 registrada").should("be.visible");

    cy.dialog().contains("button", "Nueva venta").click();
    cy.get('[role="dialog"]').should("not.exist");
    cy.cart().should("contain", "El carrito está vacío");
    cy.productCard("Marcador permanente negro").should("contain", "38 unidad");
    cy.contains("Ganancias de hoy").next().should("have.text", "Q7.00");

    cy.dbSelect("SELECT * FROM sales").should((sales) => {
      expect(sales).to.have.length(1);
      expect(sales[0]).to.include({ sale_number: 1, total: 15, payment_method: "cash" });
      expect(sales[0].payment_reference).to.be.null;
      expect(sales[0].customer_id).to.be.null;
    });
    cy.dbSelect("SELECT * FROM sale_items").should((items) => {
      expect(items).to.have.length(1);
      expect(items[0]).to.include({
        product_name: "Marcador permanente negro",
        sell_unit_name: "Unidad",
        quantity: 2,
        unit_price: 7.5,
        subtotal: 15,
        cost_total: 8,
      });
    });
    cy.dbSelect("SELECT quantity, notes FROM stock_movements WHERE type = 'sale'").should((mov) => {
      expect(mov).to.deep.equal([{ quantity: -2, notes: "Venta #1: 2 x Unidad" }]);
    });
  });

  it("TC-POS-045 venta por transferencia con código de autorización, cliente nuevo y notas", () => {
    cy.addToCart("Tijera escolar");
    openCheckout().within(() => {
      cy.contains("button", "Transferencia").click().should("have.class", "border-primary");
      cy.get("#cash").should("not.exist");
      cy.get("#ref").type("AUT-998877");
      cy.get('input[placeholder="Nombre del cliente"]').type("Juan Pérez");
      cy.contains("Crear cliente “Juan Pérez”").should("be.visible");
      cy.get("#notes").type("Entrega en mostrador");
      chargeButton().click();
      cy.contains("¡Venta completada!");
      cy.contains("Cambio").should("not.exist");
    });

    cy.dbSelect("SELECT * FROM sales").should((sales) => {
      expect(sales[0]).to.include({
        payment_method: "transfer",
        payment_reference: "AUT-998877",
        customer_name: "Juan Pérez",
        notes: "Entrega en mostrador",
        total: 12,
      });
    });
    cy.dbSelect("SELECT name FROM customers").should("deep.equal", [{ name: "Juan Pérez" }]);
  });

  it("TC-POS-046 autocompleta un cliente existente y numera las ventas correlativamente", () => {
    // Venta 1 crea al cliente.
    cy.addToCart("Marcador permanente negro");
    openCheckout();
    cy.get('input[placeholder="Nombre del cliente"]').type("María López");
    chargeButton().click();
    cy.dialog().contains("Recibo #1");
    cy.dialog().contains("button", "Nueva venta").click();

    // Venta 2 lo reutiliza desde la sugerencia.
    cy.addToCart("Marcador permanente negro");
    openCheckout();
    cy.get('input[placeholder="Nombre del cliente"]').type("maria");
    cy.dialog().contains("button", "María López").click();
    cy.get('input[placeholder="Nombre del cliente"]').should("have.value", "María López");
    chargeButton().click();
    cy.dialog().contains("Recibo #2");

    cy.dbSelect("SELECT COUNT(*) AS n FROM customers").its("0.n").should("eq", 1);
    cy.dbSelect("SELECT sale_number, customer_name FROM sales ORDER BY sale_number").should("deep.equal", [
      { sale_number: 1, customer_name: "María López" },
      { sale_number: 2, customer_name: "María López" },
    ]);
  });

  it("TC-POS-047 Cancelar cierra el cobro sin registrar la venta y conserva el carrito", () => {
    cy.addToCart("Marcador permanente negro", { qty: 2 });
    openCheckout().contains("button", "Cancelar").click();
    cy.get('[role="dialog"]').should("not.exist");
    cy.cart().find("li").should("have.length", 1);
    cy.dbSelect("SELECT COUNT(*) AS n FROM sales").its("0.n").should("eq", 0);
  });

  it("TC-POS-048 Enter en el modal de cobro confirma la venta", () => {
    cy.addToCart("Marcador permanente negro");
    openCheckout();
    cy.get("#notes").type("rápida{enter}");
    cy.dialog().contains("¡Venta completada!");
  });

  it("TC-POS-049 vender unidades fraccionarias descuenta la fracción exacta del stock base", () => {
    cy.addToCart("Papel bond carta 80g", { unit: "Resma completa" });
    cy.addToCart("Papel bond carta 80g", { unit: "4 hojas", qty: 2 });
    openCheckout();
    chargeButton().should("have.text", "Cobrar Q37.00").click();
    cy.dialog().contains("button", "Nueva venta").click();
    cy.productCard("Papel bond carta 80g").should("contain", "3.984 resma");
    cy.dbSelect("SELECT stock FROM products WHERE name = 'Papel bond carta 80g'")
      .its("0.stock")
      .should("be.closeTo", 3.984, 1e-9);
  });

  context("Transiciones de estado del stock por venta (Tijera: stock 4, mínimo 1)", () => {
    it("TC-POS-050 ok → low: al quedar en el mínimo aparece la alerta de stock bajo", () => {
      cy.addToCart("Tijera escolar", { qty: 3 });
      openCheckout();
      chargeButton().click();
      cy.dialog().contains("button", "Nueva venta").click();
      cy.productCard("Tijera escolar").should("contain", "1 unidad").and("contain", "Stock bajo");
      cy.contains("2 producto(s) con stock bajo").should("be.visible");
    });

    it("TC-POS-051 ok → out: al vender todo el producto queda agotado y bloqueado", () => {
      cy.addToCart("Tijera escolar", { unit: "Par", qty: 2 });
      openCheckout();
      chargeButton().click();
      cy.dialog().contains("button", "Nueva venta").click();
      cy.productCard("Tijera escolar").should("contain", "0 unidad").and("contain", "Sin stock");
      cy.contains("2 producto(s) agotado(s)").should("be.visible");
      cy.productCard("Tijera escolar").click();
      cy.toast("Tijera escolar no tiene stock disponible").should("be.visible");
      cy.get('[role="dialog"]').should("not.exist");
    });
  });

  context("Métodos de pago según Configuración", () => {
    it("TC-POS-052 solo transferencia habilitada: se preselecciona y pide el código", () => {
      cy.visitApp({ settings: { paymentMethods: { cash: false, transfer: true } } });
      cy.addToCart("Marcador permanente negro");
      openCheckout().within(() => {
        cy.contains("button", "Efectivo").should("not.exist");
        cy.contains("button", "Transferencia").should("have.class", "border-primary");
        cy.get("#ref").should("be.visible");
        cy.get("#cash").should("not.exist");
      });
    });

    it("TC-POS-053 sin métodos habilitados: muestra aviso y bloquea el cobro", () => {
      cy.visitApp({ settings: { paymentMethods: { cash: false, transfer: false } } });
      cy.addToCart("Marcador permanente negro");
      openCheckout().within(() => {
        cy.contains("Activá al menos un método de pago en Configuración.").should("be.visible");
        chargeButton().should("be.disabled");
      });
      cy.get("#notes").type("{enter}");
      cy.dialog().should("not.contain", "¡Venta completada!");
      cy.dbSelect("SELECT COUNT(*) AS n FROM sales").its("0.n").should("eq", 0);
    });
  });
});
