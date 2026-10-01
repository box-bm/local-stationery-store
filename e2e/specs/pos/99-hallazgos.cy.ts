// Verificación de hipótesis de defectos del POS (docs/qa/GUIA_EQUIPO.md §10).
//
// Cada prueba afirma el comportamiento ESPERADO. Si falla, el defecto se
// reprodujo en el frontend y debe:
//   1. reproducirse manualmente en el instalador v0.4.0,
//   2. registrarse como Issue BUG-### con evidencia (video/captura de Cypress),
//   3. referenciarse aquí en el título de la prueba: "[BUG-###] ...".
// El comportamiento esperado de cada caso debe validarlo el Product Owner.

const openCheckout = () => {
  cy.cart().contains("button", "Completar venta").click();
  return cy.dialog().should("contain", "Total a pagar");
};
const chargeButton = () => cy.get('[role="dialog"]').contains("button", /^Cobrar /);
const tijeraStock = () => cy.dbSelect("SELECT stock FROM products WHERE id = 'e2e-tijera'").its("0.stock");

describe("POS · Hipótesis de defectos", () => {
  beforeEach(() => cy.visitApp());

  it("H-01 el botón + del carrito no permite superar el stock disponible", () => {
    cy.addToCart("Tijera escolar", { qty: 4 }); // stock 4: límite válido
    cy.cart().find("li").find("button").eq(2).click();
    cy.cart().find("li").contains("span", /^4$/);
  });

  it("H-02 agregar el mismo producto dos veces no supera el stock en el carrito", () => {
    cy.addToCart("Tijera escolar", { qty: 3 });
    cy.productCard("Tijera escolar").click();
    cy.get("#qty").clear().type("3");
    // 3 en carrito + 3 nuevos = 6 > 4: debería bloquearse.
    cy.dialog().contains("button", "Agregar al carrito").should("be.disabled");
  });

  it("H-03 una venta nunca deja el stock en negativo", () => {
    cy.addToCart("Tijera escolar", { qty: 4 });
    cy.cart().find("li").find("button").eq(2).click(); // intenta 5
    openCheckout();
    chargeButton().click();
    tijeraStock().should("be.gte", 0);
  });

  it("H-04 el lector de código de barras no agrega productos agotados", () => {
    cy.scanBarcode("7502000000027"); // Borrador blanco, stock 0
    cy.cart().should("contain", "El carrito está vacío");
  });

  it("H-05 no se puede cobrar en efectivo si lo recibido es menor al total", () => {
    cy.addToCart("Marcador permanente negro", { qty: 2 }); // Q15.00
    openCheckout();
    cy.get("#cash").type("10");
    chargeButton().should("be.disabled");
  });

  it("H-06 una transferencia exige código de autorización", () => {
    cy.addToCart("Marcador permanente negro");
    openCheckout();
    cy.dialog().contains("button", "Transferencia").click();
    cy.get("#ref").should("have.value", "");
    chargeButton().should("be.disabled");
  });
});
