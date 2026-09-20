import express from "express";
import { compareSemver, parseSemver } from "../../utils/semver";
import { config } from "../../config";
import type { SystemRouteDeps } from "./index";

type UpdateChannel = "stable" | "prerelease";
type ReleaseSource = "localized" | "upstream";
type UpstreamSyncStatus = "synced" | "behind" | "ahead" | "unknown";

type GithubRelease = {
  tag_name?: string;
  html_url?: string;
  prerelease?: boolean;
  draft?: boolean;
  published_at?: string;
};

type UpdateResponse = {
  currentVersion: string | null;
  channel: UpdateChannel;
  outboundEnabled: boolean;
  latestVersion: string | null;
  latestUrl: string | null;
  publishedAt: string | null;
  isUpdateAvailable: boolean | null;
  upstream: {
    latestVersion: string | null;
    latestUrl: string | null;
    publishedAt: string | null;
    syncStatus: UpstreamSyncStatus;
    error?: string;
  };
  error?: string;
};

type LatestReleaseResponse = Omit<UpdateResponse, "currentVersion" | "upstream">;

let UPDATE_CHECK_TTL_MS = 10 * 60 * 1000;

const RELEASE_SOURCES: Record<
  ReleaseSource,
  { releasesApiUrl: string; latestReleaseUrl: string }
> = {
  localized: {
    releasesApiUrl:
      "https://api.github.com/repos/kinsanka/ExcaliDash_i18n_zh_CN/releases?per_page=30",
    latestReleaseUrl:
      "https://github.com/kinsanka/ExcaliDash_i18n_zh_CN/releases/latest",
  },
  upstream: {
    releasesApiUrl:
      "https://api.github.com/repos/ZimengXiong/ExcaliDash/releases?per_page=30",
    latestReleaseUrl:
      "https://github.com/ZimengXiong/ExcaliDash/releases/latest",
  },
};

type UpdateCache = {
  fetchedAt: number;
  etag: string | null;
  response: LatestReleaseResponse;
};

const caches = new Map<string, UpdateCache>();

const parseChannel = (raw: unknown): UpdateChannel => {
  const normalized = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return normalized === "prerelease" ? "prerelease" : "stable";
};

const envOutboundEnabled = (): boolean => config.updateCheck.outbound;

const envGithubToken = (): string | null => config.updateCheck.githubToken;

const pickLatestRelease = (
  releases: GithubRelease[],
  channel: UpdateChannel
): GithubRelease | null => {
  const candidates = releases
    .filter((r) => r && !r.draft)
    .filter((r) => {
      if (channel === "prerelease") return true;
      return !r.prerelease;
    })
    .map((r) => {
      const tag = typeof r.tag_name === "string" ? r.tag_name : "";
      const parsed = parseSemver(tag);
      return { r, parsed };
    })
    .filter((x) => Boolean(x.parsed)) as Array<{ r: GithubRelease; parsed: NonNullable<ReturnType<typeof parseSemver>> }>;

  if (candidates.length === 0) return null;

  let best = candidates[0];
  for (const candidate of candidates.slice(1)) {
    if (compareSemver(candidate.parsed, best.parsed) > 0) {
      best = candidate;
    }
  }
  return best.r;
};

