import type { FastifyInstance } from "fastify";
import { randomBytes, randomUUID } from "crypto";
import { hash, compare } from "bcryptjs";
import { Google } from "arctic";
import { getPrisma } from "@travelmate/database";
import {
  SignupRequestSchema,
  LoginRequestSchema,
  UserPreferencesSchema,
  MemoryEntrySchema,
  MemoryEntryInputSchema,
  type MemoryEntry,
} from "@travelmate/contracts";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
  requireAuth,
} from "../middleware/session.js";
import { rateLimit } from "../middleware/rate-limit.js";

const BCRYPT_ROUNDS = 12;

function cookieOpts(maxAge: number) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: Math.floor(maxAge / 1000),
  };
}

// SEC-7: Generate a 256-bit random session token — not a sequential cuid.
async function createSession(userId: string, prisma: ReturnType<typeof getPrisma>) {
  const id = randomBytes(32).toString("hex"); // 64-char hex = 256 bits of entropy
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);
  return prisma.session.create({ data: { id, userId, expiresAt } });
}

function getGoogle(): Google | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080"}/auth/google/callback`;
  return new Google(clientId, clientSecret, redirectUri);
}

export async function authRoutes(app: FastifyInstance) {
  const authRateLimit = rateLimit({ max: 10, windowMs: 60_000 });

  // ── POST /auth/signup ──────────────────────────────────────────────
  app.post("/auth/signup", { preHandler: [authRateLimit] }, async (request, reply) => {
    const parsed = SignupRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { email, password, name } = parsed.data;
    const prisma = getPrisma();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.code(409).send({ error: "An account with this email already exists" });
    }

    const passwordHash = await hash(password, BCRYPT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, passwordHash, name: name ?? null },
    });

    // SEC-7: Invalidate any stale sessions before creating a new one
    await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
    const session = await createSession(user.id, prisma);
    reply.setCookie(SESSION_COOKIE, session.id, cookieOpts(SESSION_MAX_AGE_MS));
    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  });

  // ── POST /auth/login ───────────────────────────────────────────────
  app.post("/auth/login", { preHandler: [authRateLimit] }, async (request, reply) => {
    const parsed = LoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const { email, password } = parsed.data;
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    // SEC-7: Delete prior sessions on login to prevent session fixation
    await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
    const session = await createSession(user.id, prisma);
    reply.setCookie(SESSION_COOKIE, session.id, cookieOpts(SESSION_MAX_AGE_MS));
    return { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl };
  });

  // ── POST /auth/logout ──────────────────────────────────────────────
  app.post("/auth/logout", async (request, reply) => {
    if (request.sessionId) {
      const prisma = getPrisma();
      await prisma.session.delete({ where: { id: request.sessionId } }).catch(() => {});
    }
    reply.setCookie(SESSION_COOKIE, "", cookieOpts(0));
    return { ok: true };
  });

  // ── GET /auth/me ───────────────────────────────────────────────────
  app.get("/auth/me", async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: "Not authenticated" });
    }
    return request.user;
  });

  // ── GET /auth/google ───────────────────────────────────────────────
  app.get("/auth/google", async (_request, reply) => {
    const google = getGoogle();
    if (!google) {
      return reply.code(501).send({ error: "Google OAuth is not configured" });
    }
    // SEC-4: Use crypto.randomBytes for PKCE — randomUUID() is only 36 chars,
    // below RFC 7636's 43-char minimum and not base64url encoded.
    const state = randomBytes(16).toString("hex");
    const codeVerifier = randomBytes(32).toString("base64url"); // 43+ chars, URL-safe
    const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "email", "profile"]);

    reply.setCookie("tm_oauth_state", state, cookieOpts(10 * 60 * 1000));
    reply.setCookie("tm_code_verifier", codeVerifier, cookieOpts(10 * 60 * 1000));
    return reply.redirect(url.toString());
  });

  // ── GET /auth/google/callback ──────────────────────────────────────
  // SEC-4: Wrapped in try/catch; profileRes.ok checked; verified_email required for account linking.
  app.get("/auth/google/callback", async (request, reply) => {
    const google = getGoogle();
    if (!google) {
      return reply.code(501).send({ error: "Google OAuth is not configured" });
    }

    const webUrl = process.env.CORS_ORIGIN ?? "http://localhost:3000";

    try {
      const { code, state } = request.query as Record<string, string>;
      const savedState = request.cookies.tm_oauth_state;
      const codeVerifier = request.cookies.tm_code_verifier;

      if (!code || !state || state !== savedState || !codeVerifier) {
        return reply.code(400).send({ error: "Invalid OAuth callback" });
      }

      const tokens = await google.validateAuthorizationCode(code, codeVerifier);
      const accessToken = tokens.accessToken();

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // SEC-4: Always check the upstream response status
      if (!profileRes.ok) {
        console.error(`[auth] Google profile fetch failed: ${profileRes.status}`);
        return reply.redirect(`${webUrl}/login?error=google_profile_failed`);
      }

      const profile = (await profileRes.json()) as {
        id: string;
        email: string;
        name?: string;
        picture?: string;
        verified_email?: boolean;
      };

      const prisma = getPrisma();

      let account = await prisma.account.findUnique({
        where: { provider_providerAccountId: { provider: "google", providerAccountId: profile.id } },
        include: { user: true },
      });

      let user;
      if (account) {
        user = account.user;
      } else {
        user = await prisma.user.findUnique({ where: { email: profile.email } });
        if (user) {
          // SEC-4: Only link to an existing account when Google confirms the email is verified.
          // An unverified Google email could be spoofed to take over a local account.
          if (!profile.verified_email) {
            return reply.redirect(`${webUrl}/login?error=google_email_unverified`);
          }
          await prisma.account.create({
            data: { userId: user.id, provider: "google", providerAccountId: profile.id },
          });
        } else {
          user = await prisma.user.create({
            data: {
              email: profile.email,
              name: profile.name ?? null,
              avatarUrl: profile.picture ?? null,
              accounts: {
                create: { provider: "google", providerAccountId: profile.id },
              },
            },
          });
        }
      }

      if (profile.picture && !user.avatarUrl) {
        await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: profile.picture } });
      }

      // SEC-7: Delete prior sessions before creating a new one
      await prisma.session.deleteMany({ where: { userId: user.id } }).catch(() => {});
      const session = await createSession(user.id, prisma);
      reply.setCookie(SESSION_COOKIE, session.id, cookieOpts(SESSION_MAX_AGE_MS));
      reply.setCookie("tm_oauth_state", "", cookieOpts(0));
      reply.setCookie("tm_code_verifier", "", cookieOpts(0));

      return reply.redirect(webUrl);
    } catch (err) {
      // SEC-4: Never let an unhandled OAuth error reach the user as a raw 500
      console.error("[auth] Google OAuth callback error:", err);
      return reply.redirect(`${webUrl}/login?error=oauth_failed`);
    }
  });

  // ── GET /auth/preferences ───────────────────────────────────────────
  app.get("/auth/preferences", { preHandler: [requireAuth] }, async (request) => {
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user!.id },
      select: { preferences: true },
    });
    return UserPreferencesSchema.parse(user.preferences ?? {});
  });

  // ── PUT /auth/preferences ────────────────────────────────────────
  app.put("/auth/preferences", { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = UserPreferencesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const prisma = getPrisma();
    await prisma.user.update({
      where: { id: request.user!.id },
      data: { preferences: JSON.parse(JSON.stringify(parsed.data)) },
    });
    return parsed.data;
  });

  // ── GET /auth/trips ────────────────────────────────────────────────
  app.get("/auth/trips", { preHandler: [requireAuth] }, async (request) => {
    const prisma = getPrisma();
    const trips = await prisma.trip.findMany({
      where: { userId: request.user!.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, brief: true, createdAt: true },
    });
    return trips;
  });

  // ── GET /auth/trips/:id ───────────────────────────────────────────
  app.get<{ Params: { id: string } }>("/auth/trips/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const prisma = getPrisma();
    const trip = await prisma.trip.findUnique({
      where: { id: request.params.id },
    });
    if (!trip || trip.userId !== request.user!.id) {
      return reply.code(404).send({ error: "Trip not found" });
    }
    return trip;
  });

  // ── GET /auth/memories ──────────────────────────────────────────────
  app.get("/auth/memories", { preHandler: [requireAuth] }, async (request) => {
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user!.id },
      select: { memories: true },
    });
    const raw = user.memories as unknown[];
    return Array.isArray(raw) ? raw : [];
  });

  // ── PUT /auth/memories ──────────────────────────────────────────────
  app.put("/auth/memories", { preHandler: [requireAuth] }, async (request, reply) => {
    const body = request.body as { memories?: unknown[] };
    if (!Array.isArray(body?.memories)) {
      return reply.code(400).send({ error: "Expected { memories: [...] }" });
    }
    if (body.memories.length > 50) {
      return reply.code(400).send({ error: "Maximum 50 memories" });
    }
    const parsed: MemoryEntry[] = [];
    for (const item of body.memories) {
      const result = MemoryEntrySchema.safeParse(item);
      if (!result.success) {
        return reply.code(400).send({ error: result.error.issues[0]?.message ?? "Invalid memory entry" });
      }
      parsed.push(result.data);
    }
    const prisma = getPrisma();
    await prisma.user.update({
      where: { id: request.user!.id },
      data: { memories: JSON.parse(JSON.stringify(parsed)) },
    });
    return parsed;
  });

  // ── POST /auth/memories ─────────────────────────────────────────────
  app.post("/auth/memories", { preHandler: [requireAuth] }, async (request, reply) => {
    const parsed = MemoryEntryInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    }
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user!.id },
      select: { memories: true },
    });
    const existing = Array.isArray(user.memories) ? (user.memories as MemoryEntry[]) : [];
    if (existing.length >= 50) {
      return reply.code(400).send({ error: "Maximum 50 memories reached" });
    }
    const now = new Date().toISOString();
    const entry: MemoryEntry = {
      id: randomUUID(),
      category: parsed.data.category,
      fact: parsed.data.fact,
      source: "",
      createdAt: now,
      updatedAt: now,
    };
    const updated = [...existing, entry];
    await prisma.user.update({
      where: { id: request.user!.id },
      data: { memories: JSON.parse(JSON.stringify(updated)) },
    });
    return entry;
  });

  // ── DELETE /auth/memories/:id ───────────────────────────────────────
  app.delete<{ Params: { id: string } }>("/auth/memories/:id", { preHandler: [requireAuth] }, async (request, reply) => {
    const prisma = getPrisma();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: request.user!.id },
      select: { memories: true },
    });
    const existing = Array.isArray(user.memories) ? (user.memories as MemoryEntry[]) : [];
    const filtered = existing.filter((m) => m.id !== request.params.id);
    if (filtered.length === existing.length) {
      return reply.code(404).send({ error: "Memory not found" });
    }
    await prisma.user.update({
      where: { id: request.user!.id },
      data: { memories: JSON.parse(JSON.stringify(filtered)) },
    });
    return { ok: true };
  });
}
