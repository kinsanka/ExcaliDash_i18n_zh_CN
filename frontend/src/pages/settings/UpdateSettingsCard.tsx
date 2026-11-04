import type { ReactNode } from "react";
import { Check, FlaskConical, RefreshCw, ShieldCheck } from "lucide-react";
import type * as api from "../../api";
import { PlayfulSelect } from "../../components/PlayfulSelect";
import { SettingsRow, settingsButtonClass } from "./SettingsRow";
import { useLocale } from "../../context/useLocale";

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
  const { t, locale } = useLocale();
  const upstream = updateInfo?.upstream;
  const upstreamStatus = upstream?.error
    ? t("settings.update.upstreamUnavailable")
    : upstream?.syncStatus === "synced"
      ? t("settings.update.upstreamSynced")
      : upstream?.syncStatus === "behind"
        ? t("settings.update.upstreamBehind", {
            version: updateInfo?.latestVersion ?? "?",
          })
        : upstream?.syncStatus === "ahead"
          ? t("settings.update.upstreamAhead")
          : t("settings.update.upstreamUnknown");
  const publishedAt = upstream?.publishedAt
    ? new Date(upstream.publishedAt)
    : null;
  let status: ReactNode = t("settings.update.statusUnknown");
  if (updateInfo?.outboundEnabled === false) {
    status = t("settings.update.checksDisabled");
  } else if (updateLoading) {
    status = t("settings.update.checking");
  } else if (updateInfo?.isUpdateAvailable) {
    status = (
      <span className="font-bold text-emerald-600 dark:text-emerald-400">
        {t("settings.update.versionAvailable", {
          version: updateInfo.latestVersion ?? "",
        })}
      </span>
    );
  } else if (updateInfo?.latestVersion) {
    status = (
      <span className="inline-flex items-center gap-1">
        <Check size={12} strokeWidth={3} className="text-emerald-500" />
        {t("settings.update.upToDate")}
      </span>
    );
  } else if (updateError) {
    status = (
      <span className="text-red-600 dark:text-red-400">{updateError}</span>
    );
  }

  return (
    <SettingsRow
      icon={
        <RefreshCw size={20} className={updateLoading ? "animate-spin" : ""} />
      }
      tileClassName="border-black bg-emerald-400 text-black dark:border-neutral-700 dark:bg-emerald-400 dark:text-black"
      title={t("settings.update.title")}
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          {status}
          <a
            href="https://github.com/kinsanka/ExcaliDash_i18n_zh_CN/releases"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center font-bold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {t("settings.update.releases")}
          </a>
          {updateInfo?.error && !updateLoading ? (
            <span className="basis-full text-red-500 dark:text-red-400">
              {t("settings.update.error", { error: updateInfo.error })}
            </span>
          ) : null}
          <span className="basis-full rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-neutral-700 dark:bg-neutral-800">
            <span className="block font-bold">
              {t("settings.update.upstreamProgress")}
            </span>
            <span className="inline-flex flex-wrap items-center gap-2">
              {upstream?.latestVersion ? `v${upstream.latestVersion}` : "—"}
              {upstream?.latestUrl && (
                <a
                  href={upstream.latestUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold hover:underline"
                >
                  {t("settings.update.originalRelease")}
                </a>
              )}
            </span>
            <span className="block">{upstreamStatus}</span>
            {publishedAt && !Number.isNaN(publishedAt.getTime()) && (
              <span className="block text-xs">
                {t("settings.update.publishedOn", {
                  date: publishedAt.toLocaleDateString(locale),
                })}
              </span>
            )}
          </span>
        </span>
      }
    >
      <PlayfulSelect
        ariaLabel={t("update.channel")}
        value={updateChannel}
        onChange={(value) =>
          onChannelChange(value === "prerelease" ? "prerelease" : "stable")
        }
        options={[
          {
            value: "stable",
            label: t("settings.update.stable"),
            icon: <ShieldCheck size={14} />,
          },
          {
            value: "prerelease",
            label: t("settings.update.prerelease"),
            icon: <FlaskConical size={14} />,
          },
        ]}
      />
      <button
        type="button"
        onClick={onCheckForUpdates}
        disabled={updateLoading}
        className={settingsButtonClass}
      >
        {t("settings.update.check")}
      </button>
    </SettingsRow>
  );
};
