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

export function rateLimit(opts: { max: number; windowMs: number }) {
  return async function rateLimitHandler(request: FastifyRequest, reply: FastifyReply) {
    const ip = request.ip;
    const now = Date.now();
    let win = store.get(ip);
    if (!win || win.resetAt <= now) {
      win = { count: 0, resetAt: now + opts.windowMs };
      store.set(ip, win);
    }
    win.count++;
    if (win.count > opts.max) {
      const retryAfter = Math.ceil((win.resetAt - now) / 1000);
      reply.header("Retry-After", retryAfter);
      return reply.code(429).send({ error: "Too many requests, please try again later" });
    }
  };
}
