import type { FastifyRequest, FastifyReply } from "fastify";

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

const CLEANUP_INTERVAL = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of store) {
    if (win.resetAt <= now) store.delete(key);
  }
}, CLEANUP_INTERVAL).unref();

/**
 * SEC-6: Rate limiter with per-user and per-IP keying.
 * When keyBy is "user", the key is request.user.id (when logged in) or the IP
 * as fallback — prevents a single user from cycling IPs to bypass limits.
 */
export function rateLimit(opts: { max: number; windowMs: number; keyBy?: "ip" | "user" }) {
  return async function rateLimitHandler(request: FastifyRequest, reply: FastifyReply) {
    const key =
      opts.keyBy === "user"
        ? (request.user?.id ?? request.ip)
        : request.ip;

    const now = Date.now();
    let win = store.get(key);
    if (!win || win.resetAt <= now) {
      win = { count: 0, resetAt: now + opts.windowMs };
      store.set(key, win);
    }
    win.count++;
    if (win.count > opts.max) {
      const retryAfter = Math.ceil((win.resetAt - now) / 1000);
      reply.header("Retry-After", retryAfter);
      return reply.code(429).send({ error: "Too many requests, please try again later" });
    }
  };
}
