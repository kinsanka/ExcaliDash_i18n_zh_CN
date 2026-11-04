import { en } from "../../../frontend/src/i18n/locales/en";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use the frontend's React instance and compiler without adding a second renderer.
const frontendRoot = path.resolve(__dirname, "../../../frontend");
const frontendRequire = createRequire(path.join(frontendRoot, "package.json"));
const React = frontendRequire("react");
const { createRoot } = frontendRequire("react-dom/client");
const ts = frontendRequire("typescript");

// Execute the real TS/TSX modules with their API/router dependencies replaced.
const loadFrontendModule = (file: string, imports: Record<string, unknown>) => {
  const filename = path.join(frontendRoot, "src", file);
  const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  const exports = {};
  runInNewContext(outputText, {
    exports,
    window,
    require: (name: string) => {
      if (name === "react") return React;
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return exports as Record<string, any>;
};

const english: Record<string, string> = en;
const translate = (key: string, params: Record<string, string | number> = {}) =>
  english[key].replace(/\{(\w+)\}/g, (_match: string, name: string) =>
    String(params[name] ?? `{${name}}`),
  );

const config = { enabled: true, windowMs: 900_000, max: 20 };
const api = { get: vi.fn(), put: vi.fn(), post: vi.fn() };
const setError = vi.fn();
const setSuccess = vi.fn();
const navigate = vi.fn();
const router = { useNavigate: () => navigate, useBeforeUnload: vi.fn() };
const toast = { success: vi.fn() };
let dom: JSDOM;
let container: HTMLElement;
let root: ReturnType<typeof createRoot>;
let settings: any;
let useLoginRateLimitSettings: any;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  dom = new JSDOM("<div id='root'></div>");
  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.getElementById("root")!;
  root = createRoot(container);
  api.get.mockResolvedValue({ data: { config, users: [] } });
  api.put.mockImplementation(async (_url, payload) => ({
    data: { config: payload },
  }));
  api.post.mockResolvedValue({ data: { ok: true } });
  ({ useLoginRateLimitSettings } = loadFrontendModule(
    "pages/admin/useLoginRateLimitSettings.ts",
    {
      "react-router-dom": router,
      sonner: { toast },
      "../../api": { api, isAxiosError: () => false },
      "../../i18n": { translateCurrent: translate },
    },
  ));
});

afterEach(async () => {
  await React.act(async () => root.unmount());
  dom.window.close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const renderHook = async (authEnabled: boolean | null, isAdmin: boolean) => {
  function Harness() {
    settings = useLoginRateLimitSettings({
      authEnabled,
      isAdmin,
      setError,
      setSuccess,
    });
    return null;
  }
  await React.act(async () => root.render(React.createElement(Harness)));
};

const renderAdmin = async (
  authEnabled: boolean | null,
  role: string,
  oidcEnabled: boolean,
) => {
  const Empty = () => null;
  const Layout = ({ children }: { children: unknown }) => children;
  const loadAccessControl = vi.fn();
  const loadCollections = vi.fn();
  const { Admin } = loadFrontendModule("pages/Admin.tsx", {
    "react-router-dom": router,
    "../components/Layout": { Layout },
    "../context/AuthContext": {
      useAuth: () => ({ authEnabled, user: { id: "admin", role } }),
    },
    "../api": { api },
    sonner: { Toaster: Empty },
    "../utils/passwordPolicy": { getPasswordPolicy: () => ({}) },
    "../utils/getApiErrorMessage": { getApiErrorMessage: () => "error" },
    "./admin/AccessControlCard": { AccessControlCard: Empty },
    "./admin/AdminShell": {
      AdminHeader: Empty,
      AdminStatusMessages: Empty,
    },
    "./admin/CreateUserForm": { CreateUserForm: Empty },
    "./admin/LoginRateLimitCard": {
      LoginRateLimitCard: () =>
        React.createElement("div", { "data-testid": "login-rate-limit" }),
    },
    "./admin/UserActionModals": { UserActionModals: Empty },
    "./admin/UsersTable": { UsersTable: Empty },
    "./admin/useAccessControlSettings": {
      useAccessControlSettings: () => ({
        oidcEnabled,
        load: loadAccessControl,
      }),
    },
    "./admin/useAdminCollections": {
      useAdminCollections: () => ({
        collections: [],
        loadCollections,
      }),
    },
    "./admin/useLoginRateLimitSettings": { useLoginRateLimitSettings },
    "../utils/impersonation": {},
    "../context/useLocale": { useLocale: () => ({ t: translate }) },
  });
  await React.act(async () => root.render(React.createElement(Admin)));
};

describe("admin login rate limit access", () => {
  it.each([false, true])(
    "shows and loads the card for an admin with OIDC enabled=%s",
    async (oidcEnabled) => {
      await renderAdmin(true, "ADMIN", oidcEnabled);
      expect(
        container.querySelector('[data-testid="login-rate-limit"]'),
      ).not.toBeNull();
      expect(api.get).toHaveBeenCalledWith("/auth/rate-limit/login");
    },
  );

  it.each([
    [false, "ADMIN"],
    [null, "ADMIN"],
    [true, "USER"],
  ])(
    "hides the card and does not load for authEnabled=%s role=%s",
    async (authEnabled, role) => {
      await renderAdmin(authEnabled as boolean | null, role as string, true);
      expect(
        container.querySelector('[data-testid="login-rate-limit"]'),
      ).toBeNull();
      expect(api.get).not.toHaveBeenCalledWith("/auth/rate-limit/login");
    },
  );

  it("loads, autosaves normalized settings, and resets a local account lockout", async () => {
    await renderHook(true, true);
    expect(settings.windowMinutes).toBe(15);
    expect(settings.maxAttempts).toBe(20);
    await React.act(async () => {
      settings.setEnabled(false);
      settings.setWindowMinutes(2.4);
      settings.setMaxAttempts(3.6);
    });
    expect(settings.autoSaveQueued).toBe(true);
    await React.act(async () => vi.advanceTimersByTimeAsync(899));
    expect(api.put).not.toHaveBeenCalled();
    await React.act(async () => vi.advanceTimersByTimeAsync(1));
    expect(api.put).toHaveBeenCalledWith("/auth/rate-limit/login", {
      enabled: false,
      windowMs: 120_000,
      max: 4,
    });
    expect(settings.dirty).toBe(false);
    await React.act(async () => settings.setResetIdentifier("  localuser  "));
    await React.act(async () => settings.reset());
    expect(api.post).toHaveBeenCalledWith("/auth/rate-limit/login/reset", {
      identifier: "localuser",
    });
    expect(setSuccess).toHaveBeenCalledWith(
      "Reset login rate limit for localuser",
    );
  });

  it.each([
    [false, true],
    [null, true],
    [true, false],
  ])(
    "does not load or autosave for authEnabled=%s isAdmin=%s",
    async (authEnabled, isAdmin) => {
      await renderHook(authEnabled, isAdmin as boolean);
      await React.act(async () => settings.setMaxAttempts(5));
      await React.act(async () => vi.advanceTimersByTimeAsync(1000));
      expect(api.get).not.toHaveBeenCalled();
      expect(api.put).not.toHaveBeenCalled();
    },
  );
});
