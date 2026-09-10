import { test, expect } from "@playwright/test";
import path from "node:path";
const fixture = path.resolve(".context/fixtures/constellation");
test.beforeEach(async ({ page }) => {
  await page.addInitScript((fixturePath) => {
    localStorage.setItem(
      "gitgrove-tabs",
      JSON.stringify([{ path: fixturePath, name: "constellation" }]),
    );
    localStorage.setItem("gitgrove-active", fixturePath);
    localStorage.setItem("gitgrove-auto", "false");
  }, fixture);
  await page.goto("/");
  await expect(page.locator(".commit-row").first()).toBeVisible();
});
test("shows real graph, searches, filters branches, and restores all branches", async ({
  page,
}) => {
  await expect(page.locator(".repo-breadcrumb")).toContainText("constellation");
  await expect(page.locator(".graph-cell")).toHaveCount(26);
  await page.getByRole("textbox", { name: "Buscar commits" }).fill("sidebar");
  await expect(page.locator(".search-count")).toContainText("resultados");
  await expect(page.locator(".commit-row.match")).not.toHaveCount(0);
  await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
  await page.getByLabel("Rama del historial").selectOption("feature/sidebar");
  await expect(page.locator(".graph-cell")).toHaveCount(8);
  await page.getByRole("button", { name: "Quitar filtro" }).click();
  await expect(page.locator(".graph-cell")).toHaveCount(26);
  await page.screenshot({ path: ".context/screenshots/history.png" });
});
test("opens commit diffs and untracked working files", async ({ page }) => {
  await page
    .locator(".commit-row")
    .filter({ hasText: "fix: improve sidebar accessibility" })
    .click();
  await expect(page.locator(".details-panel .file-row")).toHaveCount(1);
  await page.locator(".details-panel .file-row").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".diff-line.added")).toContainText("aria-label");
  await page.screenshot({ path: ".context/screenshots/diff.png" });
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.locator(".working-row").click();
  await expect(page.locator(".details-panel .file-row")).toHaveCount(3);
  await page
    .locator(".details-panel .file-row")
    .filter({ hasText: "notes.md" })
    .click();
  await expect(page.locator(".diff-lines")).toContainText("Polish navigation");
});
test("opens a local repository, validates errors, and persists preferences", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Abrir repositorio (⌘O)", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByLabel("Ruta del repositorio")
    .fill("/does-not-exist/gitgrove");
  await page.getByLabel("Ruta del repositorio").press("Enter");
  await expect(page.locator(".form-error")).toBeVisible();
  await page.getByLabel("Ruta del repositorio").fill(fixture);
  await page.getByLabel("Ruta del repositorio").press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Preferencias", exact: true }).click();
  await page.getByRole("switch", { name: "Filas compactas" }).click();
  await expect(
    page.getByRole("switch", { name: "Filas compactas" }),
  ).toBeChecked();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator(".app-shell")).toHaveClass(/dense/);
});
test("rejects requests from a foreign origin and malformed actions", async ({
  request,
}) => {
  const foreign = await request.post("/api/git", {
    headers: { origin: "https://example.com" },
    data: { action: "discover" },
  });
  expect(foreign.status()).toBe(403);
  const invalid = await request.post("/api/git", {
    data: { action: "execute", command: "anything" },
  });
  expect(invalid.status()).toBe(400);
});

test("places branch names left of graph nodes, uses compact visible lanes, and connects WIP to HEAD", async ({
  page,
}) => {
  const top = page.locator(".commit-row:not(.working-row)").first();
  const label = await top.locator(".commit-references").boundingBox();
  const graph = await top.locator(".graph-cell").boundingBox();
  const message = await top.locator(".commit-message").boundingBox();
  expect(label!.x + label!.width).toBeLessThanOrEqual(graph!.x + 1);
  expect(graph!.x + graph!.width).toBeLessThanOrEqual(message!.x + 1);
  await expect(top.locator(".graph-ref-name")).toContainText("main");
  await expect(top.locator(".commit-message .ref-pill")).toHaveCount(0);
  const head = await page.locator(".working-row").getAttribute("data-parent");
  await expect(
    page.locator(`.wip-connection[data-parent="${head}"]`),
  ).toHaveCount(1);
  await expect(page.locator(".branch-join")).not.toHaveCount(0);
});
