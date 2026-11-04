import { expect, test } from "@playwright/test";
import {
  API_URL,
  createDrawing,
  deleteDrawing,
  getDrawing,
} from "./helpers/api";

test("Chinese settings persist and Chinese canvas text survives a reload", async ({
  page,
  request,
}) => {
  const drawing = await createDrawing(request, {
    name: "中文升级验证",
    elements: [],
  });
  const failedFonts: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes(".woff2") && !response.ok())
      failedFonts.push(response.url());
  });
  try {
    await page.goto("/settings");
    await page
      .getByRole("combobox", { name: "Language", exact: true })
      .selectOption("zh-CN");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByText("图片优化", { exact: true })).toBeVisible();
    await expect(
      page.getByText("上游正式版进度", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`${API_URL}/auth/preferences`)).json())
            .preferences.language,
      )
      .toBe("zh-CN");
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "语言", exact: true }),
    ).toHaveValue("zh-CN");

    await page.goto(`/editor/${drawing.id}`);
    const canvas = page.locator("canvas.excalidraw__canvas.interactive");
    await expect(canvas).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean((window as any).__EXCALIDASH_EXCALIDRAW_API__),
        ),
      )
      .toBe(true);
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas is not available");
    await page.mouse.click(box.x + 100, box.y + 100);
    await page.keyboard.press("t");
    await page.mouse.click(box.x + 300, box.y + 250);
    await expect(page.locator("textarea.excalidraw-wysiwyg")).toBeVisible();
    await page.keyboard.insertText("中文手绘测试");
    await page.keyboard.press("Escape");
    const savedText = async () =>
      (await getDrawing(request, drawing.id)).elements?.find(
        (element: any) => element.type === "text",
      )?.text;
    await expect.poll(savedText, { timeout: 15000 }).toBe("中文手绘测试");
    await page.reload();
    await expect(canvas).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__EXCALIDASH_EXCALIDRAW_API__
              ?.getSceneElements()
              .find((element: any) => element.type === "text")?.text,
        ),
      )
      .toBe("中文手绘测试");
    expect(failedFonts).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath("chinese-editor.png"),
    });
  } finally {
    await page.goto("/settings");
    await page
      .getByRole("combobox", { name: /^(Language|语言)$/ })
      .selectOption("en");
    await expect
      .poll(
        async () =>
          (await (await page.request.get(`${API_URL}/auth/preferences`)).json())
            .preferences.language,
      )
      .toBe("en");
    await deleteDrawing(request, drawing.id);
  }
});
