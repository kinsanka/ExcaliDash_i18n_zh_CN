import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rehydrateFilesForExport } from "../../../frontend/src/utils/rehydrateFiles";

// Exercise the production fetch/Blob path in Node; only the browser's
// FileReader adapter is replaced. No DOM or browser automation is needed.
class NodeFileReader {
  result: string | null = null;
  onload?: () => void;

  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((bytes) => {
      this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`;
      this.onload?.();
    });
  }
}

const image = (dataURL: string) => ({
  id: "image",
  mimeType: "image/png",
  created: 123,
  dataURL,
});
const imageResponse = (type = "image/png") =>
  new Response("exported image bytes", {
    headers: { "Content-Type": type },
  });
const embeddedUrl = `data:image/png;base64,${Buffer.from("exported image bytes").toString("base64")}`;

describe("portable frontend image exports", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("FileReader", NodeFileReader);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "https://external.example/imported.png",
    "http://legacy.example/image.png",
  ])(
    "bundles an unmanaged external image from %s after a managed miss",
    async (url) => {
      const files = { image: image(url) };
      fetchMock
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(imageResponse("application/octet-stream"));

      const result = await rehydrateFilesForExport(files, "drawing");

      expect(result.image).toEqual({ ...files.image, dataURL: embeddedUrl });
      expect(files.image.dataURL).toBe(url);
      expect(fetchMock.mock.calls).toEqual([
        ["/api/files/drawing/image", { credentials: "same-origin" }],
        [url, { credentials: "same-origin" }],
      ]);
    },
  );

  it.each([
    "/api/files/old-drawing/image",
    "https://cdn.example/public-s3/image.png",
  ])(
    "resolves managed reference %s through the current drawing endpoint",
    async (url) => {
      fetchMock.mockResolvedValueOnce(imageResponse());

      const result = await rehydrateFilesForExport(
        { image: image(url) },
        "drawing",
      );

      expect(result.image.dataURL).toBe(embeddedUrl);
      expect(fetchMock.mock.calls).toEqual([
        ["/api/files/drawing/image", { credentials: "same-origin" }],
      ]);
    },
  );

  it("keeps legacy inline files unchanged without fetching", async () => {
    const files = { image: image("data:image/png;base64,aGVsbG8=") };
    expect(await rehydrateFilesForExport(files, "drawing")).toEqual(files);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500])(
    "does not fall back after managed status %i",
    async (status) => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status }));
      await expect(
        rehydrateFilesForExport(
          { image: image("https://cdn.example/image.png") },
          "drawing",
        ),
      ).rejects.toThrow("Could not bundle 1 drawing image(s): image");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it("does not fall back after a managed network error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network error"));
    await expect(
      rehydrateFilesForExport(
        { image: image("https://cdn.example/image.png") },
        "drawing",
      ),
    ).rejects.toThrow("Could not bundle 1 drawing image(s): image");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects missing explicit managed references without fetching the old drawing", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await expect(
      rehydrateFilesForExport(
        { image: image("/api/files/old-drawing/image") },
        "drawing",
      ),
    ).rejects.toThrow("Could not bundle 1 drawing image(s): image");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects the whole export when an external fallback fails, retaining its source", async () => {
    const files = {
      image: image("https://external.example/missing.png"),
      inline: image("data:image/png;base64,aGVsbG8="),
    };
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockRejectedValueOnce(new TypeError("CORS failure"));
    await expect(rehydrateFilesForExport(files, "drawing")).rejects.toThrow(
      "Could not bundle 1 drawing image(s): image",
    );
    expect(files.image.dataURL).toBe("https://external.example/missing.png");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
