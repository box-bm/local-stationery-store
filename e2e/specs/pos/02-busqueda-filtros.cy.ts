// Punto de venta: búsqueda con autocompletado y filtro por categorías.
const cards = () => cy.get("main .grid > button");

const openCategoryFilter = () => cy.contains("button > span.truncate", "Todas").click();

describe("POS · Búsqueda y filtros", () => {
  beforeEach(() => cy.visitApp());

  context("Búsqueda", () => {
    it("TC-POS-007 filtra por coincidencia parcial del nombre sin distinguir mayúsculas", () => {
      cy.searchProduct("MARCADOR");
      cards().should("have.length", 1);
      cy.productCard("Marcador permanente negro").should("be.visible");
    });

    it("TC-POS-008 ignora tildes en el término de búsqueda", () => {
      cy.searchProduct("lapiz");
      cards().should("have.length", 1);
      cy.productCard("Lápiz Mongol #2").should("be.visible");
    });

    it("TC-POS-009 encuentra un producto por su código de barras", () => {
      cy.searchProduct("7501000000028");
      cards().should("have.length", 1);
      cy.productCard("Lápiz Mongol #2").should("be.visible");
    });

    it("TC-POS-010 encuentra productos por el nombre de la categoría", () => {
      cy.searchProduct("cuadernos");
      cards().should("have.length", 1);
      cy.productCard("Cuaderno universitario 100 hojas").should("be.visible");
    });

    it("TC-POS-011 muestra un mensaje cuando no hay coincidencias", () => {
      cy.searchProduct("producto inexistente xyz");
      cards().should("not.exist");
      cy.contains("No se encontraron productos").should("be.visible");
    });

    it("TC-POS-012 al borrar el término vuelve a mostrar todo el catálogo", () => {
      cy.searchProduct("tijera");
      cards().should("have.length", 1);
      cy.get('input[placeholder^="Buscar producto"]').clear();
      cards().should("have.length", 6);
    });
  });

  context("Filtro por categorías", () => {
    it("TC-POS-013 lista las categorías existentes en el desplegable", () => {
      openCategoryFilter();
      ["Cuadernos", "Escritura", "Papelería", "Útiles"].forEach((c) =>
        cy.contains("div.absolute button", c).should("be.visible")
      );
    });

    it("TC-POS-014 filtra por una sola categoría", () => {
      openCategoryFilter();
      cy.contains("div.absolute button", "Escritura").click();
      cards().should("have.length", 2);
      cy.productCard("Lápiz Mongol #2");
      cy.productCard("Marcador permanente negro");
      cy.get("body").type("{esc}");
      cy.contains("button > span.truncate", "Escritura").should("be.visible"); // resumen del filtro
    });

    it("TC-POS-015 combina varias categorías y muestra el conteo en el resumen", () => {
      openCategoryFilter();
      cy.contains("div.absolute button", "Escritura").click();
      cy.contains("div.absolute button", "Útiles").click();
      cards().should("have.length", 4);
      cy.contains("button > span.truncate", "Categorías (2)").should("be.visible");
    });

    it("TC-POS-016 'Limpiar' quita el filtro y restaura todos los productos", () => {
      openCategoryFilter();
      cy.contains("div.absolute button", "Cuadernos").click();
      cards().should("have.length", 1);
      cy.contains("div.absolute button", "Limpiar").click();
      cards().should("have.length", 6);
      cy.contains("button > span.truncate", "Todas").should("be.visible");
    });

    it("TC-POS-017 el filtro de categoría se combina con la búsqueda por texto", () => {
      openCategoryFilter();
      cy.contains("div.absolute button", "Útiles").click();
      cy.get("body").type("{esc}");
      cards().should("have.length", 2);
      cy.searchProduct("tijera");
      cards().should("have.length", 1);
      cy.productCard("Tijera escolar");
    });
  });
});
