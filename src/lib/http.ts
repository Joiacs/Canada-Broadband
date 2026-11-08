import "server-only";

export const CDN_CACHE = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";

export function json(data: unknown, init: ResponseInit & { cache?: boolean } = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  if (init.cache) headers.set("cache-control", CDN_CACHE);
  else if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function badRequest(message: string, details?: unknown) {
  return json({ error: message, details }, { status: 400 });
}

export function serverError(err: unknown) {
  console.error(err);
  return json({ error: "internal_error" }, { status: 500 });
}
