import React, { useLayoutEffect } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadDrawingFile } from "../src/api";
import { compressExcalidrawFiles } from "../src/utils/imageCompression";
import { useEditorFileUploads } from "../src/pages/editor/useEditorFileUploads";
vi.mock("../src/api", () => ({
  isFileUploadSupported: () => true,
  uploadDrawingFile: vi.fn(),
}));
vi.mock("../src/utils/imageCompression", () => ({
  compressExcalidrawFiles: vi.fn(),
}));
const ref = <T,>(current: T) => ({ current });
const files = {
  image: {
    id: "image",
    dataURL: "data:image/png;base64,aW1hZ2U=",
    mimeType: "image/png",
  },
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
let renderer: ReactTestRenderer | undefined;
const harness = () => {
  const editor = { getFiles: () => files, addFiles: vi.fn() };
  const refs = {
    excalidrawAPI: ref(editor),
    isSyncing: ref(false),
    latestFiles: ref<any>(files),
    uploadedRefs: ref<Record<string, string>>({}),
  };
  let uploads!: ReturnType<typeof useEditorFileUploads>;
  function Harness({ drawingId = "drawing" }: { drawingId?: string }) {
    const next = useEditorFileUploads({
      ...refs,
      drawingId,
      canEdit: true,
      isReady: false,
    });
    useLayoutEffect(() => {
      uploads = next;
    });
    return null;
  }
  return {
    refs,
    editor,
    Harness,
    get uploads() {
      return uploads;
    },
  };
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(compressExcalidrawFiles).mockResolvedValue({
    files,
    changed: false,
  });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
});
describe("drawing-scoped uploads", () => {
  it("clears stored refs on drawing changes and ignores completion of an old drawing's upload", async () => {
    const h = harness();
    await act(async () => {
      renderer = create(<h.Harness />);
    });
    const response = deferred<any>();
    vi.mocked(uploadDrawingFile).mockReturnValueOnce(response.promise);
    const upload = h.uploads.scanNow();
    await act(async () => {});
    h.refs.uploadedRefs.current.existing = "/api/files/drawing/existing";
    await act(async () => {
      renderer!.update(<h.Harness drawingId="other" />);
    });
    expect(h.refs.uploadedRefs.current).toEqual({});
    response.resolve({ url: "/api/files/drawing/image" });
    await act(async () => {
      await upload;
    });
    expect(h.refs.uploadedRefs.current).toEqual({});
  });
  it("does not apply an old compression result to a different drawing", async () => {
    const h = harness();
    await act(async () => {
      renderer = create(<h.Harness />);
    });
    const compressed = deferred<any>();
    vi.mocked(compressExcalidrawFiles).mockReturnValueOnce(compressed.promise);
    const upload = h.uploads.scanNow();
    await act(async () => {
      renderer!.update(<h.Harness drawingId="other" />);
    });
    const other = { other: { id: "other", dataURL: "data:other" } };
    h.refs.latestFiles.current = other;
    compressed.resolve({ files, changed: true });
    await act(async () => {
      await upload;
    });
    expect(h.refs.latestFiles.current).toEqual(other);
    expect(h.editor.addFiles).not.toHaveBeenCalled();
    expect(uploadDrawingFile).not.toHaveBeenCalled();
  });
});
