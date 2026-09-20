import type React from "react";
import { Info, Upload } from "lucide-react";
import { importLegacyFiles } from "../../utils/importUtils";

type DialogState = { isOpen: boolean; message: string };
type SuccessDialogState = { isOpen: boolean; message: React.ReactNode };

type AdvancedSettingsProps = {
  authEnabled: boolean | null;
  authMode: string | null | undefined;
  authToggleLoading: boolean;
  backupImportLoading: boolean;
  legacyDbImportLoading: boolean;
  isManagedAuthMode: boolean;
  user: { role?: string } | null | undefined;
  appVersion: string;
  buildLabel: string | undefined;
  verifyBackupFile: (file: File) => Promise<void>;
  verifyLegacyDbFile: (file: File) => Promise<void>;
  confirmToggleAuthEnabled: () => void;
  setImportError: React.Dispatch<React.SetStateAction<DialogState>>;
  setImportSuccess: React.Dispatch<React.SetStateAction<SuccessDialogState>>;
};

export const AdvancedSettings = ({
  authEnabled,
  authMode,
  authToggleLoading,
  backupImportLoading,
  legacyDbImportLoading,
  isManagedAuthMode,
  user,
  appVersion,
  buildLabel,
  verifyBackupFile,
  verifyLegacyDbFile,
  confirmToggleAuthEnabled,
  setImportError,
  setImportSuccess,
}: AdvancedSettingsProps) => (
  <details className="mt-8 bg-white/30 dark:bg-neutral-900/30 border border-slate-200/70 dark:border-neutral-800/70 rounded-2xl p-4 sm:p-6">
    <summary className="cursor-pointer select-none font-bold text-slate-800 dark:text-neutral-200">
      {" "}
      Advanced / Legacy{" "}
    </summary>{" "}
    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {" "}
      <div className="relative">
        {" "}
        <input
          type="file"
          accept=".excalidash,.zip"
          className="hidden"
          id="settings-import-backup"
          onChange={async (e) => {
            const file = (e.target.files || [])[0];
            if (!file) return;
            await verifyBackupFile(file);
            e.target.value = "";
          }}
        />{" "}
        <button
          onClick={() =>
            document.getElementById("settings-import-backup")?.click()
          }
          disabled={backupImportLoading}
          className="w-full h-full flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-1 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {" "}
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-blue-100 dark:border-neutral-700">
            {" "}
            <Upload
              size={32}
              className="text-blue-600 dark:text-blue-400 hidden sm:block"
            />
            <Upload
              size={24}
              className="text-blue-600 dark:text-blue-400 sm:hidden"
            />{" "}
          </div>{" "}
          <div className="text-center">
            {" "}
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              {" "}
              {backupImportLoading ? "Verifying…" : "Import Backup"}{" "}
            </h3>{" "}
            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium max-w-[200px] mx-auto">
              Merge-import a `.excalidash` backup into your account
            </p>{" "}
          </div>{" "}
        </button>{" "}
      </div>{" "}
      <button
        onClick={confirmToggleAuthEnabled}
        disabled={
          isManagedAuthMode ||
          authEnabled === null ||
          authToggleLoading ||
          (authEnabled === true && user?.role !== "ADMIN")
        }
        className="w-full flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-1 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-y-0"
      >
        {" "}
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-slate-200 dark:border-neutral-700 group-hover:border-slate-300 dark:group-hover:border-neutral-600 transition-colors">
          <Info
            size={32}
            className="text-slate-700 dark:text-neutral-300 hidden sm:block"
          />{" "}
          <Info
            size={24}
            className="text-slate-700 dark:text-neutral-300 sm:hidden"
          />{" "}
        </div>{" "}
        <div className="text-center">
          {" "}
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            {" "}
            {authEnabled ? "Authentication: On" : "Authentication: Off"}{" "}
          </h3>{" "}
          <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium max-w-[200px] mx-auto">
            {" "}
            {isManagedAuthMode
              ? `Managed by AUTH_MODE=${authMode}`
              : authEnabled
                ? user?.role === "ADMIN"
                  ? authToggleLoading
                    ? "Disabling…"
                    : "Disable multi-user login"
                  : "Only admins can disable"
                : authToggleLoading
                  ? "Enabling…"
                  : "Enable multi-user login"}{" "}
          </p>{" "}
        </div>{" "}
      </button>{" "}
      <div className="relative">
        {" "}
        <input
          type="file"
          multiple
          accept=".sqlite,.db,.json,.excalidraw,.zip"
          className="hidden"
          id="settings-import-legacy"
          onChange={async (e) => {
            const files = Array.from(e.target.files || []);
            if (files.length === 0) return;
            const databaseFile = files.find(
              (f) => f.name.endsWith(".sqlite") || f.name.endsWith(".db"),
            );
            if (databaseFile) {
              if (files.length > 1) {
                setImportError({
                  isOpen: true,
                  message:
                    "Please import legacy database files separately from other files.",
                });
                e.target.value = "";
                return;
              }
              await verifyLegacyDbFile(databaseFile);
              e.target.value = "";
              return;
            }
            const result = await importLegacyFiles(files, null, () => {});
            if (result.failed > 0) {
              setImportError({
                isOpen: true,
                message: `Import complete with errors.\nSuccess: ${result.success}\nFailed: ${result.failed}\nErrors:\n${result.errors.join("\n")}`,
              });
            } else {
              setImportSuccess({
                isOpen: true,
                message: `Imported ${result.success} file(s).`,
              });
            }
            e.target.value = "";
          }}
        />{" "}
        <button
          onClick={() =>
            document.getElementById("settings-import-legacy")?.click()
          }
          disabled={legacyDbImportLoading}
          className="w-full h-full flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-1 transition-all duration-200 group"
        >
          {" "}
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-amber-100 dark:border-neutral-700">
            {" "}
            <Upload
              size={32}
              className="text-amber-600 dark:text-amber-400 hidden sm:block"
            />{" "}
            <Upload
              size={24}
              className="text-amber-600 dark:text-amber-400 sm:hidden"
            />{" "}
          </div>
          <div className="text-center">
            {" "}
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
              Legacy Import
            </h3>
            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium max-w-[200px] mx-auto">
              Import `.excalidraw`, legacy JSON, or merge a legacy `.db`
            </p>
          </div>{" "}
        </button>{" "}
      </div>{" "}
      <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
        {" "}
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-gray-100 dark:border-neutral-700">
          {" "}
          <Info
            size={32}
            className="text-gray-600 dark:text-gray-400 hidden sm:block"
          />{" "}
          <Info
            size={24}
            className="text-gray-600 dark:text-gray-400 sm:hidden"
          />{" "}
        </div>{" "}
        <div className="text-center">
          {" "}
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            Version Info
          </h3>{" "}
          <div className="text-[10px] sm:text-xs text-slate-500 dark:text-neutral-400 font-bold flex flex-col items-center gap-1">
            <span className="text-sm sm:text-base text-slate-900 dark:text-white">
              {" "}
              {appVersion}{" "}
            </span>{" "}
            {buildLabel && (
              <span className="uppercase tracking-wide text-red-500 dark:text-red-400">
                {" "}
                {buildLabel}{" "}
              </span>
            )}{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
    </div>{" "}
  </details>
);

