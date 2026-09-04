import { expect, test } from "@playwright/test";

test("home can navigate to Scenes page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Start Exploring" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect(page.getByRole("heading", { name: "Scenes" })).toBeVisible();

  const focusCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Focus Fundamentals — Two Targets" }) });
  const architectureCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) });

  await expect(focusCard).toBeVisible();
  await expect(architectureCard).toBeVisible();

  await expect(architectureCard.getByRole("link", { name: "Open Scene" })).toBeVisible();
});

test("home hero uses the approved artwork, semantic copy, and one catalog CTA", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Shape Perspective. Place Focus.", level: 1 })).toBeVisible();
  await expect(page.locator(".landing-hero__title-line")).toHaveCount(2);
  await expect(
    page.getByText(
      "Explore how rise, shift, tilt, swing, and focus reshape perspective, composition, and the plane of focus.",
    ),
  ).toBeVisible();
  await expect(page.locator('.landing-hero__artwork img')).toHaveAttribute("src", /assets\/landing\/hero\.png/);
  await expect(page.locator(".landing-hero a")).toHaveCount(1);
  await expect(page.locator(".landing-hero a")).toHaveAttribute("href", "/scenes");
  await expect(page.getByText(/See How It Works|Watch Video/)).toHaveCount(0);
});

test("tablet menu is keyboard accessible and mobile hero remains catalog-oriented", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/");

  const menuButton = page.getByRole("button", { name: "Open navigation menu" });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Close navigation menu" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("link", { name: "Home", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeFocused();

  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();
  await expect(page.locator(".landing-hero__title-line")).toHaveCount(2);
  const tabletOverflowWidth = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(tabletOverflowWidth).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Explore Scenes" })).toHaveAttribute("href", "/scenes");
  await expect(page.locator(".landing-hero a")).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Shape Perspective. Place Focus.", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore the Simulator" })).toHaveCount(0);
});

test("Hero locale switching keeps the two-line composition and mobile catalog action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await page.locator(".language-selector select").selectOption("zh-HK");
  await expect(page.getByRole("heading", { name: "掌控透視感 定位焦平面", level: 1 })).toBeVisible();
  await expect(page.locator(".landing-hero__title-line")).toHaveCount(2);
  await expect(
    page.getByText("親手操作上移、橫移、傾斜、擺動與對焦，看見它們如何改變透視、構圖與焦平面。"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "瀏覽場景" })).toHaveAttribute("href", "/scenes");
  await expect(page.locator(".landing-hero a")).toHaveCount(1);

  const overflowWidth = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflowWidth).toBeLessThanOrEqual(2);
});

test("FAQ disclosures are keyboard accessible from the public page", async ({ page }) => {
  await page.goto("/");

  const faqNav = page.getByRole("link", { name: "FAQ", exact: true });
  await expect(faqNav).toHaveAttribute("href", "/faq");
  await faqNav.click();
  await expect(page).toHaveURL(/\/faq$/);
  await expect(faqNav).toHaveClass(/site-nav__link--active/);

  const faq = page.getByTestId("faq-section");
  const summaries = faq.locator("summary");
  const questions = [
    "Who is View Camera Simulator for?",
    "Do I need to own a large-format camera?",
    "What can I learn with View Camera Simulator?",
    "Is the simulator based on a specific type of view camera, camera, or lens?",
    "Will every movement shown be available on my camera?",
    "How realistic is the simulator?",
    "Is it a replacement for learning with a real view camera?",
  ];

  await expect(page.getByRole("heading", { name: "Frequently Asked Questions", level: 1 })).toBeVisible();
  await expect(summaries).toHaveCount(7);
  for (const [index, question] of questions.entries()) {
    await expect(summaries.nth(index).locator(".faq-item__question-text")).toHaveText(question);
  }

  const firstSummary = summaries.first();
  const firstDetails = faq.locator("details").first();
  await firstSummary.focus();
  await expect(firstSummary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(firstDetails).toHaveAttribute("open", "");
  await page.keyboard.press("Space");
  await expect(firstDetails).not.toHaveAttribute("open");
});
