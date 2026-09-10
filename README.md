# Gitgrove

Una app de macOS para entender visualmente tus repositorios Git. Grafo de commits y merges, ramas locales y remotas, tags, worktrees, stashes y diffs en una interfaz oscura. Funciona localmente y no requiere suscripción.

## Descargar y compilar en tu Mac

**Versión 1.1.0 · macOS 13 Ventura o posterior · Apple Silicon (M1 o posterior).**
Esta versión no genera aplicaciones para Mac Intel, Windows ni Linux.

### 1. Preparar el Mac (solo la primera vez)

Instalá [Node.js 22](https://nodejs.org/en/download/archive/v22) para **macOS ARM64**, versión 22.20 o posterior. El instalador incluye npm y npx. No necesitás instalar pnpm globalmente.

Instalá las herramientas de Apple desde Terminal:

```sh
xcode-select --install
```

Completá el instalador antes de continuar. Si ya están instaladas, podés pasar al siguiente paso. No hace falta descargar Xcode completo ni tener una cuenta de desarrollador de Apple.

Comprobá los requisitos:

```sh
node --version
npm --version
uname -m
```

`node` debe indicar `v22.20.0` o superior y `uname -m` debe indicar `arm64`. La primera compilación necesita conexión a Internet para descargar dependencias y Electron.

### 2. Descargar esta versión

```sh
git clone --branch v1.1.0 --depth 1 https://github.com/za0sec/gitkraken.git gitgrove
cd gitgrove
```

El tag `v1.1.0` fija exactamente esta versión. Para trabajar sobre el código más reciente, usá `--branch main`.

También podés descargar el [ZIP del código fuente de v1.1.0](https://github.com/za0sec/gitkraken/archive/refs/tags/v1.1.0.zip), descomprimirlo y abrir Terminal en esa carpeta.

Si GitHub muestra `404` o `Repository not found`, comprobá que tu cuenta tenga acceso: mientras el repositorio sea privado, solo sus colaboradores pueden descargarlo. Con una sesión autorizada de GitHub CLI podés usar:

```sh
gh repo clone za0sec/gitkraken gitgrove -- --branch v1.1.0 --depth 1
cd gitgrove
```

### 3. Generar la app y el ZIP con un comando

Desde la carpeta descargada:

```sh
bash scripts/package-mac.sh
```

El script comprueba el Mac y Node, usa **pnpm 10.26.1**, instala las versiones del lockfile, compila la interfaz, incluye el servidor local y el runtime de Electron, genera el icono y firma el paquete con una firma ad hoc. No modifica tus repositorios ni reemplaza otra instalación de Gitgrove.

Al terminar encontrarás:

```text
release/
├── mac-arm64/
│   └── Gitgrove.app
└── Gitgrove-1.1.0-mac-arm64.zip
```

Para compilar y abrirla al terminar, usá:

```sh
bash scripts/package-mac.sh --open
```

Si ya tenés los requisitos, la secuencia completa es:

```sh
git clone --branch v1.1.0 --depth 1 https://github.com/za0sec/gitkraken.git gitgrove && cd gitgrove && bash scripts/package-mac.sh --open
```

### 4. Instalar y usar

Abrí la carpeta del resultado:

```sh
open release/mac-arm64
```

Arrastrá **Gitgrove.app** a **Aplicaciones**. Si estás actualizando, cerrá la versión anterior antes de reemplazarla. Después podés abrir Gitgrove desde Aplicaciones, cerrar Terminal y borrar la carpeta del código: la app ya incluye todo lo necesario para ejecutarse, salvo Git y la integración opcional con GitHub CLI.

Para compartir el resultado con otro Mac Apple Silicon, usá el ZIP generado. También está disponible la [descarga compilada de v1.1.0](https://github.com/za0sec/gitkraken/releases/tag/v1.1.0).

El paquete tiene firma ad hoc y no está notarizado por Apple. Si macOS bloquea un ZIP descargado, después del primer intento de apertura usá **Configuración del Sistema → Privacidad y seguridad → Abrir igualmente**, solo si confiás en su procedencia. Compilarlo en tu propio Mac es la alternativa descrita arriba; no hace falta desactivar Gatekeeper. [Instrucciones de Apple](https://support.apple.com/en-gb/guide/mac-help/mh40616/mac).

### Alternativa: ejecutar cada paso a mano

Dentro de la carpeta del proyecto y con los requisitos del paso 1 instalados:

```sh
npx --yes pnpm@10.26.1 install --frozen-lockfile
npx --yes pnpm@10.26.1 desktop:build
open release/mac-arm64/Gitgrove.app
```

## Usar la app

1. Elegí **Abrir repositorio** (`⌘O`) y seleccioná una carpeta que tenga Git. También detecta repositorios en carpetas habituales: `Developer`, `Projects`, `Repos`, `code`, `github`, `Documents/GitHub` y `conductor/workspaces`.
2. Seleccioná una rama para seguir su historial, o **Todas las ramas** para ver cómo se conectan. Los nombres de ramas y tags aparecen a la izquierda del grafo. Los colores representan carriles continuos: las líneas se unen en el commit padre real, incluidos merges con varios padres. El historial intercala las ramas por fecha y conserva el orden de ascendencia; solo incluye ramas, remotos, tags y el HEAD abierto, sin checkpoints ni archivos internos de Conductor.
3. Hacé clic en un commit para ver autor, padres, referencias y archivos. Hacé clic en un archivo para abrir su diff.
4. **Cambios locales** muestra modificaciones, staging y archivos nuevos. **Fetch** actualiza referencias remotas sin hacer checkout, pull ni cambiar archivos locales.

Las pestañas, repositorios recientes, densidad y actualización automática se guardan entre sesiones. El refresco local automático ocurre cada 15 segundos, y podés desactivarlo en Preferencias. **Fetch** siempre es manual.

## GitHub

La lectura de repositorios locales solo necesita `git`, que ya viene con las herramientas de desarrollo de macOS. No requiere cuenta de GitHub.

Para explorar y clonar repositorios de GitHub, Gitgrove usa la autenticación existente de [GitHub CLI](https://cli.github.com/). Si necesitás conectar tu cuenta:

```sh
gh auth login
```

Después elegí **Conectar GitHub**. Podés ver hasta 100 repositorios de la cuenta autenticada y elegir dónde clonarlos. Para otros repositorios accesibles desde tu CLI, cloná con `gh repo clone owner/repo` y abrí la carpeta. Cada instalación usa la sesión de `gh` del Mac donde se ejecuta. El ZIP y el código no incluyen la cuenta, los tokens, las cookies ni los repositorios locales de quien lo compiló. Si la persona que descarga la app no inició sesión, verá la opción de conectar **su propia cuenta**. Gitgrove no guarda ni muestra tus tokens. Fetch usa las credenciales normales de Git.

Las fotos de los autores se resuelven mediante la API de commits de GitHub usando `gh` y se muestran dentro de los nodos del grafo. La app consulta los identificadores de commits para asociar el autor con su perfil; no envía archivos ni diffs. Las imágenes se descargan de `avatars.githubusercontent.com` y se guardan localmente durante siete días. Sin conexión reutiliza las fotos guardadas; si un autor no tiene un perfil disponible, muestra sus iniciales.

## Alcance

Es un explorador visual inspirado en el flujo de GitKraken, con diseño propio. Incluye búsqueda por mensaje, autor, hash y referencias, filtros por rama, navegación a padres, ramas remotas, worktrees, stashes, tags, archivos binarios y diffs de merges contra su primer padre.

No implementa push, commits, staging, checkout, rebase, resolución de conflictos ni gestión de issues/PRs. El historial carga 300 commits inicialmente y permite cargar hasta 10.000; podés filtrar por rama para acotar repositorios grandes. La búsqueda opera sobre los commits cargados y atenúa los demás para conservar las conexiones del grafo. Los diffs grandes tienen una vista previa limitada. Los submódulos y archivos binarios muestran la información de Git, sin un visor binario especializado.

## Desarrollo

```sh
npx --yes pnpm@10.26.1 install --frozen-lockfile
npx --yes pnpm@10.26.1 desktop:dev
```

Para la vista en el navegador, `pnpm dev` escucha únicamente en `127.0.0.1`. En el navegador se ingresa la ruta local manualmente; el selector de Finder está disponible en la app.

## Verificación

```sh
npx --yes pnpm@10.26.1 lint
npx --yes pnpm@10.26.1 exec tsc --noEmit
npx --yes pnpm@10.26.1 test
npx --yes pnpm@10.26.1 exec playwright install chromium
npx --yes pnpm@10.26.1 test:e2e
node scripts/create-fixture.mjs
node scripts/smoke-desktop.mjs
```

Los tests usan repositorios aislados: ramas divergentes, merges, commit inicial, renombrados, cambios locales, archivos nuevos, enlaces simbólicos y repositorios sin commits. Las pruebas de interfaz cubren búsquedas, filtros, diffs, apertura de carpetas, preferencias y rechazo de orígenes ajenos. El smoke test abre **el ejecutable compilado** y verifica el grafo, los diffs, el puente nativo y la protección de sesión.

## Datos y arquitectura

- Interfaz: Next.js 16 + React 19. Escritorio: Electron, con aislamiento de contexto y sandbox en el renderer.
- Git se ejecuta con argumentos separados, sin interpolar comandos en una shell.
- El servidor de la app escucha en un puerto aleatorio de `127.0.0.1`, protegido con una cookie de sesión aleatoria y comprobación de origen. Termina al salir de la app.
- Datos en `~/Library/Application Support/Gitgrove/`: `repos.json`, `preferences.json`, `server.log` y la carpeta `avatars/`. Los datos de pruebas se guardan en `.context`.
- Los archivos de entorno, el código de las pruebas y los repositorios de prueba quedan fuera del paquete.
