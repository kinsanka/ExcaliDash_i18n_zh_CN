export type PasswordPolicy = {
  minLength: number;
  maxLength: number;
  requiresComplexity: boolean;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  pattern?: RegExp;
  patternHtml?: string;
  requirementsText: string;
  validationMessage: string;
  translate?: (key: string, params?: Record<string, string | number>) => string;
};

export type PasswordPolicyResponse = Pick<
  PasswordPolicy,
  | "minLength"
  | "maxLength"
  | "requireUppercase"
  | "requireLowercase"
  | "requireNumber"
  | "requireSymbol"
>;

export type PasswordRequirement = {
  id: "minLength" | "uppercase" | "lowercase" | "number" | "symbol";
  label: string;
  ok: boolean;
};

const PASSWORD_POLICY_STORAGE_KEY = "excalidash-password-policy";

const DEFAULT_STRONG_POLICY: PasswordPolicyResponse = {
  minLength: 12,
  maxLength: 100,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
};

const DEFAULT_RELAXED_POLICY: PasswordPolicyResponse = {
  minLength: 8,
  maxLength: 100,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSymbol: false,
};


const buildPatternHtml = (policy: PasswordPolicyResponse): string => {
  const parts: string[] = [];
  if (policy.requireLowercase) parts.push("(?=.*[a-z])");
  if (policy.requireUppercase) parts.push("(?=.*[A-Z])");
  if (policy.requireNumber) parts.push("(?=.*\\d)");
  if (policy.requireSymbol) parts.push("(?=.*[^A-Za-z0-9])");
  return `${parts.join("")}.{${policy.minLength},${policy.maxLength}}`;
};

const buildPolicyMessage = (policy: PasswordPolicyResponse): string => {
  const requirements = [`at least ${policy.minLength} characters`];
  if (policy.requireUppercase) requirements.push("one uppercase letter");
  if (policy.requireLowercase) requirements.push("one lowercase letter");
  if (policy.requireNumber) requirements.push("one number");
  if (policy.requireSymbol) requirements.push("one symbol");
  return `Password must be ${requirements.join(", ")}`;
};

const buildRequirementsText = (policy: PasswordPolicyResponse): string => {
  const requirements = [`${policy.minLength}-${policy.maxLength} characters`];
  if (policy.requireUppercase) requirements.push("1 uppercase letter");
  if (policy.requireLowercase) requirements.push("1 lowercase letter");
  if (policy.requireNumber) requirements.push("1 number");
  if (policy.requireSymbol) requirements.push("1 symbol");
  return `${requirements.join(", ")}.`;
};

const normalizePolicy = (raw: Partial<PasswordPolicyResponse> | null | undefined): PasswordPolicyResponse | null => {
  if (!raw) return null;
  const minLength = Number(raw.minLength);
  const maxLength = Number(raw.maxLength);
  if (!Number.isFinite(minLength) || minLength <= 0) return null;
  if (!Number.isFinite(maxLength) || maxLength < minLength) return null;
  return {
    minLength,
    maxLength,
    requireUppercase: Boolean(raw.requireUppercase),
    requireLowercase: Boolean(raw.requireLowercase),
    requireNumber: Boolean(raw.requireNumber),
    requireSymbol: Boolean(raw.requireSymbol),
  };
};

const readCachedPolicy = (): PasswordPolicyResponse | null => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(PASSWORD_POLICY_STORAGE_KEY);
    if (!raw) return null;
    return normalizePolicy(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const cachePasswordPolicy = (policy: Partial<PasswordPolicyResponse> | null | undefined): void => {
  const normalized = normalizePolicy(policy);
  if (!normalized) return;
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(PASSWORD_POLICY_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // localStorage can be unavailable in restricted browser contexts.
  }
};

export const getPasswordPolicy = (opts?: {
  strong?: boolean;
  translate?: (key: string, params?: Record<string, string | number>) => string;
}): PasswordPolicy => {
  const strong = typeof opts?.strong === "boolean" ? opts.strong : true;
  const translate = opts?.translate;
  const base = strong ? readCachedPolicy() ?? DEFAULT_STRONG_POLICY : DEFAULT_RELAXED_POLICY;
  const requiresComplexity =
    base.requireUppercase || base.requireLowercase || base.requireNumber || base.requireSymbol;
  const patternHtml = buildPatternHtml(base);

  return {
    ...base,
    requiresComplexity,
    pattern: new RegExp(`^${patternHtml}$`),
    patternHtml,
    requirementsText: buildRequirementsText(base),
    validationMessage:
      translate && base.minLength === 12 && base.requireUppercase && base.requireLowercase && base.requireNumber && base.requireSymbol
        ? translate("password.strongMessage")
        : translate
          ? translate("password.atLeastCharacters", { count: base.minLength })
          : buildPolicyMessage(base),
    translate,
  };
};

export const getPasswordRequirements = (
  password: string,
  policy: PasswordPolicy
): PasswordRequirement[] => {
  const value = typeof password === "string" ? password : "";
  const requirements: PasswordRequirement[] = [
    {
      id: "minLength",
      label: policy.translate?.("password.atLeastCharacters", { count: policy.minLength }) ?? `At least ${policy.minLength} characters`,
      ok: value.length >= policy.minLength,
    },
  ];

  if (policy.requireUppercase) {
    requirements.push({ id: "uppercase", label: policy.translate?.("password.uppercase") ?? "One uppercase letter (A-Z)", ok: /[A-Z]/.test(value) });
  }
  if (policy.requireLowercase) {
    requirements.push({ id: "lowercase", label: policy.translate?.("password.lowercase") ?? "One lowercase letter (a-z)", ok: /[a-z]/.test(value) });
  }
  if (policy.requireNumber) {
    requirements.push({ id: "number", label: policy.translate?.("password.number") ?? "One number (0-9)", ok: /\d/.test(value) });
  }
  if (policy.requireSymbol) {
    requirements.push({ id: "symbol", label: policy.translate?.("password.symbol") ?? "One symbol", ok: /[^A-Za-z0-9]/.test(value) });
  }

  return requirements;
};

export const validatePassword = (password: string, policy: PasswordPolicy): string | null => {
  if (typeof password !== "string") return policy.validationMessage;
  if (password.length < policy.minLength) return policy.validationMessage;
  if (password.length > policy.maxLength)
    return policy.translate?.("password.maxLength", { count: policy.maxLength }) ?? `Password must be at most ${policy.maxLength} characters long`;
  if (policy.requireUppercase && !/[A-Z]/.test(password)) return policy.validationMessage;
  if (policy.requireLowercase && !/[a-z]/.test(password)) return policy.validationMessage;
  if (policy.requireNumber && !/\d/.test(password)) return policy.validationMessage;
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) return policy.validationMessage;
  return null;
};
