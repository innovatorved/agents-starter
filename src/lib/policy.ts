export async function getAuthPolicies(env: Env): Promise<any> {
  const raw = await env.CACHE_CHAT.get("auth-policies");
  if (!raw) throw new Error("Auth policies not found in KV");
  // Cleanup: remove JS-style comments if any
  return JSON.parse(raw.replace(/\/\/.*$/gm, ""));
}

export function isPasswordValid(password: string, policy: any): boolean {
  if (password.length < policy.minLength) return false;
  if (policy.maxLength && password.length > policy.maxLength) return false;
  if (policy.requireUppercase && !/[A-Z]/.test(password)) return false;
  if (policy.requireLowercase && !/[a-z]/.test(password)) return false;
  if (policy.requireNumber && !/[0-9]/.test(password)) return false;
  if (
    policy.requireSpecial &&
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  )
    return false;
  return true;
}

export function isEmailAllowed(email: string, allowed: string[]): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return allowed.includes("*") || allowed.includes(domain);
}
