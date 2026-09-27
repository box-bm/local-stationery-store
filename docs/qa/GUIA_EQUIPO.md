# Proyecto Final: Aseguramiento de la Calidad de Software

**Universidad Mariano Gálvez de Guatemala, Ingeniería en Sistemas de Información, Plan Sábado**
**Curso:** 0900 048, Aseguramiento de la Calidad de Software (sábados 16:00 a 18:00, CC-28)
**Título del proyecto:** Implementación Integral de Aseguramiento de Calidad en un Producto de Software usando SCRUM
**Sistema bajo prueba:** Librería POS (punto de venta e inventario)
**Repositorio:** https://github.com/box-bm/local-stationery-store

> Este documento es la fuente de verdad del equipo. Si lo pasan a una IA para pedir ayuda, pásenlo completo junto con la tarea específica que les toca.

---

## 1. Equipo

| # | Nombre | Roles SCRUM / QA |
|---|---|---|
| 1 | Brandon Manzo | Product Owner, Arquitecto, Líder Técnico |
| 2 | Maria Jose Mauricio | Scrum Master, SQA |
| 3 | Antony Toribio | QA (diseño de pruebas y ejecución manual) |
| 4 | Josue Camey | QA Automatización |
| 5 | Jonathan Castillo | Dev |

**Principio de independencia:** Brandon es el autor del código, por eso no actúa como QA ni SQA. Los fixes los verifica una persona distinta a quien los implementó.

---

## 2. Qué se debe entregar

### Entregables finales
1. Documento completo del proyecto (PDF).
2. Carpeta de evidencias (pruebas, videos, capturas, reportes).
3. Test Suite automatizado.
4. Backlog y artefactos SCRUM.
5. Presentación ejecutiva (15 minutos).

### Rúbrica (20 puntos)

| Criterio | Contenido | Puntos |
|---|---|---|
| Sprint 1: Preparación | Backlog, roles, arquitectura, atributos de calidad, métricas | 3 |
| Sprint 2: Diseño de pruebas | Técnicas tradicionales, casos de prueba, plan de pruebas | 4 |
| Sprint 3: Gestión de bugs | Registro profesional, clasificación, ciclo de vida, depuración | 4 |
| Sprint 4: Automatización | Pruebas automatizadas, caja blanca, caja negra, test suite | 4 |
| Presentación ejecutiva | Claridad, evidencia, métricas, conclusiones, profesionalismo | 5 |

> Nota: el enunciado original tiene inconsistencias (dice "Sprint 3" dos veces y asigna 7 puntos a la presentación en el texto pero 5 en la rúbrica). Brandon lo confirma con el ingeniero. Mientras tanto se trabaja con 4 sprints más cierre. Confirmar también con el ingeniero que Vitest (compatible con Jest) es aceptado y que una app de escritorio califica como producto de software.

### Mínimos exigidos
- Mínimo **12 casos de prueba** diseñados.
- Mínimo **10 bugs** registrados profesionalmente.
- Técnicas obligatorias: clases de equivalencia, valores límite, tablas de decisión, pairwise testing, diagrama de transición de estados.
- Clasificación de cada bug como **error, defecto o fallo** (según guía de la semana 9).
- Priorización basada en riesgos.
- Ciclo de vida del bug gestionado con SCRUM (según guía de la semana 8).
- Plan de pruebas completo (según guía de la semana 10).
- Pruebas automatizadas con Selenium, Cypress, Jest, Robot Framework o JMeter.
- Prueba de caja blanca y de caja negra.
- Informe de resultados y evidencias (capturas, logs, videos).
- Dashboard de métricas, conclusiones ejecutivas, recomendaciones de mejora continua y lecciones aprendidas.

---

## 3. Calendario

Las clases terminan el 31 de octubre de 2026 (sábado). **La meta interna de entrega es el sábado 24 de octubre**, dejando una semana de colchón para imprevistos.

Sprints semanales que cierran el viernes:

