import { _electron as electron } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const fixture = path.resolve(".context/fixtures/constellation");
const dataDir = path.resolve(".context/desktop-smoke");
await mkdir(dataDir, { recursive: true });
await writeFile(
  path.join(dataDir, "preferences.json"),
  JSON.stringify({
    tabs: [{ path: fixture, name: "constellation" }],
    active: fixture,
    dense: false,
    autoRefresh: false,
  }),
);
await writeFile(
  path.join(dataDir, "repos.json"),
  JSON.stringify([{ path: fixture, name: "constellation" }]),
);
const appPath =
  process.env.GITGROVE_APP_PATH ||
  path.resolve("release/mac-arm64/Gitgrove.app/Contents/MacOS/Gitgrove");
const instance = await electron.launch({
  executablePath: appPath,
  env: { ...process.env, GITGROVE_TEST_DATA_DIR: dataDir },
  timeout: 45000,
});
try {
  const page = await instance.firstWindow({ timeout: 45000 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.locator(".graph-cell").first().waitFor({ timeout: 45000 });
  assert.equal(await page.locator(".graph-cell").count(), 26);
  assert.equal(await page.evaluate(() => window.desktop.platform), "darwin");
  await page.locator(".working-row").click();
  await page
    .locator(".details-panel .file-row")
    .filter({ hasText: "notes.md" })
    .click();
  await page.locator(".diff-line.added").first().waitFor();
  assert.match(
    await page.locator(".diff-lines").innerText(),
    /Polish navigation/,
  );
  await page.keyboard.press("Escape");
  const unauthorized = await fetch(new URL("/api/git", page.url()), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "discover" }),
  });
  assert.equal(unauthorized.status, 401);
  await page.getByRole("button", { name: "Preferencias", exact: true }).click();
  await page.getByRole("switch", { name: "Filas compactas" }).click();
  await page.waitForFunction(
    async () => (await window.desktop.getPreferences())?.dense === true,
  );
  await page.keyboard.press("Escape");
  await page
    .locator(".commit-row")
    .filter({ hasText: "fix: improve sidebar accessibility" })
    .click();
  await page.screenshot({ path: ".context/screenshots/desktop.png" });
  assert.deepEqual(errors, []);
  console.log(
    "Packaged macOS app: graph, native bridge, local diffs, session protection, and renderer passed.",
  );
} finally {
  await instance.close();
}

const restarted = await electron.launch({
  executablePath: appPath,
  env: { ...process.env, GITGROVE_TEST_DATA_DIR: dataDir },
  timeout: 45000,
});
try {
  const page = await restarted.firstWindow({ timeout: 45000 });
  await page.locator(".graph-cell").first().waitFor({ timeout: 45000 });
  assert.equal(await page.locator(".app-shell.dense").count(), 1);
  assert.equal(
    (await page.evaluate(() => window.desktop.getPreferences())).active,
    fixture,
  );
  console.log(
    "Packaged macOS app: preferences and repository tabs persisted across relaunch.",
  );
} finally {
  await restarted.close();
}
