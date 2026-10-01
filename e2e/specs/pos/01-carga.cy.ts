// Punto de venta: carga inicial de la pantalla.
describe("POS · Carga inicial", () => {
  beforeEach(() => cy.visitApp());

  it("TC-POS-001 muestra el menú Punto de venta activo con el buscador enfocado", () => {
    cy.contains("button", "Punto de venta").should("be.visible");
    cy.focused().should("have.attr", "placeholder").and("match", /^Buscar producto/);
  });

  it("TC-POS-002 lista todos los productos del catálogo con precio y unidad por defecto", () => {
    cy.get("main .grid > button").should("have.length", 6);
    cy.productCard("Marcador permanente negro")
      .should("contain", "Q7.50")
      .and("contain", "/ Unidad")
      .and("contain", "40 unidad")
      .and("contain", "Escritura");
    cy.productCard("Papel bond carta 80g").should("contain", "Q0.25").and("contain", "/ Hoja individual");
  });

  it("TC-POS-003 marca visualmente los productos con stock bajo y agotado", () => {
    cy.productCard("Cuaderno universitario 100 hojas").should("contain", "Stock bajo");
    cy.productCard("Borrador blanco").should("contain", "Sin stock");
    cy.productCard("Marcador permanente negro").should("not.contain", "Stock bajo").and("not.contain", "Sin stock");
  });

  it("TC-POS-004 muestra el banner centralizado de alertas de stock", () => {
    cy.contains("1 producto(s) agotado(s)").should("be.visible");
    cy.contains("1 producto(s) con stock bajo").should("be.visible");
  });

  it("TC-POS-005 inicia con carrito vacío, total Q0.00 y botón Completar venta deshabilitado", () => {
    cy.cart().within(() => {
      cy.contains("El carrito está vacío");
      cy.contains("Q0.00");
      cy.contains("button", "Completar venta").should("be.disabled");
    });
    cy.contains("Ganancias de hoy").next().should("have.text", "Q0.00");
  });

  it("TC-POS-006 el banner de alertas lleva a la pantalla de Inventario", () => {
    cy.contains("1 producto(s) con stock bajo").click();
    cy.get('input[placeholder^="Buscar producto por nombre"]').should("not.exist");
  });
});
