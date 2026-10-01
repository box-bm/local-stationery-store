// Punto de venta: lector de código de barras (useBarcodeScanner).
// El lector USB se comporta como un teclado muy rápido terminado en Enter;
// cy.scanBarcode lo simula disparando las teclas sin pausa.

describe("POS · Lector de código de barras", () => {
  beforeEach(() => cy.visitApp());

  it("TC-POS-054 escanear un código existente agrega la unidad por defecto con cantidad 1", () => {
    cy.scanBarcode("7501000000035");
    cy.toast("Marcador permanente negro agregado (Unidad)").should("be.visible");
    cy.cart().find("li").should("have.length", 1).and("contain", "Marcador permanente negro");
    cy.cart().contains("span", "Total").next().should("have.text", "Q7.50");
  });

  it("TC-POS-055 escanear dos veces el mismo código suma la cantidad en la misma línea", () => {
    cy.scanBarcode("7501000000035");
    cy.scanBarcode("7501000000035");
    cy.cart().find("li").should("have.length", 1).contains("span", /^2$/);
    cy.cart().contains("span", "Total").next().should("have.text", "Q15.00");
  });

  it("TC-POS-056 un producto con varias unidades se agrega con su unidad por defecto", () => {
    cy.scanBarcode("7501000000011");
    cy.toast("Papel bond carta 80g agregado (Hoja individual)").should("be.visible");
    cy.cart().find("li").should("contain", "Hoja individual · Q0.25");
  });

  it("TC-POS-057 un código desconocido muestra advertencia y no modifica el carrito", () => {
    cy.scanBarcode("0000000000000");
    cy.toast("Sin coincidencia para el código 0000000000000").should("be.visible");
    cy.cart().should("contain", "El carrito está vacío");
  });

  it("TC-POS-058 escribir el código a velocidad humana busca en lugar de escanear", () => {
    cy.get('input[placeholder^="Buscar producto"]').type("7501000000035{enter}", { delay: 120 });
    cy.get("main .grid > button").should("have.length", 1);
    cy.productCard("Marcador permanente negro");
    cy.cart().should("contain", "El carrito está vacío");
  });

  it("TC-POS-059 el lector se desactiva mientras el modal de unidad está abierto", () => {
    cy.productCard("Tijera escolar").click();
    cy.dialog();
    cy.scanBarcode("7501000000035");
    cy.dialog().contains("button", "Cancelar").click();
    cy.cart().should("contain", "El carrito está vacío");
  });
});
