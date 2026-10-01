// Punto de venta: carrito (agregar, combinar líneas, cantidades, quitar, vaciar, totales).

/** Línea del carrito que contiene el texto dado. */
const line = (text: string) => cy.cart().find("li").contains(text).parents("li");
// Botones de cada línea, en orden: [0] quitar, [1] −, [2] +.
const lineButton = (text: string, idx: 0 | 1 | 2) => line(text).find("button").eq(idx);
const cartTotal = () => cy.cart().contains("span", "Total").next();
const cartProfit = () => cy.cart().contains("span", "Total ganancias en esta venta").next();

describe("POS · Carrito", () => {
  beforeEach(() => cy.visitApp());

  it("TC-POS-030 agregar un producto muestra aviso, la línea, el total y la ganancia", () => {
    cy.addToCart("Marcador permanente negro");
    cy.toast("Marcador permanente negro agregado al carrito").should("be.visible");
    line("Marcador permanente negro").within(() => {
      cy.contains("Unidad · Q7.50");
      cy.contains("span", /^1$/);
      cy.contains("Q7.50");
    });
    cartTotal().should("have.text", "Q7.50");
    cartProfit().should("have.text", "Q3.50"); // 7.50 venta − 4.00 costo
    cy.cart().contains("button", "Completar venta").should("be.enabled");
  });

  it("TC-POS-031 el buscador se limpia y recupera el foco tras agregar", () => {
    cy.searchProduct("marcador");
    cy.addToCart("Marcador permanente negro");
    cy.focused().should("have.value", "");
    cy.get("main .grid > button").should("have.length", 6);
  });

  it("TC-POS-032 el mismo producto con la misma unidad se combina en una sola línea", () => {
    cy.addToCart("Marcador permanente negro", { qty: 2 });
    cy.addToCart("Marcador permanente negro", { qty: 3 });
    cy.cart().find("li").should("have.length", 1);
    line("Marcador permanente negro").contains("span", /^5$/);
    cartTotal().should("have.text", "Q37.50");
  });

  it("TC-POS-033 el mismo producto con distinta unidad genera líneas separadas", () => {
    cy.addToCart("Tijera escolar");
    cy.addToCart("Tijera escolar", { unit: "Par" });
    cy.cart().find("li").should("have.length", 2);
    cy.cart().find("li").eq(0).should("contain", "Unidad · Q12.00");
    cy.cart().find("li").eq(1).should("contain", "Par · Q22.00");
    cartTotal().should("have.text", "Q34.00");
  });

  it("TC-POS-034 los botones + y − de la línea actualizan cantidad, subtotal y total", () => {
    cy.addToCart("Marcador permanente negro");
    lineButton("Marcador permanente negro", 2).click().click();
    line("Marcador permanente negro").contains("span", /^3$/);
    line("Marcador permanente negro").should("contain", "Q22.50");
    cartTotal().should("have.text", "Q22.50");
    lineButton("Marcador permanente negro", 1).click();
    line("Marcador permanente negro").contains("span", /^2$/);
    cartTotal().should("have.text", "Q15.00");
  });

  it("TC-POS-035 bajar la cantidad de 1 a 0 elimina la línea", () => {
    cy.addToCart("Marcador permanente negro");
    lineButton("Marcador permanente negro", 1).click();
    cy.cart().find("li").should("not.exist");
    cy.cart().should("contain", "El carrito está vacío");
    cy.cart().contains("button", "Completar venta").should("be.disabled");
  });

  it("TC-POS-036 el botón quitar elimina solo esa línea", () => {
    cy.addToCart("Marcador permanente negro");
    cy.addToCart("Tijera escolar");
    lineButton("Marcador permanente negro", 0).click();
    cy.cart().find("li").should("have.length", 1).and("contain", "Tijera escolar");
    cartTotal().should("have.text", "Q12.00");
  });

  it("TC-POS-037 'Vaciar' elimina todas las líneas y reinicia el total", () => {
    cy.addToCart("Marcador permanente negro");
    cy.addToCart("Tijera escolar");
    cy.cart().contains("button", "Vaciar").click();
    cy.cart().should("contain", "El carrito está vacío");
    cartTotal().should("have.text", "Q0.00");
    cy.cart().contains("button", "Vaciar").should("not.exist");
  });

  it("TC-POS-038 calcula total y ganancia con varios productos y unidades fraccionarias", () => {
    cy.addToCart("Marcador permanente negro", { qty: 2 }); // 15.00, costo 8.00
    cy.addToCart("Lápiz Mongol #2", { qty: 3 }); // 3 × Q2.00 = 6.00, costo 18 × 0.08333333 × 3 ≈ 4.50
    cy.addToCart("Papel bond carta 80g", { unit: "Resma completa" }); // 35.00, costo 25.00
    cartTotal().should("have.text", "Q56.00");
    cartProfit().should("have.text", "Q18.50");
  });
});
