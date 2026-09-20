import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

type MockFetchResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  json: () => Promise<unknown>;
};

const makeFetchResponse = (opts: {
  status: number;
  json?: unknown;
  etag?: string | null;
  location?: string | null;
}): MockFetchResponse => ({
  ok: opts.status >= 200 && opts.status < 300,
  status: opts.status,
  headers: {
    get: (name: string) => {
      if (name.toLowerCase() === "etag") return opts.etag ?? null;
      if (name.toLowerCase() === "location") return opts.location ?? null;
      return null;
    },
  },
  json: async () => opts.json,
});

describe("system/update logic", () => {
  const originalOutbound = process.env.UPDATE_CHECK_OUTBOUND;
  const originalToken = process.env.UPDATE_CHECK_GITHUB_TOKEN;
  const originalGithubToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    vi.resetModules();
    process.env.UPDATE_CHECK_OUTBOUND = "true";
    delete process.env.UPDATE_CHECK_GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
  });

  afterEach(() => {
    process.env.UPDATE_CHECK_OUTBOUND = originalOutbound;
    process.env.UPDATE_CHECK_GITHUB_TOKEN = originalToken;
    process.env.GITHUB_TOKEN = originalGithubToken;
    vi.restoreAllMocks();
  });

  it("returns outbound disabled payload when UPDATE_CHECK_OUTBOUND=false", async () => {
    process.env.UPDATE_CHECK_OUTBOUND = "false";
    const fetchSpy = vi.fn();
    (globalThis as any).fetch = fetchSpy;

    const mod = await import("./update");
    mod.__resetUpdateCacheForTests();
    const latest = await mod.fetchLatest("stable");

    expect(latest.outboundEnabled).toBe(false);
    expect(latest.latestVersion).toBe(null);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stable channel picks latest stable (ignores prereleases)", async () => {
    const releases = [
      { tag_name: "v1.2.0-dev", prerelease: true, draft: false, html_url: "u1", published_at: "t1" },
      { tag_name: "v1.1.9", prerelease: false, draft: false, html_url: "u2", published_at: "t2" },
      { tag_name: "v1.2.0", prerelease: false, draft: false, html_url: "u3", published_at: "t3" },
    ];
    (globalThis as any).fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 200, json: releases, etag: "E1" })
    );

    const mod = await import("./update");
    mod.__resetUpdateCacheForTests();
    const latest = await mod.fetchLatest("stable");

    expect(latest.channel).toBe("stable");
    expect(latest.latestVersion).toBe("1.2.0");
    expect(mod.computeIsUpdateAvailable("1.1.0", latest.latestVersion)).toBe(true);
  });

  it("treats a localized release suffix as stable when GitHub does", async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({
        status: 200,
        json: [
          {
            tag_name: "v0.6.0-zh.1",
            prerelease: false,
            draft: false,
            html_url: "localized",
            published_at: "t1",
          },
        ],
      }),
    );

    const mod = await import("./update");
    mod.__resetUpdateCacheForTests();
    const latest = await mod.fetchLatest("stable");

    expect(latest.latestVersion).toBe("0.6.0-zh.1");
    expect(latest.latestUrl).toBe("localized");
  });

  it("falls back to the public latest-release redirect when the API is rate limited", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeFetchResponse({ status: 403 }))
      .mockResolvedValueOnce(
        makeFetchResponse({
          status: 302,
          location:
            "https://github.com/kinsanka/ExcaliDash_i18n_zh_CN/releases/tag/v0.6.0-zh.1",
        }),
      );
    (globalThis as any).fetch = fetchMock;

    const mod = await import("./update");
    mod.__resetUpdateCacheForTests();
    const latest = await mod.fetchLatest("stable");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(latest.error).toBeUndefined();
    expect(latest.latestVersion).toBe("0.6.0-zh.1");
  });

  it("prerelease channel can pick prerelease when newer than stable", async () => {
    const releases = [
      { tag_name: "v1.2.0-dev.2", prerelease: true, draft: false, html_url: "u1", published_at: "t1" },
      { tag_name: "v1.1.9", prerelease: false, draft: false, html_url: "u2", published_at: "t2" },
      { tag_name: "v1.2.0-dev.10", prerelease: true, draft: false, html_url: "u3", published_at: "t3" },
    ];
    (globalThis as any).fetch = vi.fn().mockResolvedValue(
      makeFetchResponse({ status: 200, json: releases, etag: "E2" })
    );

    const mod = await import("./update");
    mod.__resetUpdateCacheForTests();
    const latest = await mod.fetchLatest("prerelease");

    expect(latest.channel).toBe("prerelease");
    expect(latest.latestVersion).toBe("1.2.0-dev.10");
    expect(mod.computeIsUpdateAvailable("1.2.0-dev.1", latest.latestVersion)).toBe(true);
  });

  it("uses cached response when GitHub returns 304", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeFetchResponse({
          status: 200,
          json: [{ tag_name: "v2.0.0", prerelease: false, draft: false, html_url: "u", published_at: "t" }],
          etag: "ETAG-1",
        })
      )
      .mockResolvedValueOnce(makeFetchResponse({ status: 304, json: null, etag: null }));
    (globalThis as any).fetch = fetchMock;

    const mod = await import("./update");
    mod.__resetUpdateCacheForTests();
    const r1 = await mod.fetchLatest("stable");

    mod.__setUpdateTtlForTests(0);
    const r2 = await mod.fetchLatest("stable");

    expect(r1.latestVersion).toBe("2.0.0");
    expect(r2.latestVersion).toBe("2.0.0");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCall = fetchMock.mock.calls[1] as any[];
    const secondOpts = secondCall?.[1] as { headers?: Record<string, string> } | undefined;
    expect(secondOpts?.headers?.["If-None-Match"]).toBe("ETAG-1");
  });
});
