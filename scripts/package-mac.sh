#!/bin/bash
# Build the checked-out version without requiring a global pnpm installation.
set -euo pipefail

case "${1:-}" in
  --help|-h)
    cat <<'USAGE'
Uso: bash scripts/package-mac.sh [--open]

Verifica los requisitos, instala las dependencias fijadas en el lockfile
con pnpm 10.26.1 y genera Gitgrove.app + su ZIP para Apple Silicon.
--open abre la app compilada al terminar. No reemplaza una app instalada.

Requiere macOS 13+, Apple Silicon, Node.js 22.20+ (arm64), npm y las
Command Line Tools de Apple (xcode-select --install).
USAGE
    exit 0
    ;;
  ""|--open) ;;
  *) echo 'Opción desconocida. Usá --help para ver las opciones.' >&2; exit 2 ;;
esac

fail() { echo "Error: $*" >&2; exit 1; }
[[ "$(uname -s)" == Darwin ]] || fail 'Este paquete se compila en macOS.'
[[ "$(uname -m)" == arm64 ]] || fail 'Esta versión es para Apple Silicon. En un Mac M1 o posterior, abrí Terminal sin Rosetta.'
[[ "$(sw_vers -productVersion | cut -d. -f1)" -ge 13 ]] || fail 'Necesitás macOS 13 Ventura o posterior.'
command -v node >/dev/null 2>&1 || fail 'Instalá Node.js 22.20 o posterior desde https://nodejs.org/en/download/.'
command -v npx >/dev/null 2>&1 || fail 'Falta npm/npx. Reinstalá Node.js incluyendo npm.'
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 20) ? 0 : 1)' || fail 'Necesitás Node.js 22.20 o posterior.'
[[ "$(node -p 'process.arch')" == arm64 ]] || fail 'Instalá la versión arm64 de Node.js; la versión Intel no sirve para este paquete.'
xcode-select -p >/dev/null 2>&1 || fail 'Ejecutá xcode-select --install, completá la instalación y volvé a correr este comando.'
for tool in git iconutil codesign; do
  command -v "$tool" >/dev/null 2>&1 || fail "No se encontró $tool. Revisá la instalación de las herramientas de Apple."
done

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$script_directory/.."
version="$(node -p 'require("./package.json").version')"

printf '\n[1/2] Instalando dependencias con pnpm 10.26.1…\n'
npx --yes pnpm@10.26.1 install --frozen-lockfile
printf '\n[2/2] Compilando y empaquetando Gitgrove %s…\n' "$version"
npx --yes pnpm@10.26.1 desktop:build

app_path="$PWD/release/mac-arm64/Gitgrove.app"
zip_path="$PWD/release/Gitgrove-$version-mac-arm64.zip"
[[ -d "$app_path" && -f "$zip_path" ]] || fail 'La compilación no generó todos los archivos esperados.'
codesign --verify --deep --strict "$app_path"
printf '\nListo. App: %s\nZIP: %s\n\nPodés copiar Gitgrove.app a Aplicaciones y cerrar Terminal.\n' "$app_path" "$zip_path"
if [[ "${1:-}" == --open ]]; then
  open "$app_path"
fi
