import { cp, mkdir, writeFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { version } = JSON.parse(await readFile("package.json", "utf8"));
await mkdir("build/desktop", { recursive: true });
await cp("electron", "build/desktop", { recursive: true });
await writeFile(
  "build/desktop/package.json",
  JSON.stringify(
    {
      name: "gitgrove",
      version,
      description: "Tu código, con perspectiva.",
      author: "Gitgrove",
      main: "main.cjs",
      dependencies: {},
    },
    null,
    2,
  ),
);
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
await cp("public", ".next/standalone/public", { recursive: true });
const svg = await readFile("public/icon.svg");
await mkdir("build/Gitgrove.iconset", { recursive: true });
for (const size of [16, 32, 128, 256, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`build/Gitgrove.iconset/icon_${size}x${size}.png`);
  await sharp(svg)
    .resize(size * 2, size * 2)
    .png()
    .toFile(`build/Gitgrove.iconset/icon_${size}x${size}@2x.png`);
}
execFileSync("iconutil", [
  "-c",
  "icns",
  "build/Gitgrove.iconset",
  "-o",
  "build/icon.icns",
]);
console.log("Desktop resources and app icon ready.");
