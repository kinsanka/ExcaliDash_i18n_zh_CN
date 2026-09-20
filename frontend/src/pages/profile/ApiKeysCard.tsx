import React, { useEffect, useState } from "react";
import { Copy, KeyRound, Trash2 } from "lucide-react";
import * as api from "../../api";
import { ConfirmModal } from "../../components/ConfirmModal";

const API_KEY_SCOPE_LABELS: Record<string, string> = {
  "drawings:read": "Read drawings",
  "drawings:write": "Write drawings",
  "collections:read": "Read collections",
  "collections:write": "Write collections",
};

const getApiErrorMessage = (err: unknown, fallback: string) => {
  if (api.isAxiosError(err)) {
    if (err.response?.data?.message) return err.response.data.message;
    if (err.response?.data?.error) return err.response.data.error;
  }
  return fallback;
};

const formatApiKeyDate = (value: string | null) => {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
};

type Props = {
  disabled: boolean;
  onSuccess: (message: string) => void;
};

export const ApiKeysCard: React.FC<Props> = ({ disabled, onSuccess }) => {
  const [apiKeys, setApiKeys] = useState<api.ApiKeyMetadata[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(false);
  const [apiKeyName, setApiKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([...api.API_KEY_SCOPES]);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedToken, setGeneratedToken] = useState("");
  const [generatedTokenName, setGeneratedTokenName] = useState("");
  const [copiedToken, setCopiedToken] = useState(false);
  const [apiKeyToRevoke, setApiKeyToRevoke] = useState<api.ApiKeyMetadata | null>(null);

  useEffect(() => {
    if (disabled) {
      setApiKeys([]);
      setApiKeysLoading(false);
      setError("");
      return;
    }

    const fetchApiKeys = async () => {
      setApiKeysLoading(true);
      setError("");
      try {
        setApiKeys(await api.listApiKeys());
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, "Failed to load API keys"));
      } finally {
        setApiKeysLoading(false);
      }
    };

    void fetchApiKeys();
  }, [disabled]);

  const handleCreateApiKey = async () => {
    if (disabled || apiKeysLoading) return;
    const trimmedName = apiKeyName.trim();
    if (!trimmedName) return setError("API key name is required");
    if (selectedScopes.length === 0) return setError("Select at least one API key scope");

    setActionLoading(true);
    setError("");
    onSuccess("");
    try {
      const response = await api.createApiKey(trimmedName, selectedScopes);
      setApiKeys((prev) => [response.apiKey, ...prev]);
      setApiKeyName("");
      setSelectedScopes([...api.API_KEY_SCOPES]);
      setGeneratedToken(response.token);
      setGeneratedTokenName(response.apiKey.name);
      setCopiedToken(false);
      onSuccess("API key created. Copy the token now; it will not be shown again.");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to create API key"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopyGeneratedToken = async () => {
    if (!generatedToken) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(generatedToken);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = generatedToken;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedToken(true);
      onSuccess("API key token copied to clipboard");
      window.setTimeout(() => setCopiedToken(false), 1500);
    } catch {
      setError("Failed to copy token. Select and copy it manually.");
    }
  };

  const handleApiKeyScopeChange = (scope: string, checked: boolean) => {
    const next = checked
      ? [...selectedScopes, scope]
      : selectedScopes.filter((value) => value !== scope);
    setSelectedScopes(api.API_KEY_SCOPES.filter((value) => next.includes(value)));
    setError(next.length === 0 ? "Select at least one API key scope" : "");
  };

  const handleRevokeApiKey = async (id: string) => {
    setActionLoading(true);
    setError("");
    onSuccess("");
    try {
      await api.revokeApiKey(id);
      const revokedAt = new Date().toISOString();
      setApiKeys((prev) =>
        prev.map((apiKey) => (apiKey.id === id ? { ...apiKey, revokedAt } : apiKey)),
      );
      onSuccess("API key revoked");
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to revoke API key"));
    } finally {
      setActionLoading(false);
      setApiKeyToRevoke(null);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center border-2 border-emerald-100 dark:border-neutral-700">
            <KeyRound size={24} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">API Keys</h2>
            <p className="text-sm text-slate-600 dark:text-neutral-400 font-medium">
              Create bearer tokens for scripts and integrations. Tokens are shown only once.
            </p>
          </div>
        </div>

        {disabled ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl">
            <p className="text-amber-900 dark:text-amber-200 font-bold">
              API key management is unavailable until you reset your password.
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200/80 font-medium mt-1">
              Change your password below, then return here to create and manage API keys.
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-red-800 dark:text-red-200 font-medium">{error}</p>
              </div>
            )}
            {generatedToken && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-800 rounded-xl" aria-live="polite">
                <p className="text-amber-900 dark:text-amber-200 font-bold">
                  Copy this token now. You will not be able to see it again.
                </p>
                <p className="text-sm text-amber-800 dark:text-amber-200/80 font-medium mt-1">
                  New API key: {generatedTokenName}
                </p>
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <input
                    aria-label={`Generated API token for ${generatedTokenName}`}
                    value={generatedToken}
                    readOnly
                    className="flex-1 px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-black dark:border-neutral-700 rounded-xl font-mono text-xs text-slate-900 dark:text-white"
                    onFocus={(event) => event.target.select()}
                  />
                  <button
                    onClick={() => void handleCopyGeneratedToken()}
                    aria-label="Copy generated API token"
                    className="px-4 py-3 bg-amber-500 text-white font-bold rounded-xl border-2 border-black dark:border-neutral-700 flex items-center justify-center gap-2"
                  >
                    <Copy size={18} />
                    {copiedToken ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => {
                      setGeneratedToken("");
                      setGeneratedTokenName("");
                      setCopiedToken(false);
                    }}
                    className="px-4 py-3 bg-white dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 font-bold rounded-xl border-2 border-black dark:border-neutral-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            <div className="mb-6 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label htmlFor="apiKeyName" className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
                    API Key Name
                  </label>
                  <input
                    id="apiKeyName"
                    type="text"
                    value={apiKeyName}
                    onChange={(event) => setApiKeyName(event.target.value)}
                    maxLength={100}
                    className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-black dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 font-medium"
                    placeholder="Example: Backup script"
                  />
                </div>
                <button
                  onClick={() => void handleCreateApiKey()}
                  disabled={apiKeysLoading || actionLoading || !apiKeyName.trim() || selectedScopes.length === 0}
                  className="sm:self-end px-6 py-3 bg-emerald-600 dark:bg-emerald-500 text-white font-bold rounded-xl border-2 border-black dark:border-neutral-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? "Creating..." : "Create API Key"}
                </button>
              </div>
              <fieldset>
                <legend className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
                  Scopes
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {api.API_KEY_SCOPES.map((scope) => (
                    <label key={scope} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-sm font-medium text-slate-700 dark:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope)}
                        onChange={(event) => handleApiKeyScopeChange(scope, event.target.checked)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span>{API_KEY_SCOPE_LABELS[scope]}</span>
                      <span className="font-mono text-xs text-slate-500 dark:text-neutral-500">{scope}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {apiKeysLoading ? (
              <p className="text-slate-600 dark:text-neutral-400 font-medium">Loading API keys...</p>
            ) : apiKeys.length === 0 ? (
              <p className="text-slate-600 dark:text-neutral-400 font-medium">No API keys have been created yet.</p>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((apiKey) => {
                  const revoked = Boolean(apiKey.revokedAt);
                  return (
                    <div key={apiKey.id} className="p-4 bg-slate-50 dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white break-words">{apiKey.name}</h3>
                            <span className={revoked ? "px-2 py-1 text-xs font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800" : "px-2 py-1 text-xs font-bold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800"}>
                              {revoked ? "Revoked" : "Active"}
                            </span>
                          </div>
                          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div><dt className="font-bold text-slate-700 dark:text-neutral-300">Prefix</dt><dd className="font-mono text-slate-600 dark:text-neutral-400 break-all">{apiKey.prefix}</dd></div>
                            <div><dt className="font-bold text-slate-700 dark:text-neutral-300">Scopes</dt><dd className="text-slate-600 dark:text-neutral-400">{apiKey.scopes.length > 0 ? apiKey.scopes.join(", ") : "None"}</dd></div>
                            <div><dt className="font-bold text-slate-700 dark:text-neutral-300">Created</dt><dd className="text-slate-600 dark:text-neutral-400">{formatApiKeyDate(apiKey.createdAt)}</dd></div>
                            <div><dt className="font-bold text-slate-700 dark:text-neutral-300">Last Used</dt><dd className="text-slate-600 dark:text-neutral-400">{formatApiKeyDate(apiKey.lastUsedAt)}</dd></div>
                            <div><dt className="font-bold text-slate-700 dark:text-neutral-300">Revoked</dt><dd className="text-slate-600 dark:text-neutral-400">{formatApiKeyDate(apiKey.revokedAt)}</dd></div>
                          </dl>
                        </div>
                        <button
                          onClick={() => setApiKeyToRevoke(apiKey)}
                          disabled={actionLoading || revoked}
                          className="px-4 py-2 bg-white dark:bg-neutral-900 text-red-700 dark:text-red-300 font-bold rounded-xl border-2 border-black dark:border-neutral-700 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          aria-label={`Revoke API key ${apiKey.name}`}
                        >
                          <Trash2 size={18} />
                          Revoke
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmModal
        isOpen={Boolean(apiKeyToRevoke)}
        title="Revoke API Key"
        message={apiKeyToRevoke ? `Revoke API key "${apiKeyToRevoke.name}"? Existing integrations using this key will stop working.` : ""}
        confirmText="Revoke"
        onConfirm={() => apiKeyToRevoke && void handleRevokeApiKey(apiKeyToRevoke.id)}
        onCancel={() => setApiKeyToRevoke(null)}
      />
    </>
  );
};

