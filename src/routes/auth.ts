import { hashPassword, verifyPassword } from "../lib/crypto-utils";
import { checkUserExists, createUser, getUserByEmail } from "../lib/db";
import {
  generateRandomUUID,
  getSessionCookie,
  setSessionCookie,
} from "../lib/utils";

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

  const user = await getUserByEmail(env, email);
  if (!user || !user.passwordHash || !user.passwordSalt)
    return Response.json({
      success: false,
      message: "Invalid credentials",
    });

  const valid = await verifyPassword(
    password,
    user.passwordSalt,
    user.passwordHash
  );
  if (!valid)
    return Response.json({
      success: false,
      message: "Invalid credentials",
    });

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

  // check if exists
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
    "session=; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
  );
  return resp;
}