| Sprint | Fechas | Objetivo |
|---|---|---|
| 1 | 21 a 27 sep | Preparación: backlog, roles, arquitectura, atributos de calidad, métricas |
| 2 | 28 sep a 4 oct | Diseño de pruebas |
| 3 | 5 a 11 oct | Ejecución manual y gestión de bugs |
| 4 | 12 a 18 oct | Automatización y técnicas avanzadas |
| Cierre | 19 a 24 oct | Documento final, dashboard, ensayo de presentación |

**Ritmo del equipo**
- **Kickoff:** semana del 21 de septiembre.
- **Reuniones oficiales:** miércoles (seguimiento a mitad de sprint, desbloqueos) y viernes (Sprint Review, retrospectiva y planning del siguiente sprint).
- **Daily asíncrono:** de lunes a viernes por chat, 3 preguntas: qué hice, qué haré, qué me bloquea.
- **Cierre final:** viernes 23 de octubre se hace la revisión final y el sábado 24 se entrega.

| Fecha | Hito |
|---|---|
| Vie 25 sep | Review Sprint 1 |
| Vie 2 oct | Review Sprint 2 |
| Vie 9 oct | Review Sprint 3 |
| Vie 16 oct | Review Sprint 4 |
| Vie 23 oct | Revisión final y ensayo de la presentación |
| Sáb 24 oct | Entrega interna |
| Sáb 31 oct | Fin de clases (colchón) |

---

## 4. El sistema bajo prueba

### Qué es
Aplicación de escritorio de **punto de venta e inventario** para una librería en Guatemala. Funciona sin conexión con una base de datos SQLite local.

### Concepto clave: unidades dinámicas
Un producto se **compra** en bloque (por ejemplo una resma de 500 hojas) pero se **vende** de varias formas con distinto precio: `hoja` a Q0.25, `4 hojas` a Q1.00, `resma completa` a Q35.00. El stock siempre se mide en **unidades base**. Al vender se descuenta `quantity_in_base_units × cantidad`.

### Stack técnico
- Frontend: React 18 + TypeScript + Vite
- Shell de escritorio: Tauri v2 (Rust)
- Base de datos: SQLite vía `tauri-plugin-sql`
- UI: Tailwind CSS + componentes estilo shadcn/ui
- Estado: Zustand
- Formularios: React Hook Form + Zod
- Excel: SheetJS
- Tests existentes: Vitest + Testing Library + jsdom
- CI: GitHub Actions

### Módulos (pantallas)
1. **Punto de venta:** búsqueda con autocompletado, filtro por categorías, lector de código de barras, selección de unidad y cantidad, carrito, cobro (efectivo o transferencia), cliente opcional, recibo.
2. **Inventario:** tabla de productos, alertas de stock (bajo y agotado), alta y edición con múltiples unidades de venta, reabastecimiento, ajuste de stock.
3. **Ventas:** historial con filtros por fecha, detalle por venta, exportación a Excel.
4. **Configuración:** idioma (es/en), tema, moneda, métodos de pago, nombre del negocio, respaldos, bloqueo con PIN, sincronización con Google Drive, actualizaciones.

### Archivos clave para pruebas

| Archivo | Qué contiene |
|---|---|
| `src/lib/calc.ts` | Subtotal, total, ganancia, descuento de stock (lógica pura) |
| `src/lib/stock.ts` | Estados de stock: `ok`, `low`, `out` |
| `src/lib/crypto.ts` | Hash del PIN de bloqueo |
| `src/stores/cart.ts` | Carrito (Zustand): agregar, quitar, actualizar cantidad |
| `src/services/db.ts` | Toda la lógica SQL, incluido `completeSale` |
| `src/components/pos/CheckoutModal.tsx` | Flujo de cobro |
| `src/components/inventory/ProductFormModal.tsx` | Formulario de producto y esquema Zod |
| `src/i18n/` | Traducciones es/en |

### Cómo correrlo

```bash
git clone https://github.com/box-bm/local-stationery-store.git
cd local-stationery-store
npm install

npm test               # tests unitarios existentes (Vitest)
npm run test:coverage  # cobertura
npm run dev            # solo frontend en navegador (sin SQLite)
npm run tauri:dev      # app completa (requiere Rust y prerrequisitos de Tauri)
```

Prerrequisitos de Tauri: https://v2.tauri.app/start/prerequisites/

