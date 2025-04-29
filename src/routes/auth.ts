import { hashPassword, verifyPassword } from "../lib/crypto-utils";
import { checkUserExists, createUser, getUserByEmail } from "../lib/db";
import {
  generateRandomUUID,
  getSessionCookie,
  setSessionCookie,
} from "../lib/utils";

import {
  getAuthPolicies,
  isPasswordValid,
  isEmailAllowed,
} from "../lib/policy";

const getLoginAttemptsKey = (email: string) => `login-attempts:${email}`;
const getLockoutKey = (email: string) => `login-lockout:${email}`;

export async function checkAuthenticatedUserRoute(request: Request, env: Env) {
  const sess = getSessionCookie(request);
  if (sess) {
    try {
      const session = JSON.parse(atob(sess));
      if (session.userId) return Response.json({ authenticated: true });
    } catch {}
  }
  return Response.json({ authenticated: false });
}

export async function loginUserRoute(request: Request, env: Env) {
  if (request.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });

  const { email, password } = (await request.json()) as {
    email: string;
    password: string;
  };
  if (!email || !password)
    return Response.json({
      success: false,
      message: "Both fields required",
    });

  // 1. Load policies from KV
  const policies = await getAuthPolicies(env);

  // 2. Check lockout
  const lockoutKey = getLockoutKey(email);
  const isLocked = await env.CACHE_CHAT.get(lockoutKey);
  if (isLocked) {
    return Response.json({
      success: false,
      message: `Account locked due to failed attempts. Try again later.`,
      locked: true,
    });
  }

  // 3. Lookup user
  const user = await getUserByEmail(env, email);
  if (!user || !user.passwordHash || !user.passwordSalt) {
    await recordFailedLogin(env, email, policies);
    return Response.json({ success: false, message: "Invalid credentials" });
  }

  const valid = await verifyPassword(
    password,
    user.passwordSalt,
    user.passwordHash,
  );
  if (!valid) {
    await recordFailedLogin(env, email, policies);
    return Response.json({ success: false, message: "Invalid credentials" });
  }

  // 4. If login succeeds, reset attempts
  await env.CACHE_CHAT.delete(getLoginAttemptsKey(email));
  await env.CACHE_CHAT.delete(getLockoutKey(email));

  // 5. Normal response
  const resp = Response.json({ success: true });
  resp.headers.set("Set-Cookie", setSessionCookie(user.userId));
  return resp;
}

export async function registerUserRoute(request: Request, env: Env) {
  if (request.method !== "POST")
    return new Response("Method Not Allowed", { status: 405 });
  const { email, password } = (await request.json()) as {
    email: string;
    password: string;
  };
  if (!email || !password)
    return Response.json({
      success: false,
      message: "Both fields required",
    });

  // 1. Load policies
  const policies = await getAuthPolicies(env);

  // 2. Email domain
  if (
    policies.registration?.allowedEmailDomains &&
    !isEmailAllowed(email, policies.registration.allowedEmailDomains)
  ) {
    return Response.json({
      success: false,
      message: "Email domain not allowed by policy",
    });
  }

  // 3. Password policy
  if (policies.password && !isPasswordValid(password, policies.password)) {
    return Response.json({
      success: false,
      message: "Password does not meet policy requirements",
    });
  }

  // ...as before
  const exists = await checkUserExists(env, email);
  if (exists)
    return Response.json({ success: false, message: "Already registered" });

  const { salt, hash } = await hashPassword(password);
  const userId = generateRandomUUID();
  await createUser(env, userId, email, hash, salt);

  const resp = Response.json({ success: true });
  resp.headers.set("Set-Cookie", setSessionCookie(userId));
  return resp;
}

export function logoutUserRoute(request: Request, env: Env) {
  const resp = Response.json({ success: true });
  resp.headers.set(
    "Set-Cookie",
    "session=; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  );
  return resp;
}

async function recordFailedLogin(env: Env, email: string, policies: any) {
  const attemptsKey = getLoginAttemptsKey(email);
  // Stringify integer just in case
  let attempts = parseInt((await env.CACHE_CHAT.get(attemptsKey)) ?? "0", 10);
  attempts += 1;

  // Store incremented attempts, expire after lockout period.
  await env.CACHE_CHAT.put(attemptsKey, attempts.toString(), {
    expirationTtl: 60 * (policies.login.lockoutMinutes || 10),
  });
  // If over limit, set lockout
  if (attempts >= policies.login.maxAttempts) {
    await env.CACHE_CHAT.put(getLockoutKey(email), "locked", {
      expirationTtl: 60 * (policies.login.lockoutMinutes || 10),
    });
  }
}
