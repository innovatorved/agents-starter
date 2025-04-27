const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";
const PBKDF2_KEYLEN = 32; // 256 bits

// Generate a new salt and password hash
export async function hashPassword(
  password: string
): Promise<{ salt: string; hash: string }> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const rawKey = await crypto.subtle.exportKey("raw", key);
  return {
    salt: toHex(salt),
    hash: toHex(new Uint8Array(rawKey)),
  };
}

// Verify password using salt and stored hash
export async function verifyPassword(
  password: string,
  saltHex: string,
  hashHex: string
): Promise<boolean> {
  const enc = new TextEncoder();
  const salt = fromHex(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const rawKey = await crypto.subtle.exportKey("raw", key);
  const rawKeyHex = toHex(new Uint8Array(rawKey));
  // Use a timing safe equality!
  return timingSafeEqualHex(hashHex, rawKeyHex);
}

// Utils
function toHex(b: Uint8Array): string {
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((x) => parseInt(x, 16)));
}

// timing safe compare
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
