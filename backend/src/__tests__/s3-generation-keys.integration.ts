import { describe, expect, it } from "vitest";
import { buildS3Key, drawingS3Prefix } from "../s3";
import { fileIdFromS3Key } from "../routes/storage/helpers";
import { buildTrimS3CleanupPlan } from "../routes/storage/plans";

describe("S3 image generation keys", () => {
  it("preserves legacy keys and recognizes new generations under the same drawing prefix", () => {
    const prefix = drawingS3Prefix("owner", "drawing");
    const legacy = buildS3Key("owner", "drawing", "image-id", "png");
    const current = buildS3Key(
      "owner",
      "drawing",
      "image-id",
      "png",
      "generation",
    );
    expect(legacy).toBe(`${prefix}image-id.png`);
    expect(current).toBe(`${prefix}generation/image-id.png`);
    expect(fileIdFromS3Key(legacy)).toBe("image-id");
    expect(fileIdFromS3Key(current)).toBe("image-id");
    const records = [
      {
        fileId: "image-id",
        storage: "s3",
        s3Key: current,
        mimeType: "image/png",
        sizeBytes: 3,
      },
    ];
    expect(
      buildTrimS3CleanupPlan({
        survivingFileIds: new Set(["image-id"]),
        storedRecords: records,
      }).orphanKeys,
    ).toEqual([]);
    expect(
      buildTrimS3CleanupPlan({
        survivingFileIds: new Set(),
        storedRecords: records,
      }).orphanKeys,
    ).toEqual([current]);
  });
});