**Versión baseline bajo prueba:** release **v0.4.0**. Todos prueban esta versión y cualquier bug se reporta contra ella.
**Instaladores:** https://github.com/box-bm/local-stationery-store/releases/tag/v0.4.0 (hay `.exe` para Windows, y builds para macOS y Linux). Para pruebas manuales de la app completa usen el instalador, sin necesidad de instalar Rust.

---

## 5. Stack de herramientas del equipo

| Área | Herramienta | Notas |
|---|---|---|
| Planificación, backlog y bugs | **GitHub Projects + Issues** | Sprints como iterations, tablero Kanban, burndown |
| Código y CI | GitHub + Actions | Branches y Pull Requests, review obligatorio |
| Caja blanca | **Vitest** + `@vitest/coverage-v8` + Testing Library | API compatible con Jest. Justificar en el documento |
| Caja negra / E2E | **Cypress** | Con `mockIPC` de Tauri o `tauri-driver` + Selenium (decidir en Sprint 1) |
| Casos de prueba, matrices, métricas | Google Sheets | Una hoja por técnica |
| Pairwise | PICT o herramienta web equivalente | Salida pegada en Sheets |
| Diagramas | Mermaid o draw.io | Arquitectura y estados |
| Documento final | Google Docs, exportado a PDF | Una sección por persona |
| Evidencias | Carpeta compartida en Drive | Convención de nombres abajo |
| Grabación de video | OBS o Xbox Game Bar | Un video corto por bug crítico |
| Performance (JMeter) | No aplica | App de escritorio sin HTTP. Se justifica en el documento |

### Convenciones

**Branches:** `feat/<tema>`, `fix/bug-<id>`, `test/<tema>`, `docs/<tema>`.
**Commits:** prefijos `feat:`, `fix:`, `test:`, `docs:`.
**Pull Requests:** mínimo una aprobación de alguien distinto al autor. Brandon revisa lo de código.
**Evidencias:** `S<sprint>_<tipo>_<id>_<descripcion>.<ext>`, por ejemplo `S3_BUG-004_stock_negativo.png`.
**IDs:**
- Casos de prueba: `TC-<MOD>-<###>` (POS, INV, VEN, CFG). Ejemplo `TC-POS-003`.
- Bugs: `BUG-<###>`, coincide con el issue de GitHub.
- Historias: `US-<###>`.

**Labels de GitHub:**
- Tipo: `bug`, `story`, `test`, `docs`
- Severidad: `sev:critica`, `sev:alta`, `sev:media`, `sev:baja`
- Prioridad (por riesgo): `prio:P1`, `prio:P2`, `prio:P3`
- Clasificación: `clase:error`, `clase:defecto`, `clase:fallo`
- Sprint: `sprint:1` a `sprint:4`

**Columnas del tablero (ciclo de vida del bug):** Nuevo, Asignado, En progreso, Corregido, En verificación, Cerrado, Reabierto. Ajustar a lo que diga la guía de la semana 8.

### Definition of Done (aplica a cualquier tarea)
- El entregable está en su carpeta o rama.
- Otra persona lo revisó.
- Tiene evidencia enlazada.
- Está referenciado en el documento maestro.

---

## 6. Uso de IA en el equipo

El equipo se apoya en herramientas de IA para código, redacción y análisis. Esto es válido siempre que se cumplan estas reglas:

1. Los bugs deben ser **reales y reproducidos** en la aplicación. La IA no inventa hallazgos.
2. Cada persona revisa y firma lo que genera. Si no lo entiende, no lo entrega.
3. Los casos de prueba y tests generados se ejecutan antes de entregarse.
4. Se incluye una nota breve de **uso de IA** en el documento final.
5. Al pedir ayuda a una IA, entregarle este documento completo, el archivo del repo relevante y la tarea puntual.

---

## 7. Responsabilidades por persona y sprint

### 7.1 Brandon Manzo: PO, Arquitecto, Líder Técnico

**Responsabilidad general:** dueño del producto y del código. Prioriza, define arquitectura, revisa PRs y decide prioridad de bugs.

