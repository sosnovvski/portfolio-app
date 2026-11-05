import { expect, test } from "@playwright/test";
import { logIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("a wrong password is refused and says so", async ({ page }) => {
  await logIn(page, "not-the-password");
  await expect(page.getByRole("alert").first()).toContainText("Wrong username or password");
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
});

test("the admin API refuses anonymous requests with problem JSON", async ({ request }) => {
  const response = await request.get("/api/admin/profile");
  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).toContain("application/problem+json");
});

test("the GitHub link appears only after it is set in the panel", async ({ page, context }) => {
  const visitor = await context.newPage();
  await visitor.goto("/en");
  await expect(visitor.getByRole("link", { name: "GitHub", exact: true })).toHaveCount(0);

  await logIn(page);
  await page.getByLabel("GitHub address").fill("https://example.test/test-person");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  await visitor.reload();
  await expect(visitor.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute(
    "href",
    "https://example.test/test-person",
  );
});

test("an edited role shows on the public page at the next load, in both languages", async ({ page }) => {
  await logIn(page);
  await page.goto("/admin#experiences");
  await page.getByRole("button", { name: "Edit Fixture Engineer" }).click();
  await page.getByLabel("Role, English").fill("Edited Engineer");
  await page.getByLabel("Role, Polish").fill("Inżynier po edycji");
  await page.getByRole("button", { name: "Save experience" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

  const visitor = await page.context().newPage();
  await visitor.goto("/en");
  await expect(visitor.locator("main")).toContainText("Edited Engineer");
  await visitor.goto("/pl");
  await expect(visitor.locator("main")).toContainText("Inżynier po edycji");
});

test("a stale edit gets a conflict and keeps what was typed", async ({ page, context }) => {
  await logIn(page);
  await page.goto("/admin#experiences");
  await page.getByRole("button", { name: "Edit Lead Fixture Engineer" }).click();

  const other = await context.newPage();
  await other.goto("/admin#experiences");
  await other.getByRole("button", { name: "Edit Lead Fixture Engineer" }).click();
  await other.getByLabel("Client").fill("Changed in another tab");
  await other.getByRole("button", { name: "Save experience" }).click();
  await expect(other.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
  await other.close();

  await page.getByLabel("Client").fill("Typed in the stale tab");
  await page.getByRole("button", { name: "Save experience" }).click();

  await expect(page.getByRole("alert").filter({ hasText: /changed/i }).first()).toBeVisible();
  await expect(page.getByLabel("Client")).toHaveValue("Typed in the stale tab");
});

test("a validation error from the server lands on its field", async ({ page }) => {
  await logIn(page);
  await page.goto("/admin#experiences");
  await page.getByRole("button", { name: "New experience" }).click();
  await page.getByLabel("Role, English").fill("Bad dates");
  await page.getByLabel("Role, Polish").fill("Złe daty");
  await page.getByLabel("Employer").fill("Bad Dates Co");
  await page.getByLabel("Start month").fill("2021-05");
  await page.getByLabel("End month").fill("2021-01");
  await page.getByRole("button", { name: "Save experience" }).click();

  const end = page.getByLabel("End month");
  await expect(end).toHaveAttribute("aria-invalid", "true");
  await expect(end).toBeFocused();
});

test("a contact message reaches the inbox, and the admin can reply and delete it", async ({ page, context }) => {
  const visitor = await context.newPage();
  await visitor.goto("/en");
  await visitor.getByLabel("Name").fill("Ada Visitor");
  await visitor.getByLabel("Email").fill("ada@example.test");
  await visitor.getByLabel("Message").fill("Hello from the browser test.");
  await visitor.getByRole("button", { name: "Send message" }).click();
  await expect(visitor.getByRole("status").filter({ hasText: "Message sent" })).toBeVisible();
  await visitor.close();

  await logIn(page);
  await page.goto("/admin#messages");
  await expect(page.locator("[data-screen=messages]")).toContainText("Hello from the browser test.");
  await page.getByRole("button", { name: "Mark as read: message from Ada Visitor" }).click();
  await expect(page.getByRole("button", { name: "Mark as unread: message from Ada Visitor" })).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete: message from Ada Visitor" }).click();
  await expect(page.locator("[data-screen=messages]")).not.toContainText("Hello from the browser test.");
});

test("a filled honeypot looks like success and reaches nobody", async ({ page, request }) => {
  const response = await request.post("/api/public/contact", {
    data: {
      name: "Bot",
      email: "bot@example.test",
      message: "Buy things right now.",
      locale: "en",
      contactRef: "https://spam.test",
    },
  });
  expect(response.status()).toBe(202);

  await logIn(page);
  await page.goto("/admin#messages");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-screen=messages]")).not.toContainText("Buy things right now.");
});

test("leaving the panel with an unsaved draft asks first, and declining keeps the draft", async ({ page }) => {
  await logIn(page);
  await page.getByLabel("Full name").fill("Unsaved draft");

  page.once("dialog", (dialog) => void dialog.dismiss());
  await page.getByRole("button", { name: "Log out" }).click();

  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
  await expect(page.getByLabel("Full name")).toHaveValue("Unsaved draft");

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByLabel("Username")).toBeVisible();
});

test("logging out ends the session", async ({ page }) => {
  await logIn(page);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByLabel("Username")).toBeVisible();

  const response = await page.request.get("/api/admin/profile");
  expect(response.status()).toBe(401);
});
