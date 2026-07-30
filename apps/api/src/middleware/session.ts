import type { FastifyRequest, FastifyReply } from "fastify";
import { getPrisma } from "@travelmate/database";
import type { AuthUser } from "@travelmate/contracts";

declare module "fastify" {
  interface FastifyRequest {
    user: AuthUser | null;
    sessionId: string | null;
  }
}

const SESSION_COOKIE = "tm_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export { SESSION_COOKIE, SESSION_MAX_AGE_MS };

export async function sessionMiddleware(request: FastifyRequest, _reply: FastifyReply) {
  request.user = null;
  request.sessionId = null;

  const sessionId = request.cookies[SESSION_COOKIE];
  if (!sessionId) return;

  const prisma = getPrisma();
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    }
    return;
  }

  request.user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    avatarUrl: session.user.avatarUrl,
  };
  request.sessionId = session.id;
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    reply.code(401).send({ error: "Authentication required" });
  }
}