| Sprint | Tareas |
|---|---|
| 1 | Agregar a los 4 integrantes como collaborators en GitHub. Crear el GitHub Project y el Product Backlog con historias (`US-###`) por módulo, con criterios de aceptación. Escribir el **documento inicial del sistema**: arquitectura (capas UI, stores, servicios, SQLite, Tauri), módulos y dependencias, con diagrama Mermaid. Fijar v0.4.0 como versión baseline y compartir el link del release |
| 2 | Construir el **diagrama de transición de estados** (carrito, cobro, stock) junto con Antony. Apoyar el pairwise definiendo factores reales. Resolver dudas funcionales del sistema |
| 3 | Priorizar bugs con Maria Jose. Corregir bugs de alta prioridad junto con Jonathan. Revisar PRs |
| 4 | Revisar PRs de tests. Apoyar a Josue con el setup si algo del código lo bloquea (por ejemplo `data-testid`) |
| Cierre | Redactar la sección de arquitectura y decisiones técnicas del documento. Ensayar la presentación |

**Entregables:** backlog, documento de arquitectura, diagrama de estados, PRs revisados.

### 7.2 Maria Jose Mauricio: Scrum Master, SQA

**Responsabilidad general:** proceso, calidad del proceso, métricas y documento final. No necesita programar.

| Sprint | Tareas |
|---|---|
| 1 | Configurar el tablero (columnas, labels, iterations). Definir los **atributos de calidad** aplicables (según guía de la semana 9; referencia ISO 25010: exactitud funcional, fiabilidad, usabilidad, seguridad, mantenibilidad). Seleccionar **métricas de calidad** (ver sección 8). Documentar roles y responsabilidades. Crear el Google Doc maestro con la estructura y secciones por persona. Dirigir el kickoff y agendar las reuniones de miércoles y viernes |
| 2 | Redactar el **plan de pruebas completo** (según guía de la semana 10: alcance, estrategia, criterios de entrada y salida, riesgos, ambiente, roles, calendario, entregables). Construir la **tabla de decisión** del cobro con Antony |
| 3 | Gestionar el **ciclo de vida de los bugs** en el tablero. Verificar que cada bug esté bien redactado y clasificado. Redactar el **reporte de depuración y verificación** |
| 4 | Redactar el **informe de resultados**. Construir el **dashboard de métricas** (Google Sheets o Looker Studio) |
| Cierre | Consolidar el PDF final. Preparar la presentación de 15 minutos: distribución de turnos, diapositivas, conclusiones, recomendaciones, lecciones aprendidas |

**Ceremonias que dirige:** kickoff (semana del 21 sep), reunión de seguimiento los miércoles, Sprint Review, Retrospectiva y Planning los viernes, Daily asíncrono por chat de lunes a viernes.

**Entregables:** plan de pruebas, definición de atributos y métricas, reporte de depuración, informe de resultados, dashboard, PDF final, presentación.

### 7.3 Antony Toribio: QA (diseño y ejecución manual)

**Responsabilidad general:** diseñar los casos de prueba con las técnicas obligatorias, ejecutarlos y registrar bugs.

| Sprint | Tareas |
|---|---|
| 1 | Crear la **plantilla de casos de prueba** (ID, módulo, técnica, precondiciones, pasos, datos, resultado esperado, resultado real, estado) y la **plantilla de reporte de bug** (ID, título, módulo, versión, ambiente, pasos, esperado, actual, severidad, prioridad, clasificación, evidencia). Ambas como Sheet y como Issue template de GitHub |
| 2 | Aplicar las técnicas (detalle en sección 9): **clases de equivalencia**, **valores límite**, **tabla de decisión** (con Maria Jose), **pairwise**, **diagrama de estados** (con Brandon). Redactar **al menos 12 casos** cubriendo todas las técnicas |
| 3 | Ejecutar todos los casos manualmente. Registrar cada bug como Issue con evidencia. Clasificar como error, defecto o fallo y proponer severidad. **Meta: 10 o más bugs reales** |
| 4 | Ejecutar pruebas de regresión sobre los bugs corregidos. Apoyar a Josue proveyendo los casos priorizados para automatizar |
| Cierre | Redactar la sección de diseño de pruebas y ejecución del documento |

