import React from "react";
import { UserCog } from "lucide-react";
import { PasswordRequirements } from "../../components/PasswordRequirements";
import type { PasswordPolicy } from "../../utils/passwordPolicy";

type CreateUserFormProps = {
  email: string;
  name: string;
  username: string;
  password: string;
  oidcOnly: boolean;
  oidcEnabled: boolean;
  role: "ADMIN" | "USER";
  mustReset: boolean;
  active: boolean;
  passwordPolicy: PasswordPolicy;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onOidcOnlyChange: (value: boolean) => void;
  onRoleChange: (value: "ADMIN" | "USER") => void;
  onMustResetChange: (value: boolean) => void;
  onActiveChange: (value: boolean) => void;
};

export const CreateUserForm: React.FC<CreateUserFormProps> = ({
  email,
  name,
  username,
  password,
  oidcOnly,
  oidcEnabled,
  role,
  mustReset,
  active,
  passwordPolicy,
  onSubmit,
  onCancel,
  onEmailChange,
  onNameChange,
  onUsernameChange,
  onPasswordChange,
  onOidcOnlyChange,
  onRoleChange,
  onMustResetChange,
  onActiveChange,
}) => (
  <div className="mb-6 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] p-4 sm:p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-12 h-12 bg-indigo-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center border-2 border-indigo-100 dark:border-neutral-700">
        <UserCog size={24} className="text-indigo-600 dark:text-indigo-400" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
        Create User
      </h2>
    </div>
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
          className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          required
          className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
          Username (optional)
        </label>
        <input
          type="text"
          value={username}
          onChange={(event) => onUsernameChange(event.target.value)}
          className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
          Account Type
        </label>
        <button
          type="button"
          onClick={() => {
            const next = !oidcOnly;
            onOidcOnlyChange(next);
            if (next) onMustResetChange(false);
          }}
          disabled={!oidcEnabled}
          className={`w-full px-4 py-3 rounded-xl border-2 font-bold transition-all text-sm ${
            oidcOnly
              ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200"
              : "border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300"
          } ${!oidcEnabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          {oidcOnly ? "OIDC-only invite" : "Local password account"}
        </button>
        <p className="mt-2 text-xs text-slate-500 dark:text-neutral-400">
          {oidcOnly
            ? "This user can sign in through OIDC when the IdP email matches. No local password is stored."
            : "This user can sign in with a local password."}
        </p>
      </div>
      {!oidcOnly && (
        <div>
          <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
            Temporary Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            minLength={passwordPolicy.minLength}
            maxLength={passwordPolicy.maxLength}
            pattern={passwordPolicy.patternHtml}
            required
            className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
          />
          <PasswordRequirements
            password={password}
            policy={passwordPolicy}
            className="text-slate-600 dark:text-neutral-400"
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
          Role
        </label>
        <select
          value={role}
          onChange={(event) => onRoleChange(event.target.value as "ADMIN" | "USER")}
          className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
        >
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
        <div className="flex-1 w-full">
          <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
            Password Reset
          </label>
          <button
            type="button"
            onClick={() => !oidcOnly && onMustResetChange(!mustReset)}
            disabled={oidcOnly}
            className={`w-full px-4 py-3 rounded-xl border-2 font-bold transition-all text-sm ${
              mustReset
                ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200"
                : "border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300"
            } ${oidcOnly ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            {oidcOnly
              ? "Not used for OIDC-only"
              : mustReset
                ? "Must reset password"
                : "No reset required"}
          </button>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
            Account Status
          </label>
          <button
            type="button"
            onClick={() => onActiveChange(!active)}
            className={`w-full px-4 py-3 rounded-xl border-2 font-bold transition-all text-sm ${
              active
                ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                : "border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300"
            }`}
          >
            {active ? "Active" : "Inactive"}
          </button>
        </div>
      </div>
      <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-neutral-700 bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
        >
          Create
        </button>
      </div>
    </form>
  </div>
);

