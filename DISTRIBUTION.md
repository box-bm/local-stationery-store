# Distribución, versionado y actualizaciones

Esta guía cubre cómo se versiona la base de datos y cómo se publican e instalan
nuevas versiones de la app (auto-update vía GitHub Releases).

## 1. Versionado de la base de datos (ya implementado)

El esquema de SQLite se versiona con **migraciones** de `tauri-plugin-sql`
(definidas en [`src-tauri/src/lib.rs`](src-tauri/src/lib.rs)):

- `version: 1` → crea el esquema inicial.
- `version: 2` → carga productos de ejemplo.

Cuando necesités cambiar el esquema en una versión futura, **agregá una nueva
migración** (`version: 3`, etc.) — nunca edites una migración ya publicada. El
plugin aplica solo las migraciones que faltan, en orden, la primera vez que cada
usuario abre la nueva versión. Los datos del usuario se conservan porque viven en
`AppConfig` (ver Configuración → "Ubicación de los datos"), fuera de la carpeta
de instalación: actualizar la app **no** borra la base de datos.

> Respaldá antes de migraciones grandes: Configuración → "Crear respaldo (.db)".

## 2. CI/CD y auto-actualización (Tauri Updater + GitHub Releases)

Tres workflows en `.github/workflows/`:

| Workflow | Disparador | Qué hace |
|---|---|---|
| `pr.yml` | Pull request a `main` | Typecheck + tests **solo de los archivos modificados** (`vitest --changed`). |
| `main.yml` | Push/merge a `main` | Tests + **determina automáticamente la versión** a partir de los mensajes de commit (Conventional Commits) → bump → draft release. |
| `release.yml` | Release **publicado** en GitHub | 1) Instala deps y compila el frontend **una sola vez**. 2) Los tres jobs de plataforma (Windows/macOS/Linux) descargan ese artefacto y solo compilan Rust, suben instaladores firmados + `latest.json`. |
| `version.yml` | Manual (escape hatch) | Fuerza un bump `major/minor/patch` sin necesidad de un commit convencional. |

Flujo completo:

```
PR  ─► pr.yml: typecheck + tests de archivos modificados
merge a main ─► main.yml: tests → lee commits → bump automático → draft release vX.Y.Z
tú en GitHub ─► "Publish release" (lo marcás como release)
            └─► release.yml: build + firma + sube instaladores y latest.json
app del usuario al abrir
            └─► consulta latest.json ─► "Actualización disponible" ─► instala y reinicia
```

### Conventional Commits — cómo escribir mensajes de commit

El tipo del commit determina automáticamente qué versión se bump-ea:

| Prefijo | Tipo de cambio | Bump |
|---------|---------------|------|
| `fix:` | Corrección de bug | patch `0.2.0 → 0.2.1` |
| `perf:` | Mejora de rendimiento | patch |
| `feat:` | Nueva funcionalidad | minor `0.2.0 → 0.3.0` |
| `feat!:` o `BREAKING CHANGE` | Cambio que rompe compatibilidad | major `0.2.0 → 1.0.0` |
| `chore:`, `docs:`, `refactor:`, `test:`, `style:`, `ci:` | Mantenimiento | ninguno |

Si un push a `main` solo contiene commits sin bump (`chore:`, etc.), no se crea ningún draft release.

Si hay múltiples commits en un mismo push, gana el mayor: `feat:` + `fix:` → minor.

> Nota: al publicar el release, queda visible unos minutos sin binarios hasta que
> `release.yml` termina de compilar y los adjunta.

Piezas ya configuradas:

- **Plugin updater** (Rust + JS) y `createUpdaterArtifacts: true` en
  [`tauri.conf.json`](src-tauri/tauri.conf.json).
- **Clave pública** del updater incrustada en `plugins.updater.pubkey`.
- **Endpoint** del updater apuntando a:
  `https://github.com/box-bm/local-stationery-store/releases/latest/download/latest.json`
- **UI**: Configuración → "Actualizaciones" (buscar / instalar) y un aviso
  automático al abrir la app si hay versión nueva.
- **Workflow** de CI en `.github/workflows/release.yml`.

### Pasos para dejarlo funcionando (una sola vez)

1. **Creá el repo en GitHub** y subí el proyecto. Si el usuario/repositorio no es
   `box-bm/local-stationery-store`, actualizá:
   - El `endpoint` en `src-tauri/tauri.conf.json`.
   - `releaseName` en el workflow si querés.

2. **Cargá la clave privada de firma como secretos del repo**
   (Settings → Secrets and variables → Actions):
   - `TAURI_SIGNING_PRIVATE_KEY` → contenido de `.keys/libreria.key`
     - macOS: `cat .keys/libreria.key | pbcopy` y pegá el valor.
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` → vacío (la clave se generó sin
     contraseña). Podés regenerarla con contraseña si preferís:
     `npx tauri signer generate -w .keys/libreria.key`

   > ⚠️ La carpeta `.keys/` está en `.gitignore`. **No** subas la clave privada
   > al repo. Si la perdés, los usuarios no podrán recibir updates firmados con
   > esa clave y tendrás que migrar la pubkey.

3. **Publicá una versión:**
   - Escribí commits con prefijos convencionales (`fix:`, `feat:`, etc.) y hacé merge a `main`.
   - `main.yml` corre los tests y crea un **release en borrador** `v0.2.0`.
   - Andá a GitHub → Releases → editá el borrador y dale **"Publish release"**.
   - Eso dispara `release.yml`, que compila, firma y adjunta los instaladores y
     `latest.json`. A partir de ahí el updater de los usuarios ve la nueva versión.

4. **Code signing del SO (recomendado para producción, no incluido):**
   - Windows: sin firma con certificado, SmartScreen mostrará una advertencia.
     Considerá un certificado de Code Signing (OV/EV) y configurá
     `bundle.windows.certificateThumbprint` o firma vía CI.
   - macOS: para distribuir fuera de tu equipo necesitás firmar + notarizar con
     una cuenta de Apple Developer.
   - Nota: la firma del **updater** (minisign) es independiente del code signing
     del SO; el updater ya está firmado, pero el SO igual puede advertir si el
     instalador no está firmado con un certificado reconocido.

## 3. Alternativas (por si cambiás de idea)

| Opción | Auto-update | Costo | Cuándo |
|---|---|---|---|
| **GitHub Releases + updater** (elegida) | Sí, en la app | Gratis | Recomendado |
| GitHub Releases, descarga manual | No | Gratis | Pocos equipos, sin firma |
| Servidor de updates propio | Sí | Hosting | Control total / privado |
| Microsoft Store | Sí (Store) | Cuenta dev | Distribución pública en Windows |

Todas preservan la base de datos del usuario (vive en `AppConfig`), así que las
migraciones de la sección 1 aplican igual en cualquier esquema de distribución.
