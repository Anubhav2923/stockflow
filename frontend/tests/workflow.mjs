import { chromium } from "playwright-core";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

export async function verifyBrowser({ origin, password }) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const web = await createServer({
    root,
    logLevel: "error",
    define: { "import.meta.env.VITE_API_ORIGIN": JSON.stringify(origin) },
    server: { host: "localhost", port: 15173, strictPort: true },
  });
  await web.listen();
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.TEST_BROWSER,
      headless: true,
    });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:15173");
    await page.getByLabel("Username").fill("tester");
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByText("Live updates", { exact: true }).waitFor();
    await page.getByRole("link", { name: "Open simulator" }).click();
    await page.getByLabel("Simulation mode").selectOption("purchase");
    await page.getByRole("button", { name: "Run simulation" }).click();
    await page.waitForFunction(
      () => document.querySelectorAll("tbody tr .badge.purchase").length === 6,
    );
    await page.getByLabel("Quantity", { exact: true }).fill("1");
    await page.getByLabel("Unit price").fill("108.0123");
    await page.getByRole("button", { name: "Submit event" }).click();
    await page.waitForFunction(
      () => document.querySelectorAll("tbody tr .badge.purchase").length === 7,
    );
    await page.getByRole("link", { name: "View ledger" }).click();
    assert.equal(await page.locator("tbody tr").count(), 16);
    await page.getByRole("link", { name: "Dashboard", exact: true }).click();
    await page.getByRole("heading", { name: "Recent transactions" }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("link", { name: "Inventory", exact: true }).click();
    await page.getByText("Fixture notebook", { exact: true }).click();
    await page.getByText("Original units", { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "Browser verified login, live updates, automatic and manual simulation, ledger, dashboard and mobile batch view",
    );
  } finally {
    await browser?.close();
    await web.close();
  }
}
