import { expect, test } from "@playwright/test";

test("home can navigate to Scenes page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Explore the Simulator" }).click();
  await expect(page).toHaveURL(/\/scenes$/);
  await expect(page.getByRole("heading", { name: "Scenes" })).toBeVisible();

  const focusCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Focus Fundamentals — Two Targets" }) });
  const architectureCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Architecture Rise" }) });

  await expect(focusCard).toBeVisible();
  await expect(architectureCard).toBeVisible();

  await expect(architectureCard.getByRole("link", { name: "Open Scene" })).toBeVisible();
});

test("FAQ disclosures are keyboard accessible from the public page", async ({ page }) => {
  await page.goto("/");

  const faqNav = page.getByRole("link", { name: "FAQ", exact: true });
  await expect(faqNav).toHaveAttribute("href", "/faq");
  await faqNav.click();
  await expect(page).toHaveURL(/\/faq$/);

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
    await expect(summaries.nth(index)).toHaveText(question);
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
