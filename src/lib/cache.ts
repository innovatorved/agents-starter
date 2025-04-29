export async function kvGet<T>(env: Env, key: string): Promise<T | null> {
  const value = await env.CACHE_CHAT.get(key);
  return value ? (JSON.parse(value) as T) : null;
}

export async function kvSet<T>(env: Env, key: string, value: T, ttl = 300) {
  await env.CACHE_CHAT.put(key, JSON.stringify(value), { expirationTtl: ttl });
}

export async function kvDel(env: Env, key: string) {
  await env.CACHE_CHAT.delete(key);
}