const normalizeVersion = (raw: string): string | null => {
  const parsed = parseSemver(raw);
  if (!parsed) return null;
  const base = `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  return parsed.prerelease.length > 0 ? `${base}-${parsed.prerelease.join(".")}` : base;
};

const fetchLatestStableFromWeb = async (
  source: ReleaseSource,
  headers: Record<string, string>,
): Promise<LatestReleaseResponse | null> => {
  const latestReleaseUrl = RELEASE_SOURCES[source].latestReleaseUrl;
  const response = await fetch(latestReleaseUrl, {
    headers,
    redirect: "manual",
  });
  const location = response.headers.get("location");
  if (response.status < 300 || response.status >= 400 || !location) return null;

  const latestUrl = new URL(location, latestReleaseUrl).toString();
  const tagMatch = /\/releases\/tag\/([^/?#]+)/.exec(latestUrl);
  if (!tagMatch) return null;

  const latestVersion = normalizeVersion(decodeURIComponent(tagMatch[1]));
  if (!latestVersion) return null;

  return {
    channel: "stable",
    outboundEnabled: true,
    latestVersion,
    latestUrl,
    publishedAt: null,
    isUpdateAvailable: null,
  };
};

const fetchLatestForSource = async (
  source: ReleaseSource,
  channel: UpdateChannel,
): Promise<LatestReleaseResponse> => {
  const now = Date.now();
  const cacheKey = `${source}:${channel}`;
  const cache = caches.get(cacheKey);
  if (cache && now - cache.fetchedAt < UPDATE_CHECK_TTL_MS) {
    return cache.response;
  }

  if (!envOutboundEnabled()) {
    const response: LatestReleaseResponse = {
      channel,
      outboundEnabled: false,
      latestVersion: null,
      latestUrl: null,
      publishedAt: null,
      isUpdateAvailable: null,
    };
    caches.set(cacheKey, { fetchedAt: now, etag: null, response });
    return response;
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "ExcaliDash-UpdateCheck",
  };
  const token = envGithubToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (cache?.etag) {
    headers["If-None-Match"] = cache.etag;
  }

  const resp = await fetch(RELEASE_SOURCES[source].releasesApiUrl, { headers });

  if (resp.status === 304 && cache) {
    caches.set(cacheKey, { ...cache, fetchedAt: now });
    return cache.response;
  }

  if (!resp.ok) {
    if (channel === "stable" && (resp.status === 403 || resp.status === 429)) {
      const fallback = await fetchLatestStableFromWeb(source, headers);
      if (fallback) {
        caches.set(cacheKey, { fetchedAt: now, etag: null, response: fallback });
        return fallback;
      }
    }
    const response: LatestReleaseResponse = {
      channel,
      outboundEnabled: true,
      latestVersion: null,
      latestUrl: null,
      publishedAt: null,
      isUpdateAvailable: null,
      error:
        resp.status === 403 || resp.status === 429
          ? `GitHub API error: HTTP ${resp.status} (set UPDATE_CHECK_GITHUB_TOKEN to avoid rate limits)`
          : `GitHub API error: HTTP ${resp.status}`,
    };
    caches.set(cacheKey, { fetchedAt: now, etag: null, response });
    return response;
  }

  const etag = resp.headers.get("etag");
  const json = (await resp.json()) as unknown;
  const releases = Array.isArray(json) ? (json as GithubRelease[]) : [];
  const latest = pickLatestRelease(releases, channel);

  const latestVersion = latest?.tag_name ? normalizeVersion(latest.tag_name) : null;
  const response: LatestReleaseResponse = {
    channel,
    outboundEnabled: true,
    latestVersion,
    latestUrl: typeof latest?.html_url === "string" ? latest.html_url : null,
    publishedAt: typeof latest?.published_at === "string" ? latest.published_at : null,
    isUpdateAvailable: null, // computed once we know currentVersion
  };

  caches.set(cacheKey, { fetchedAt: now, etag, response });
  return response;
};

export const fetchLatest = (channel: UpdateChannel): Promise<LatestReleaseResponse> =>
  fetchLatestForSource("localized", channel);

export const fetchUpstreamLatest = (): Promise<LatestReleaseResponse> =>
  fetchLatestForSource("upstream", "stable");

export const computeIsUpdateAvailable = (
  currentVersion: string | null,
  latestVersion: string | null
): boolean | null => {
  if (!currentVersion || !latestVersion) return null;
  const currentParsed = parseSemver(currentVersion);
  const latestParsed = parseSemver(latestVersion);
  if (!currentParsed || !latestParsed) return null;
  return compareSemver(latestParsed, currentParsed) > 0;
};

export const computeUpstreamSyncStatus = (
  localizedVersion: string | null,
  upstreamVersion: string | null,
): UpstreamSyncStatus => {
  if (!localizedVersion || !upstreamVersion) return "unknown";
  const localized = parseSemver(localizedVersion);
  const upstream = parseSemver(upstreamVersion);
  if (!localized || !upstream) return "unknown";

  const localizedCore = [localized.major, localized.minor, localized.patch];
  const upstreamCore = [upstream.major, upstream.minor, upstream.patch];
  for (let index = 0; index < localizedCore.length; index += 1) {
    if (localizedCore[index] < upstreamCore[index]) return "behind";
    if (localizedCore[index] > upstreamCore[index]) return "ahead";
  }
  return "synced";
};

export const __resetUpdateCacheForTests = (): void => {
  caches.clear();
};

export const __setUpdateTtlForTests = (ttlMs: number): void => {
  UPDATE_CHECK_TTL_MS = ttlMs;
};

export const registerUpdateRoutes = (app: express.Express, deps: SystemRouteDeps) => {
  app.get(
    "/system/update",
    deps.asyncHandler(async (req, res) => {
      const channel = parseChannel(req.query.channel);
      const currentVersion = deps.getBackendVersion() || null;

      const latestPromise = fetchLatest(channel);
      const localizedStablePromise =
        channel === "stable" ? latestPromise : fetchLatest("stable");
      const [latest, localizedStable, upstreamLatest] = await Promise.all([
        latestPromise,
        localizedStablePromise,
        fetchUpstreamLatest(),
      ]);

      const isUpdateAvailable = computeIsUpdateAvailable(currentVersion, latest.latestVersion);

      const payload: UpdateResponse = {
        ...latest,
        currentVersion,
        isUpdateAvailable,
        upstream: {
          latestVersion: upstreamLatest.latestVersion,
          latestUrl: upstreamLatest.latestUrl,
          publishedAt: upstreamLatest.publishedAt,
          syncStatus: computeUpstreamSyncStatus(
            localizedStable.latestVersion,
            upstreamLatest.latestVersion,
          ),
          ...(upstreamLatest.error ? { error: upstreamLatest.error } : {}),
        },
      };

      res.status(200).json(payload);
    })
  );
};
