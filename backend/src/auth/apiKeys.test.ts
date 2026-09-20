import { describe, expect, it } from "vitest";
import { API_KEY_PREFIX, extractApiKeyId } from "./apiKeys";

describe("API key helpers", () => {
  it("extracts generated-format key IDs that contain underscores", () => {
    const keyId = "abcd_efgh_123456";
    const token = `${API_KEY_PREFIX}${keyId}_secret_value`;

    expect(extractApiKeyId(token)).toBe(keyId);
  });
});

