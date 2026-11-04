import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import {
  createExcalidashArchiveWithDuplicateDrawingIds,
  createExcalidashArchiveWithLargeDrawing,
  createLegacySqliteDb,
  createLegacySqliteDbWithDuplicateDrawingIds,
  createTempDir,
  openWritableDb,
} from "./importsCompatFixtures";
import { getTestPrisma, setupTestDb, cleanupTestDb } from "./testUtils";
import { BOOTSTRAP_USER_ID } from "../auth/authMode";
import { downloadBuffer } from "../s3";
import { decodeSnapshotField } from "../snapshots/snapshotCodec";
import { replaceImportedDrawing } from "../routes/importExport/shared";
import { internDrawingFiles } from "../fileProcessing";

vi.mock("../s3", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../s3")>()),
  downloadBuffer: vi.fn(),
}));

vi.mock("../fileProcessing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../fileProcessing")>();
  return { ...actual, internDrawingFiles: vi.fn(actual.internDrawingFiles) };
});

describe("Import compatibility (legacy exports)", () => {
  const uploadsDir = path.resolve(__dirname, "../../uploads");
  const userAgent = "vitest-import-compat";
  let prisma: ReturnType<typeof getTestPrisma>;
  let app: any;
  let agent: any;
  let csrfHeaderName: string;
  let csrfToken: string;

  beforeAll(async () => {
    setupTestDb();
    prisma = getTestPrisma();
    fs.mkdirSync(uploadsDir, { recursive: true });

    ({ app } = await import("../index"));

    agent = request.agent(app);
    const csrfRes = await agent.get("/csrf-token").set("User-Agent", userAgent);
    csrfHeaderName = csrfRes.body.header;
    csrfToken = csrfRes.body.token;
    expect(typeof csrfHeaderName).toBe("string");
    expect(typeof csrfToken).toBe("string");
  });

  beforeEach(async () => {
    await cleanupTestDb(prisma);
    await prisma.drawingFile.deleteMany({});
    vi.mocked(downloadBuffer).mockReset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("verifies a v0.1.x–v0.3.2-style SQLite export (Drawing/Collection tables) and returns migration info when present", async () => {
    const legacyDb = createLegacySqliteDb({
      tableStyle: "prisma",
      includeCollections: true,
      includeMigrationsTable: true,
      includeTrashDrawing: false,
    });

    const res = await agent
      .post("/import/sqlite/legacy/verify")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("db", legacyDb);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.drawings).toBe(2);
    expect(res.body.collections).toBe(1);
    expect(res.body.latestMigration).toBe("20240104000000_initial");
    expect(res.body.currentLatestMigration).toMatch(/^\d{14}_.+/);
  });

  it("merge-imports a legacy SQLite export into the current account without replacing the database", async () => {
    const legacyDb = createLegacySqliteDb({
      tableStyle: "prisma",
      includeCollections: true,
      includeMigrationsTable: false,
      includeTrashDrawing: true,
    });

    const res = await agent
      .post("/import/sqlite/legacy")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("db", legacyDb);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.collections?.created).toBeGreaterThanOrEqual(1);
    expect(res.body.drawings?.created).toBeGreaterThanOrEqual(3);

    const importedDrawings = await prisma.drawing.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, collectionId: true, userId: true },
    });

    expect(importedDrawings.every((d) => d.userId === BOOTSTRAP_USER_ID)).toBe(
      true,
    );
    expect(importedDrawings.map((d) => d.id)).toEqual(
      expect.arrayContaining([
        "legacy-drawing-1",
        "legacy-drawing-2",
        "legacy-drawing-trash",
      ]),
    );

    const trash = await prisma.collection.findUnique({
      where: { id: `trash:${BOOTSTRAP_USER_ID}` },
    });
    expect(trash).toBeTruthy();
  });

  it("supports older exports with plural/lowercase table names (drawings/collections)", async () => {
    const legacyDb = createLegacySqliteDb({
      tableStyle: "plural-lower",
      includeCollections: true,
      includeMigrationsTable: false,
      includeTrashDrawing: false,
    });

    const verify = await agent
      .post("/import/sqlite/legacy/verify")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("db", legacyDb);

    expect(verify.status).toBe(200);
    expect(verify.body.drawings).toBe(2);
    expect(verify.body.collections).toBe(1);

    const res = await agent
      .post("/import/sqlite/legacy")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("db", legacyDb);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("fails verification if the legacy DB is missing a Drawing table", async () => {
    const dir = createTempDir();
    const filePath = path.join(dir, "invalid.db");
    const db = openWritableDb(filePath);
    db.exec(`CREATE TABLE "NotDrawing" (id TEXT PRIMARY KEY NOT NULL);`);
    db.close();

    const res = await agent
      .post("/import/sqlite/legacy/verify")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("db", filePath);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid legacy DB");
  });

  it("rejects .excalidash verify when manifest has duplicate drawing IDs", async () => {
    const archive = await createExcalidashArchiveWithDuplicateDrawingIds();
    const res = await agent
      .post("/import/excalidash/verify")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("archive", archive);

    expect(res.status).toBe(400);
    expect(String(res.body.message || "")).toContain("Duplicate drawing id");
  });

  it("rejects .excalidash import when manifest has duplicate drawing IDs", async () => {
    const archive = await createExcalidashArchiveWithDuplicateDrawingIds();
    const res = await agent
      .post("/import/excalidash")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("archive", archive);

    expect(res.status).toBe(400);
    expect(String(res.body.message || "")).toContain("Duplicate drawing id");
  });

  it("imports a backup whose drawing JSON exceeds the former 5 MiB limit", async () => {
    const archive = await createExcalidashArchiveWithLargeDrawing();
    const res = await agent
      .post("/import/excalidash")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("archive", archive, "large-backup.excalidash");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const drawing = await prisma.drawing.findUnique({
      where: { id: "large-backup-drawing" },
    });
    expect(drawing).toBeTruthy();
    expect(JSON.parse(drawing!.files)).toHaveProperty("large-image");
  });

  it("rejects legacy verify when DB has duplicate drawing IDs", async () => {
    const legacyDb = createLegacySqliteDbWithDuplicateDrawingIds();
    const res = await agent
      .post("/import/sqlite/legacy/verify")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("db", legacyDb);

    expect(res.status).toBe(400);
    expect(String(res.body.message || "")).toContain("Duplicate drawing id");
  });

  it("rejects legacy import when DB has duplicate drawing IDs", async () => {
    const legacyDb = createLegacySqliteDbWithDuplicateDrawingIds();
    const res = await agent
      .post("/import/sqlite/legacy")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("db", legacyDb);

    expect(res.status).toBe(400);
    expect(String(res.body.message || "")).toContain("Duplicate drawing id");
  });

  const seedDrawingBeforeInvalidImport = async (id: string) => {
    await agent.get("/collections").set("User-Agent", userAgent);
    const drawing = await prisma.drawing.create({
      data: {
        id,
        name: "Keep this drawing",
        elements: JSON.stringify([
          {
            id: "saved-element",
            type: "rectangle",
            x: 1,
            y: 2,
            width: 3,
            height: 4,
          },
        ]),
        appState: JSON.stringify({ viewBackgroundColor: "#fedcba" }),
        files: JSON.stringify({
          "saved-image": {
            id: "saved-image",
            mimeType: "image/png",
            created: 123,
            dataURL: `/api/files/${id}/saved-image`,
          },
        }),
        version: 7,
        userId: BOOTSTRAP_USER_ID,
      },
    });
    await prisma.drawingFile.create({
      data: {
        drawingId: id,
        fileId: "saved-image",
        mimeType: "image/png",
        storage: "db",
        data: Buffer.from("keep saved bytes"),
        sizeBytes: 16,
      },
    });
    await prisma.drawingSnapshot.create({
      data: {
        drawingId: id,
        version: 6,
        elements: "[]",
        appState: "{}",
        files: "{}",
      },
    });
    return drawing;
  };

  it.each([
    ["missing elements", { appState: {}, files: {} }],
    ["object elements", { elements: {}, appState: {}, files: {} }],
    ["null elements", { elements: null, appState: {}, files: {} }],
    ["string appState", { elements: [], appState: "corrupt", files: {} }],
    ["array files", { elements: [], appState: {}, files: [] }],
  ])(
    "rejects backup %s without overwriting any drawings",
    async (_label, scene) => {
      const drawing = await seedDrawingBeforeInvalidImport(
        "invalid-backup-existing",
      );
      const history = await prisma.drawingSnapshot.findMany({
        where: { drawingId: drawing.id },
      });
      const zip = new JSZip();
      zip.file(
        "excalidash.manifest.json",
        JSON.stringify({
          format: "excalidash",
          formatVersion: 1,
          exportedAt: new Date().toISOString(),
          unorganizedFolder: "Unorganized",
          collections: [
            {
              id: "must-not-create",
              name: "Rejected collection",
              folder: "Rejected",
            },
          ],
          drawings: [
            {
              id: drawing.id,
              name: "Overwrite",
              collectionId: null,
              filePath: "Unorganized/invalid.excalidraw",
            },
          ],
        }),
      );
      zip.file("Unorganized/invalid.excalidraw", JSON.stringify(scene));
      const archive = await zip.generateAsync({ type: "nodebuffer" });
      const res = await agent
        .post("/import/excalidash")
        .set("User-Agent", userAgent)
        .set(csrfHeaderName, csrfToken)
        .attach("archive", archive, "invalid.excalidash");

      expect(res.status).toBe(400);
      expect(
        await prisma.drawing.findUnique({ where: { id: drawing.id } }),
      ).toEqual(drawing);
      expect(
        await prisma.collection.findUnique({
          where: { id: "must-not-create" },
        }),
      ).toBeNull();
      expect(
        await prisma.drawingSnapshot.findMany({
          where: { drawingId: drawing.id },
        }),
      ).toEqual(history);
      expect(
        (await prisma.drawingFile.findUnique({
          where: {
            drawingId_fileId: { drawingId: drawing.id, fileId: "saved-image" },
          },
        }))!.data,
      ).toEqual(Buffer.from("keep saved bytes"));
    },
  );

  it.each(["elements", "appState", "files"])(
    "rejects malformed legacy %s JSON before overwriting a same-ID drawing",
    async (field) => {
      const drawing = await seedDrawingBeforeInvalidImport("legacy-drawing-1");
      const history = await prisma.drawingSnapshot.findMany({
        where: { drawingId: drawing.id },
      });
      const legacyDb = createLegacySqliteDb({
        tableStyle: "prisma",
        includeCollections: true,
        includeMigrationsTable: false,
        includeTrashDrawing: false,
      });
      const db = openWritableDb(legacyDb);
      try {
        db.prepare(`UPDATE "Drawing" SET "${field}" = ? WHERE id = ?`).run(
          "{broken",
          drawing.id,
        );
      } finally {
        db.close();
      }
      const res = await agent
        .post("/import/sqlite/legacy")
        .set("User-Agent", userAgent)
        .set(csrfHeaderName, csrfToken)
        .attach("db", legacyDb);

      expect(res.status).toBe(400);
      expect(
        await prisma.drawing.findUnique({ where: { id: drawing.id } }),
      ).toEqual(drawing);
      expect(await prisma.drawing.count()).toBe(1);
      expect(
        await prisma.drawingSnapshot.findMany({
          where: { drawingId: drawing.id },
        }),
      ).toEqual(history);
      expect(
        (await prisma.drawingFile.findUnique({
          where: {
            drawingId_fileId: { drawingId: drawing.id, fileId: "saved-image" },
          },
        }))!.data,
      ).toEqual(Buffer.from("keep saved bytes"));
      expect(
        await prisma.collection.findUnique({
          where: { id: "legacy-collection-1" },
        }),
      ).toBeNull();
    },
  );

  it.each(["excalidash", "legacy"])(
    "preserves recoverable history and advances live version on same-ID %s import",
    async (format) => {
      const id = format === "legacy" ? "legacy-drawing-1" : "import-existing";
      const drawing = await seedDrawingBeforeInvalidImport(id);
      let pending = agent
        .post(
          format === "legacy" ? "/import/sqlite/legacy" : "/import/excalidash",
        )
        .set("User-Agent", userAgent)
        .set(csrfHeaderName, csrfToken);
      if (format === "legacy") {
        const legacyDb = createLegacySqliteDb({
          tableStyle: "prisma",
          includeCollections: true,
          includeMigrationsTable: false,
          includeTrashDrawing: false,
        });
        pending = pending.attach("db", legacyDb);
      } else {
        const zip = new JSZip();
        zip.file(
          "excalidash.manifest.json",
          JSON.stringify({
            format: "excalidash",
            formatVersion: 1,
            exportedAt: new Date().toISOString(),
            unorganizedFolder: "Unorganized",
            collections: [],
            drawings: [
              {
                id,
                name: "Restored backup",
                version: 1,
                collectionId: null,
                filePath: "Unorganized/drawing.excalidraw",
              },
            ],
          }),
        );
        zip.file(
          "Unorganized/drawing.excalidraw",
          JSON.stringify({ elements: [], appState: {}, files: {} }),
        );
        pending = pending.attach(
          "archive",
          await zip.generateAsync({ type: "nodebuffer" }),
          "valid.excalidash",
        );
      }
      const imported = await pending;
      expect(imported.status).toBe(200);
      const updated = await prisma.drawing.findUnique({ where: { id } });
      expect(updated!.version).toBe(8);
      expect(JSON.parse(updated!.elements)).toEqual([]);
      const snapshots = await prisma.drawingSnapshot.findMany({
        where: { drawingId: id },
      });
      expect(snapshots).toHaveLength(2);
      const backup = snapshots.find(
        (snapshot) => snapshot.version === drawing.version,
      )!;
      expect(backup).toBeDefined();
      expect(decodeSnapshotField(backup.elements)).toBe(drawing.elements);
      expect(decodeSnapshotField(backup.appState)).toBe(drawing.appState);
      expect(decodeSnapshotField(backup.files)).toBe(drawing.files);
      const restored = await agent
        .post(`/drawings/${id}/history/${backup.id}/restore`)
        .set("User-Agent", userAgent)
        .set(csrfHeaderName, csrfToken);
      expect(restored.status).toBe(200);
      expect(restored.body.version).toBe(9);
      expect(restored.body.elements).toEqual(JSON.parse(drawing.elements));
      expect(restored.body.files).toEqual(JSON.parse(drawing.files));
      expect(
        (await prisma.drawingFile.findUnique({
          where: {
            drawingId_fileId: { drawingId: id, fileId: "saved-image" },
          },
        }))!.data,
      ).toEqual(Buffer.from("keep saved bytes"));
    },
  );

  it("rolls back the import scene and safety snapshot if later processing fails", async () => {
    const drawing = await seedDrawingBeforeInvalidImport(
      "failed-import-existing",
    );
    await expect(
      prisma.$transaction(async (tx) => {
        await replaceImportedDrawing(tx, drawing, {
          elements: "[]",
          appState: "{}",
          files: "{}",
        });
        throw new Error("later import processing failed");
      }),
    ).rejects.toThrow("later import processing failed");
    expect(
      await prisma.drawing.findUnique({ where: { id: drawing.id } }),
    ).toEqual(drawing);
    expect(await prisma.drawingSnapshot.count()).toBe(1);
  });

  it("rolls back the safety snapshot when an import loses its version guard", async () => {
    const drawing = await seedDrawingBeforeInvalidImport(
      "conflicting-import-existing",
    );
    await expect(
      prisma.$transaction((tx) =>
        replaceImportedDrawing(
          tx,
          { ...drawing, version: drawing.version - 1 },
          { elements: "[]", files: "{}" },
        ),
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(
      await prisma.drawing.findUnique({ where: { id: drawing.id } }),
    ).toEqual(drawing);
    expect(await prisma.drawingSnapshot.count()).toBe(1);
  });

  it.each(["excalidash", "legacy"])(
    "rejects %s import if cleanup reclaims newly interned bytes before scene commit",
    async (format) => {
      const id =
        format === "legacy" ? "legacy-drawing-1" : "reclaimed-import-existing";
      const drawing = await seedDrawingBeforeInvalidImport(id);
      const files = {
        pending: {
          id: "pending",
          dataURL: "data:image/png;base64,AQID",
          mimeType: "image/png",
          created: 1,
        },
      };
      let stateAfterCleanup: typeof drawing | null = null;
      vi.mocked(internDrawingFiles).mockImplementationOnce(async (...args) => {
        const actual =
          await vi.importActual<typeof import("../fileProcessing")>(
            "../fileProcessing",
          );
        const processed = await actual.internDrawingFiles(...args);
        const trimmed = await agent
          .post(`/drawings/${id}/trim`)
          .set("User-Agent", userAgent)
          .set(csrfHeaderName, csrfToken)
          .send({ confirmName: drawing.name });
        expect(trimmed.status).toBe(200);
        expect(
          await prisma.drawingFile.findUnique({
            where: { drawingId_fileId: { drawingId: id, fileId: "pending" } },
          }),
        ).toBeNull();
        stateAfterCleanup = await prisma.drawing.findUnique({ where: { id } });
        return processed;
      });
      let pending = agent
        .post(
          format === "legacy" ? "/import/sqlite/legacy" : "/import/excalidash",
        )
        .set("User-Agent", userAgent)
        .set(csrfHeaderName, csrfToken);
      if (format === "legacy") {
        const legacyDb = createLegacySqliteDb({
          tableStyle: "prisma",
          includeCollections: true,
          includeMigrationsTable: false,
          includeTrashDrawing: false,
        });
        const db = openWritableDb(legacyDb);
        try {
          db.prepare('UPDATE "Drawing" SET files = ? WHERE id = ?').run(
            JSON.stringify(files),
            id,
          );
        } finally {
          db.close();
        }
        pending = pending.attach("db", legacyDb);
      } else {
        const zip = new JSZip();
        zip.file(
          "excalidash.manifest.json",
          JSON.stringify({
            format: "excalidash",
            formatVersion: 1,
            exportedAt: new Date().toISOString(),
            unorganizedFolder: "Unorganized",
            collections: [],
            drawings: [
              {
                id,
                name: "Imported scene",
                version: 1,
                collectionId: null,
                filePath: "Unorganized/drawing.excalidraw",
              },
            ],
          }),
        );
        zip.file(
          "Unorganized/drawing.excalidraw",
          JSON.stringify({ elements: [], appState: {}, files }),
        );
        pending = pending.attach(
          "archive",
          await zip.generateAsync({ type: "nodebuffer" }),
          "reclaimed.excalidash",
        );
      }
      const result = await pending;
      expect(result.status).toBe(409);
      expect(stateAfterCleanup).not.toBeNull();
      expect(await prisma.drawing.findUnique({ where: { id } })).toEqual(
        stateAfterCleanup,
      );
      expect(
        await prisma.drawingSnapshot.count({ where: { drawingId: id } }),
      ).toBe(1);
      if (format === "legacy") {
        expect(
          await prisma.collection.findUnique({
            where: { id: "legacy-collection-1" },
          }),
        ).toBeNull();
        expect(
          await prisma.drawing.findUnique({
            where: { id: "legacy-drawing-2" },
          }),
        ).toBeNull();
      }
    },
  );

  const downloadExport = async (): Promise<Buffer> =>
    new Promise((resolve, reject) => {
      agent
        .get("/export/excalidash")
        .set("User-Agent", userAgent)
        .buffer(true)
        .parse(
          (res: any, callback: (err: Error | null, body: Buffer) => void) => {
            const chunks: Buffer[] = [];
            res.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
            res.on("end", () => callback(null, Buffer.concat(chunks)));
            res.on("error", (err: Error) => callback(err, Buffer.alloc(0)));
          },
        )
        .end((err: Error | null, res: any) =>
          err ? reject(err) : resolve(res.body as Buffer),
        );
    });

  it("leaves excalidraw drawings byte-identical through export + re-import", async () => {
    const elements = [
      { id: "el1", type: "rectangle", x: 0, y: 0, width: 5, height: 5 },
    ];
    await prisma.drawing.create({
      data: {
        id: "excalidraw-roundtrip-1",
        name: "Sketch",
        elements: JSON.stringify(elements),
        appState: JSON.stringify({}),
        files: "{}",
        version: 1,
        userId: BOOTSTRAP_USER_ID,
      },
    });

    const buffer = await downloadExport();
    const zip = await JSZip.loadAsync(buffer);
    const manifest = JSON.parse(
      await zip.file("excalidash.manifest.json")!.async("string"),
    );
    const entry = manifest.drawings.find(
      (d: any) => d.id === "excalidraw-roundtrip-1",
    );
    expect(entry.filePath).toMatch(/\.excalidraw$/);

    const res = await agent
      .post("/import/excalidash")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("archive", buffer, "backup.excalidash");

    expect(res.status).toBe(200);

    const row = await prisma.drawing.findUnique({
      where: { id: "excalidraw-roundtrip-1" },
    });
    expect(JSON.parse(row!.elements)).toEqual(elements);
  });

  it("exports managed image references as portable inline data URLs", async () => {
    const imageBytes = Buffer.from("portable backup image");
    await prisma.drawing.create({
      data: {
        id: "portable-image-export",
        name: "Portable image",
        elements: "[]",
        appState: "{}",
        files: JSON.stringify({
          image: {
            id: "image",
            mimeType: "image/png",
            dataURL: "/api/files/portable-image-export/image",
            created: 123,
          },
        }),
        version: 1,
        userId: BOOTSTRAP_USER_ID,
      },
    });
    await prisma.drawingFile.create({
      data: {
        drawingId: "portable-image-export",
        fileId: "image",
        mimeType: "image/png",
        sizeBytes: imageBytes.length,
        storage: "db",
        data: imageBytes,
      },
    });

    const zip = await JSZip.loadAsync(await downloadExport());
    const manifest = JSON.parse(
      await zip.file("excalidash.manifest.json")!.async("string"),
    );
    const entry = manifest.drawings.find(
      (drawing: any) => drawing.id === "portable-image-export",
    );
    const exportedDrawing = JSON.parse(
      await zip.file(entry.filePath)!.async("string"),
    );

    expect(exportedDrawing.files.image).toMatchObject({
      id: "image",
      mimeType: "image/png",
      dataURL: `data:image/png;base64,${imageBytes.toString("base64")}`,
      created: 123,
    });
  });

  const createBackupImageDrawing = async (files: Record<string, unknown>) =>
    prisma.drawing.create({
      data: {
        id: "backup-images",
        name: "Backup images",
        elements: JSON.stringify([
          { id: "external-element", type: "image", fileId: "external" },
          { id: "managed-element", type: "image", fileId: "managed" },
        ]),
        appState: "{}",
        files: JSON.stringify(files),
        userId: BOOTSTRAP_USER_ID,
      },
    });

  it("round-trips unmanaged HTTP(S) references alongside bundled managed images", async () => {
    const externalUrls = {
      external: "https://external.example/imported.png?version=1",
      legacy: "http://legacy.example/image.png",
    };
    const externalFiles = Object.fromEntries(
      Object.entries(externalUrls).map(([id, dataURL]) => [
        id,
        { id, mimeType: "image/png", dataURL, created: 123 },
      ]),
    );
    const imageBytes = Buffer.from("round-trip managed image");
    const drawing = await createBackupImageDrawing({
      ...externalFiles,
      managed: {
        id: "managed",
        mimeType: "image/png",
        dataURL: "https://cdn.example/managed.png",
      },
    });
    await prisma.drawingFile.create({
      data: {
        drawingId: drawing.id,
        fileId: "managed",
        mimeType: "image/png",
        sizeBytes: imageBytes.length,
        storage: "db",
        data: imageBytes,
      },
    });

    const buffer = await downloadExport();
    const zip = await JSZip.loadAsync(buffer);
    const manifest = JSON.parse(
      await zip.file("excalidash.manifest.json")!.async("string"),
    );
    const exported = JSON.parse(
      await zip.file(manifest.drawings[0].filePath)!.async("string"),
    );
    expect(exported.files).toMatchObject(externalFiles);
    expect(exported.files.managed.dataURL).toBe(
      `data:image/png;base64,${imageBytes.toString("base64")}`,
    );
    expect(exported.elements).toEqual(JSON.parse(drawing.elements));
    expect(downloadBuffer).not.toHaveBeenCalled();

    // Restore into an empty account so this exercises creation and interning.
    await cleanupTestDb(prisma);
    await prisma.drawingFile.deleteMany({});
    const imported = await agent
      .post("/import/excalidash")
      .set("User-Agent", userAgent)
      .set(csrfHeaderName, csrfToken)
      .attach("archive", buffer, "backup.excalidash");
    expect(imported.status).toBe(200);
    const restored = await prisma.drawing.findUniqueOrThrow({
      where: { id: drawing.id },
    });
    for (const [fileId, dataURL] of Object.entries(externalUrls)) {
      expect(JSON.parse(restored.files)[fileId]).toMatchObject({
        id: fileId,
        mimeType: "image/png",
        dataURL,
      });
    }
    expect(JSON.parse(restored.elements)).toEqual(exported.elements);
    expect(JSON.parse(restored.files).managed.dataURL).toBe(
      `/api/files/${drawing.id}/managed`,
    );
    const stored = await prisma.drawingFile.findMany({
      where: { drawingId: drawing.id },
    });
    expect(stored).toHaveLength(1);
    expect(stored[0].fileId).toBe("managed");
    expect(Buffer.from(stored[0].data!)).toEqual(imageBytes);
    expect(downloadBuffer).not.toHaveBeenCalled();
    expect(await downloadExport()).toEqual(expect.any(Buffer));
  });

  it.each([
    "missing row",
    "missing db bytes",
    "missing s3 key",
    "s3 missing",
    "s3 error",
  ])(
    "returns a complete HTTP 500 before streaming when managed storage has %s",
    async (failure) => {
      const drawing = await createBackupImageDrawing({
        managed: {
          id: "managed",
          mimeType: "image/png",
          dataURL:
            failure === "missing row"
              ? "/api/files/backup-images/managed"
              : "https://cdn.example/managed.png",
        },
        external: {
          id: "external",
          mimeType: "image/png",
          dataURL: "https://external.example/image.png",
        },
      });
      if (failure !== "missing row") {
        await prisma.drawingFile.create({
          data: {
            drawingId: drawing.id,
            fileId: "managed",
            mimeType: "image/png",
            sizeBytes: 42,
            storage: failure === "missing db bytes" ? "db" : "s3",
            s3Key: failure.startsWith("s3 ") ? "managed/image.png" : null,
            data: null,
          },
        });
      }
      vi.mocked(downloadBuffer).mockRejectedValue(
        new Error(
          failure === "s3 missing" ? "NoSuchKey" : "storage unavailable",
        ),
      );
      const response = await agent
        .get("/export/excalidash")
        .set("User-Agent", userAgent)
        .timeout({ response: 5000, deadline: 10000 });
      expect(response.status).toBe(500);
      expect(response.headers["content-type"]).toContain("application/json");
      expect(response.headers["content-disposition"]).toBeUndefined();
      expect(response.body.error).toBe("Internal server error");
      expect(downloadBuffer).toHaveBeenCalledTimes(
        failure.startsWith("s3 ") ? 1 : 0,
      );
    },
  );
});
