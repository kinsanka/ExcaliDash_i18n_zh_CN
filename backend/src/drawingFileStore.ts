import type { DrawingFile, Prisma, PrismaClient } from "./generated/client";

export const hasDrawingFileContent = (file: DrawingFile | null): boolean =>
  Boolean(
    file &&
    ((file.storage === "s3" && file.s3Key) ||
      (file.storage === "db" && file.data)),
  );

type FileContent = Pick<
  Prisma.DrawingFileCreateInput,
  | "drawingId"
  | "fileId"
  | "mimeType"
  | "sizeBytes"
  | "storage"
  | "s3Key"
  | "data"
>;

/** Store an immutable file id without replacing a concurrent winner's bytes. */
export const storeDrawingFileOnce = async (
  prisma: Pick<PrismaClient, "drawingFile">,
  content: FileContent,
): Promise<DrawingFile> => {
  const { drawingId, fileId } = content;
  const where = { drawingId_fileId: { drawingId, fileId } };
  const stored = await prisma.drawingFile.upsert({
    where,
    create: content,
    // An empty update disables Prisma's native INSERT ... ON CONFLICT path.
    // Assign the same immutable id so simultaneous first uploads both return
    // the winning row without changing its content or raising P2002.
    update: { fileId },
  });
  if (hasDrawingFileContent(stored)) return stored;

  // Repair legacy empty rows only if they are still empty. Another writer
  // may have filled the row after the upsert returned it.
  await prisma.drawingFile.updateMany({
    where: {
      drawingId,
      fileId,
      OR: [
        { storage: "db", data: null },
        { storage: "s3", s3Key: null },
        { storage: "s3", s3Key: "" },
      ],
    },
    data: content,
  });
  return prisma.drawingFile.findUniqueOrThrow({ where });
};
