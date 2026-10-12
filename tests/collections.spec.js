// Collections shown as a timeline, a wall of photos, or a table.
const { test, expect, openApp } = require("./fixtures");

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("a collection as a Table with totals, as Photos; the choice is remembered", async ({ page }) => {
  await openApp(page);
  await page.click("#empty-example-btn");
  await expect(page.locator(".gp-entry")).toHaveCount(4);
  await page.click('#gp-views [data-view="table"]');
  const table = page.locator("#gp-table");
  await expect(table.locator("tbody tr")).toHaveCount(4);
  await expect(table.locator("tfoot")).toContainText("4 entries");
  await expect(table.locator("tfoot")).toContainText("₹3,470");
  const heads = await table.locator("thead th").allInnerTexts();
  expect(heads.slice(0, 3)).toEqual(["Date", "What", "Section"]);
  expect(heads[heads.length - 1]).toBe("Amount");
  await table.locator("tbody tr", { hasText: "Train to Mysore" }).click();
  await expect(page.locator(".gp-detail")).toBeVisible();
  await page.click("#gp-table-copy");
  await expect(page.locator(".toast-item").last()).toContainText("Copied 4 rows");
  const tsv = await page.evaluate(() => navigator.clipboard.readText());
  expect(tsv.split("\n")[0]).toMatch(/^Date\tWhat\tSection/);
  expect(tsv).toContain("Train to Mysore");
  await page.reload();
  await page.locator("#sidebar").getByText("Example trip").first().click();
  await expect(page.locator("#gp-table tbody tr")).toHaveCount(4); // remembered
  await page.click('#gp-views [data-view="photos"]');
  await expect(page.locator("#gp-timeline")).toContainText("No photos yet");
  await page.click('#gp-views [data-view="timeline"]');
  await expect(page.locator(".gp-entry")).toHaveCount(4);
});
