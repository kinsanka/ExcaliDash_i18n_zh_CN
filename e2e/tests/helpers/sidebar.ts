import { expect, type Page } from "@playwright/test";

export const openAccountMenu = async (page: Page) => {
  const toggle = page.getByRole("button", {
    name: "Account menu",
    exact: true,
  });
  // Navigation can finish before React mounts the sidebar. Wait for either
  // footer layout before deciding whether the compact menu needs opening.
  await expect(
    toggle.or(page.getByRole("button", { name: /^Trash$/ })).first(),
  ).toBeVisible();
  if (
    (await toggle.isVisible()) &&
    (await toggle.getAttribute("aria-expanded")) !== "true"
  ) {
    await toggle.click();
  }
};