**Entregables:** hoja de casos de prueba, hojas de técnicas, registro de bugs, resultados de ejecución.

### 7.4 Josue Camey: QA Automatización

**Responsabilidad general:** pruebas automatizadas de caja negra (E2E) y test suite.

| Sprint | Tareas |
|---|---|
| 1 | **Spike técnico**: probar si Cypress corre bien contra `npm run dev` con `mockIPC` de `@tauri-apps/api/mocks` para simular `tauri-plugin-sql`, o si es más viable `tauri-driver` + Selenium (solo Windows y Linux). Entregar una nota corta con la decisión y un test de humo funcionando (abrir app, ver pantalla POS). **Reportar resultado en la reunión del miércoles 23 sep** (máximo 2 o 3 días de esfuerzo). Se trabaja sobre el POS, el spike solo define el enfoque E2E |
| 2 | Montar la estructura del proyecto E2E: carpeta `e2e/`, fixtures de productos, comandos personalizados, scripts en `package.json`. Empezar a automatizar los casos ya diseñados por Antony |
| 3 | Automatizar los casos críticos (flujo de venta completa, alta de producto, alerta de stock, filtros de ventas). Grabar videos y capturas con Cypress |
| 4 | Completar el **Test Suite automatizado**. Ejecutar la suite completa y entregar reporte (HTML o Mochawesome), logs, videos. Integrar la suite a GitHub Actions si es viable |
| Cierre | Redactar la sección de automatización. Preparar demo en vivo o video para la presentación |

**Entregables:** nota del spike, carpeta `e2e/`, suite de caja negra, reportes, videos.

**Regla:** un test que falla por un bug real se deja documentado como evidencia y se referencia con su `BUG-###`.

### 7.5 Jonathan Castillo: Dev

**Responsabilidad general:** pruebas de caja blanca, corrección de bugs y reporte técnico.

| Sprint | Tareas |
|---|---|
| 1 | Correr `npm test` y `npm run test:coverage`. Entregar la **línea base de cobertura** por archivo. Listar módulos sin cobertura |
| 2 | Empezar tests de caja blanca sobre lógica pura: ampliar `calc.ts`, `stock.ts`, `cart.ts`. Aplicar valores límite del diseño de Antony (cantidades 0, negativas, decimales, muy grandes, precios con centavos) |
| 3 | Corregir bugs asignados en ramas `fix/bug-###` con PR. Escribir un test que reproduzca cada bug antes de corregirlo (el test debe fallar, luego pasar). Documentar causa raíz |
| 4 | Tests de `db.ts` con mock de `@tauri-apps/plugin-sql` (en especial `completeSale`, `restockProduct`, `adjustStock`), del esquema Zod de `ProductFormModal` y de `CheckoutModal`. Cobertura de ramas (branch coverage) en los módulos críticos. **Meta: subir la cobertura respecto a la línea base** |
| Cierre | Redactar la sección de caja blanca y depuración. Reporte de cobertura final |

**Entregables:** línea base de cobertura, tests nuevos, PRs de fixes, reporte de cobertura final.

---

## 8. Métricas de calidad propuestas

| Métrica | Fórmula o fuente |
|---|---|
| Cobertura de código (líneas, ramas) | `vitest --coverage` |
| Cobertura de requisitos | Historias con al menos un caso / total de historias |
| % de casos aprobados | Casos aprobados / casos ejecutados |
| Densidad de defectos | Bugs por módulo (o por KLOC) |
| Distribución por severidad | Conteo por `sev:*` |
| Eficiencia de remoción de defectos (DRE) | Bugs corregidos y verificados / bugs totales |
| Tasa de reapertura | Bugs reabiertos / bugs cerrados |
| Tiempo medio de corrección | Fecha cierre menos fecha apertura |
| Velocidad del equipo | Puntos o tareas completadas por sprint |

---

## 9. Guía de técnicas de diseño (semillas para Sprint 2)

Estas son ideas iniciales basadas en el código. Antony las refina y valida contra la app real.

