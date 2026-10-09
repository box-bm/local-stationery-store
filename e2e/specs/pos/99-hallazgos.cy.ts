import { tc } from "../../support/qase";

// Verificación de hipótesis de defectos del POS (docs/qa/GUIA_EQUIPO.md §10).
//
// Cada prueba afirma el comportamiento ESPERADO. Si falla, el defecto se
// reprodujo en el frontend y debe:
//   1. reproducirse manualmente en el instalador v0.4.0,
//   2. registrarse como Issue BUG-### con evidencia (video/captura de Cypress),
//   3. referenciarse aquí en el título de la prueba: "[BUG-###] ...".
// El comportamiento esperado de cada caso debe validarlo el Product Owner.

const tijeraStock = () => cy.dbSelect("SELECT stock FROM products WHERE id = 'e2e-tijera'").its("0.stock");

describe("POS · Hipótesis de defectos", () => {
  beforeEach(() => cy.visitApp());

  it(tc("H-01 el botón + del carrito no permite superar el stock disponible"), () => {
    cy.addToCart("Tijera escolar", { qty: 4 }); // stock 4: límite válido
    cy.cart().find("li").find("button").eq(2).click();
    cy.cart().find("li").contains("span", /^4$/);
  });

  it(tc("H-02 agregar el mismo producto dos veces no supera el stock en el carrito"), () => {
    cy.addToCart("Tijera escolar", { qty: 3 });
    cy.productCard("Tijera escolar").click();
    cy.get("#qty").clear().type("3");
    // 3 en carrito + 3 nuevos = 6 > 4: debería bloquearse.
    cy.dialog().contains("button", "Agregar al carrito").should("be.disabled");
  });

  it(tc("H-03 una venta nunca deja el stock en negativo"), () => {
    cy.addToCart("Tijera escolar", { qty: 4 });
    cy.cart().find("li").find("button").eq(2).click(); // intenta 5
    cy.openCheckout();
    cy.chargeButton().click();
    tijeraStock().should("be.gte", 0);
  });

  it(tc("H-04 el lector de código de barras no agrega productos agotados"), () => {
    cy.scanBarcode("7502000000027"); // Borrador blanco, stock 0
    // Se espera el mismo aviso que al hacer clic en la tarjeta del producto agotado.
    cy.toast("Borrador blanco no tiene stock disponible").should("exist");
    cy.cart().should("contain", "El carrito está vacío");
  });

  it(tc("H-05 no se puede cobrar en efectivo si lo recibido es menor al total"), () => {
    cy.addToCart("Marcador permanente negro", { qty: 2 }); // Q15.00
    cy.openCheckout();
    cy.get("#cash").type("10");
    cy.chargeButton().should("be.disabled");
  });

  it(tc("H-06 una transferencia exige código de autorización"), () => {
    cy.addToCart("Marcador permanente negro");
    cy.openCheckout();
    cy.dialog().contains("button", "Transferencia").click();
    cy.get("#ref").should("have.value", "");
    cy.chargeButton().should("be.disabled");
  });

  it(tc("H-07 tras agregar al carrito el foco vuelve al buscador (flujo con lector/teclado)"), () => {
    // POSScreen llama a searchRef.focus() al confirmar, pero el diálogo de
    // Radix devuelve el foco al elemento que lo abrió al cerrarse.
    cy.addToCart("Marcador permanente negro");
    cy.focused().should("have.attr", "placeholder").and("match", /^Buscar producto/);
  });

  it(tc("H-08 'Ganancias de hoy' incluye una venta hecha cerca de la medianoche local"), function () {
    // created_at se guarda en UTC (CURRENT_TIMESTAMP) y el filtro usa la fecha
    // local. Se elige una hora en la que la fecha UTC ya es otra: 23:30 al oeste
    // de UTC (p. ej. Guatemala, UTC−6) o 00:30 al este.
    const tzo = new Date().getTimezoneOffset();
    if (tzo === 0) this.skip(); // en UTC el desfase no existe
    const t = new Date();
    t.setHours(tzo > 0 ? 23 : 0, 30, 0, 0);
    cy.clock(t.getTime(), ["Date"]);
    cy.visitApp();
    cy.addToCart("Marcador permanente negro"); // ganancia Q3.50
    cy.openCheckout();
    cy.chargeButton().click();
    cy.dialog().contains("button", "Nueva venta").click();
    cy.contains("Ganancias de hoy").next().should("have.text", "Q3.50");
  });

});
