import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const port = process.env.PORT || "3417";
const server = spawn(
  "pnpm",
  ["exec", "next", "dev", "--hostname", "127.0.0.1", "--port", port],
  { stdio: "inherit" },
);
let desktop;
const cleanup = () => {
  desktop?.kill();
  server.kill();
};
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
for (let i = 0; i < 150; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${port}`)).ok) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 200));
}
desktop = spawn(require("electron"), ["."], {
  stdio: "inherit",
  env: { ...process.env, ELECTRON_DEV_URL: `http://127.0.0.1:${port}` },
});
desktop.on("exit", () => {
  server.kill();
  process.exit();
});
