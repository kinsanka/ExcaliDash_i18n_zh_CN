import { Check, ExternalLink, GitFork, RefreshCw } from "lucide-react";
import clsx from "clsx";
import type * as api from "../../api";
import { useI18n } from "../../context/I18nContext";

type UpdateSettingsCardProps = {
  updateChannel: api.UpdateChannel;
  updateInfo: api.UpdateInfo | null;
  updateLoading: boolean;
  updateError: string | null;
  onChannelChange: (channel: api.UpdateChannel) => void;
  onCheckForUpdates: () => void;
};

export const UpdateSettingsCard = ({
  updateChannel,
  updateInfo,
  updateLoading,
  updateError,
  onChannelChange,
  onCheckForUpdates,
}: UpdateSettingsCardProps) => {
  const { language, t } = useI18n();
  const upstream = updateInfo?.upstream;
  const upstreamPublishedAt = upstream?.publishedAt
    ? new Date(upstream.publishedAt)
    : null;
  const hasValidPublishedAt =
    upstreamPublishedAt && !Number.isNaN(upstreamPublishedAt.getTime());
  const upstreamStatus = (() => {
    if (upstream?.error) return t("settings.upstreamUnavailable");
    if (upstream?.syncStatus === "synced") return t("settings.upstreamSynced");
    if (upstream?.syncStatus === "behind") {
      return t("settings.upstreamBehind", {
        version: updateInfo?.latestVersion ?? "?",
      });
    }
    if (upstream?.syncStatus === "ahead") return t("settings.upstreamAhead");
    return t("settings.upstreamUnknown");
  })();

  return (
  <div className="flex flex-col p-4 sm:p-6 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
    <div className="flex items-center gap-3 sm:gap-4 mb-6">
      <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center border-2 border-emerald-100 dark:border-emerald-800/50 relative overflow-hidden group">
        <div className="absolute inset-0 opacity-[0.2] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [background-size:12px_12px]"></div>
        <RefreshCw
          size={28}
          className={clsx(
            "text-emerald-600 dark:text-emerald-400 relative z-10 sm:hidden",
            updateLoading && "animate-spin",
          )}
        />
        <RefreshCw
          size={32}
          className={clsx(
            "text-emerald-600 dark:text-emerald-400 relative z-10 hidden sm:block",
            updateLoading && "animate-spin",
          )}
        />
      </div>
      <div className="min-w-0">
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
          {t("settings.updates")}
        </h3>
      </div>
    </div>
    <div className="space-y-4 flex-1">
      <div className="p-3 sm:p-4 rounded-xl border-2 border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/30">
        <div className="flex items-center justify-between mb-2">
          <label
            className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500"
            htmlFor="settings-update-channel"
          >
            {t("settings.channel")}
          </label>
          <span
            className={clsx(
              "px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-tighter border",
              updateChannel === "stable"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
                : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50",
            )}
          >
            {updateChannel}
          </span>
        </div>
        <select
          id="settings-update-channel"
          value={updateChannel}
          onChange={(e) =>
            onChannelChange(
              e.target.value === "prerelease" ? "prerelease" : "stable",
            )
          }
          className="w-full h-10 px-2 sm:px-3 rounded-lg border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]"
        >
          <option value="stable">{t("settings.stable")}</option>
          <option value="prerelease">{t("settings.prerelease")}</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-widest">
            {t("settings.currentStatus")}
          </span>
        </div>
        <div
          className={clsx(
            "px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 font-bold text-xs sm:text-sm flex items-center gap-2 sm:gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]",
            updateInfo?.outboundEnabled === false
              ? "bg-slate-50 border-slate-200 text-slate-500 dark:bg-neutral-800 dark:border-neutral-700"
              : updateLoading
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300"
                : updateInfo?.isUpdateAvailable
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50"
                  : updateError
                    ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
                    : "bg-slate-50 border-slate-200 text-slate-600 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300",
          )}
        >
          {updateLoading && (
            <RefreshCw size={14} className="animate-spin flex-shrink-0" />
          )}
          <span className="truncate">
            {updateInfo?.outboundEnabled === false ? (
              t("settings.checksDisabled")
            ) : updateLoading ? (
              t("settings.checking")
            ) : updateInfo?.isUpdateAvailable ? (
              t("settings.versionAvailable", {
                version: updateInfo.latestVersion ?? "?",
              })
            ) : updateInfo?.latestVersion ? (
              <span className="flex items-center gap-1.5">
                <Check
                  size={14}
                  strokeWidth={3}
                  className="text-emerald-500 flex-shrink-0"
                />
                {t("settings.upToDate")}
              </span>
            ) : updateError ? (
              updateError
            ) : (
              t("settings.statusUnknown")
            )}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-widest">
            {t("settings.upstreamStableProgress")}
          </span>
        </div>
        <div className="rounded-xl border-2 border-sky-100 bg-sky-50/60 p-3 text-xs dark:border-sky-900/60 dark:bg-sky-950/20">
          <div className="flex items-center gap-3">
            <GitFork className="shrink-0 text-sky-600 dark:text-sky-400" size={18} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-slate-900 dark:text-white">
                  {upstream?.latestVersion
                    ? `v${upstream.latestVersion}`
                    : t("settings.statusUnknown")}
                </span>
                {upstream?.latestUrl && (
                  <a
                    className="inline-flex items-center gap-1 font-bold text-sky-700 hover:underline dark:text-sky-300"
                    href={upstream.latestUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {t("settings.originalRelease")}
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
              <p className="mt-1 font-semibold text-slate-600 dark:text-neutral-300">
                {upstreamStatus}
              </p>
              {hasValidPublishedAt && upstreamPublishedAt && (
                <p className="mt-1 text-[10px] font-medium text-slate-400 dark:text-neutral-500">
                  {t("settings.publishedOn", {
                    date: upstreamPublishedAt.toLocaleDateString(language),
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
      <button
        onClick={onCheckForUpdates}
        disabled={updateLoading}
        className="flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-none disabled:opacity-50"
        type="button"
      >
        {t("settings.checkNow")}
      </button>
      <a
        href="https://github.com/kinsanka/ExcaliDash_i18n_zh_CN/releases"
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl border-2 border-black dark:border-neutral-700 bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-none"
      >
        {t("settings.releases")}
      </a>
    </div>
    {updateInfo?.error && !updateLoading && (
      <div className="mt-4 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-[10px] font-bold text-red-600 dark:text-red-400 italic">
        {t("settings.errorPrefix", { message: updateInfo.error })}
      </div>
    )}
  </div>
  );
};