### Clases de equivalencia y valores límite
- **Cantidad en carrito:** inválida (menor o igual a 0, no numérica), válida (entero positivo), decimal. Límites: 0, 1, stock disponible, stock + 1.
- **`sell_price`** (Zod: no negativo): negativo, 0, positivo, con muchos decimales. Límites: -0.01, 0, 0.01.
- **`quantity_in_base_units`** (Zod: positivo): 0, 0.0001, 1, fracciones.
- **`stock` y `min_stock`** (Zod: no negativo). Estado según `stockStatus`: `stock <= 0` es `out`, `0 < stock <= min_stock` es `low`, mayor es `ok`. Límites: -1, 0, 1, `min_stock`, `min_stock + 1`.
- **Efectivo recibido** frente al total: menor, igual, mayor, vacío.

### Tabla de decisión: cobro
Condiciones: carrito con ítems (sí/no), método de pago (efectivo/transferencia), código de autorización (con/sin), efectivo recibido (menor/igual/mayor al total), cliente (con/sin), métodos de pago habilitados (sí/no). Acciones: permitir o bloquear cobro, calcular vuelto, mostrar error.

### Pairwise
Factores candidatos: unidad de venta (base / fracción / paquete), método de pago (efectivo / transferencia), cliente (con / sin / existente), idioma (es / en), tema (claro / oscuro), filtro de fecha en Ventas (hoy / semana / mes / rango).

### Diagrama de transición de estados
- **Cobro:** carrito vacío, con ítems, modal de confirmación, guardando, recibo, error.
- **Stock de producto:** `ok`, `low`, `out`, con transiciones por venta, reabastecimiento y ajuste.
- **Bloqueo de la app:** sin PIN, con PIN bloqueada, desbloqueada.

---

## 10. Hipótesis de bugs (a verificar, no son hallazgos confirmados)

Detectadas al leer el código. **Ninguna cuenta como bug hasta reproducirla en la app y tener evidencia.**

1. `completeSale` no valida stock: puede quedar negativo.
2. `completeSale` ejecuta varios `INSERT/UPDATE` sin transacción: un fallo a mitad deja datos inconsistentes.
3. Efectivo recibido menor al total produce vuelto negativo.
4. Transferencia sin código de autorización se acepta.
5. `sale_number` se calcula con `MAX()+1`: riesgo de duplicado bajo concurrencia.
6. Aritmética con números flotantes en dinero (`price * quantity`).
7. Hash del PIN con SHA-256 y salt estático (débil, documentado en el código como protección básica).
8. Posibles casos con cantidades decimales o no numéricas en el carrito.
9. Comportamiento al eliminar un producto con ventas históricas.

Además, se espera que la ejecución manual descubra defectos que aquí no aparecen. Esos son los más valiosos.

---

## 11. Estructura sugerida del documento final (PDF)

1. Carátula (nombres, carnets, curso, fecha, logo UMG, título)
2. Introducción, objetivos general y específicos
3. Sprint 1: backlog, roles, arquitectura, atributos de calidad, métricas
4. Sprint 2: técnicas de diseño, casos de prueba, plan de pruebas
5. Sprint 3: ejecución, registro de bugs, clasificación, priorización, ciclo de vida, reporte de depuración
6. Sprint 4: automatización, caja blanca, caja negra, test suite, informe de resultados
7. Dashboard de métricas
8. Conclusiones ejecutivas y recomendaciones de mejora continua
9. Lecciones aprendidas del equipo SCRUM
10. Nota de uso de IA
11. Anexos: enlaces al repo, evidencias, backlog

---

## 12. Riesgos del proyecto

| Riesgo | Mitigación |
|---|---|
| Poco tiempo (4 semanas y media hasta el 24 oct) | Trabajo en paralelo desde Sprint 1, Josue y Jonathan adelantan setup y tests |
| E2E complejo por Tauri y SQLite | Spike en Sprint 1 con límite de 2 o 3 días, alternativas: `mockIPC` o `tauri-driver` + Selenium |
| Bugs insuficientes o poco reproducibles | Todos ejecutan pruebas manuales en Sprint 3 |
| Documento acumulado al final | Cada quien redacta su sección al cerrar su sprint |
| Dependencia excesiva de IA | Reglas de la sección 6 |
| Ambigüedad del enunciado | Brandon consulta con el ingeniero esta semana |
