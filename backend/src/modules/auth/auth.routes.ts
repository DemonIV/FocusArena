import { randomUUID } from 'node:crypto';
import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify';
import type { JwtPayload } from './auth.schema';
import { captureException } from '../../shared/observability';
import {
  RegisterBodySchema,
  LoginBodySchema,
  RefreshBodySchema,
} from './auth.schema';
import {
  createAuthUser,
  signInUser,
  getUserById,
  storeRefreshToken,
  validateRefreshToken,
  deleteRefreshToken,
  deleteAllRefreshTokens,
  deleteAuthUser,
} from './auth.service';
import { track } from '../../shared/observability';

// Augment @fastify/jwt so request.user is typed throughout the app
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

// ─── Token TTLs ───────────────────────────────────────────────

const ACCESS_TTL = '15m';
const REFRESH_TTL = '7d';

// ─── Auth Guard (preHandler hook) ────────────────────────────

/**
 * Fastify preHandler that enforces a valid access token.
 * Import and use as: { preHandler: authGuard }
 */
export const authGuard: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  try {
    await request.jwtVerify();
    if (request.user.type !== 'access') {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token type' });
    }
  } catch {
    return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};

// ─── Route Plugin ─────────────────────────────────────────────

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Helpers ──────────────────────────────────────────────────

  /**
   * Sign an access/refresh pair for ONE session. Every sign-in gets its own
   * session id so devices don't evict each other (see storeRefreshToken).
   */
  function signTokenPair(userId: string, email: string, sessionId: string) {
    const base = { sub: userId, email, sid: sessionId };
    const accessToken = fastify.jwt.sign(
      { ...base, type: 'access' } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
      { expiresIn: ACCESS_TTL },
    );
    const refreshToken = fastify.jwt.sign(
      { ...base, type: 'refresh' } satisfies Omit<JwtPayload, 'iat' | 'exp'>,
      { expiresIn: REFRESH_TTL },
    );
    return { accessToken, refreshToken };
  }

  // ── POST /register ────────────────────────────────────────────

  fastify.post('/register', async (request, reply) => {
    const parsed = RegisterBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }
    const { email, password, username } = parsed.data;

    try {
      const authUser = await createAuthUser(email, password, username);
      // The DB trigger `handle_new_user` has already created the users-table row.
      const user = await getUserById(authUser.id);
      const sid = randomUUID();
      const { accessToken, refreshToken } = signTokenPair(user.id, user.email, sid);
      await storeRefreshToken(user.id, refreshToken, sid);

      track(user.id, 'user_registered', { username: user.username });

      return reply.code(201).send({ accessToken, refreshToken, user });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (/already registered|already exists|duplicate/i.test(msg)) {
        return reply.code(409).send({ error: 'Conflict', message: 'Email or username already in use' });
      }
      request.log.error(err, 'register failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /login ───────────────────────────────────────────────

  fastify.post('/login', async (request, reply) => {
    const parsed = LoginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }
    const { email, password } = parsed.data;

    try {
      const authUser = await signInUser(email, password);
      const user = await getUserById(authUser.id);
      // A fresh session per sign-in — never touches the sessions this account
      // already has on other devices.
      const sid = randomUUID();
      const { accessToken, refreshToken } = signTokenPair(user.id, user.email, sid);
      await storeRefreshToken(user.id, refreshToken, sid);

      return reply.send({ accessToken, refreshToken, user });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (/invalid login credentials/i.test(msg)) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
      }
      request.log.error(err, 'login failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── POST /refresh ─────────────────────────────────────────────

  fastify.post('/refresh', async (request, reply) => {
    const parsed = RefreshBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation error',
        details: parsed.error.flatten(),
      });
    }
    const { refreshToken } = parsed.data;

    try {
      // 1. Verify JWT signature & expiry
      const payload = fastify.jwt.verify<JwtPayload>(refreshToken);

      if (payload.type !== 'refresh') {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token type' });
      }

      // 2. Compare against Redis (token rotation guard), scoped to this session
      const isValid = await validateRefreshToken(payload.sub, refreshToken, payload.sid);
      if (!isValid) {
        // Possible reuse — revoke ONLY this session. Wiping every session here
        // is what used to let one stale device kill the account's live logins.
        await deleteRefreshToken(payload.sub, payload.sid);
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Refresh token is invalid or has already been used',
        });
      }

      // 3. Issue a new pair and rotate the entry, keeping the same session.
      //    Legacy tokens (no sid) are migrated onto a session key here.
      const sid = payload.sid ?? randomUUID();
      const { accessToken: newAccess, refreshToken: newRefresh } = signTokenPair(
        payload.sub,
        payload.email,
        sid,
      );
      await storeRefreshToken(payload.sub, newRefresh, sid);
      if (!payload.sid) await deleteRefreshToken(payload.sub);

      return reply.send({ accessToken: newAccess, refreshToken: newRefresh });
    } catch {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
    }
  });

  // ── POST /logout ──────────────────────────────────────────────

  fastify.post('/logout', { preHandler: authGuard }, async (request, reply) => {
    // Sign out this device only — other devices keep their sessions.
    await deleteRefreshToken(request.user.sub, request.user.sid);
    return reply.send({ message: 'Logged out successfully' });
  });

  // ── DELETE /account ───────────────────────────────────────────
  // Permanent account deletion (App Store / Play Store requirement).

  fastify.delete('/account', { preHandler: authGuard }, async (request, reply) => {
    const userId = request.user.sub;
    try {
      track(userId, 'account_deleted');
      await deleteAuthUser(userId);
      // Every device, not just the one that asked.
      await deleteAllRefreshTokens(userId);
      return reply.send({ message: 'Account deleted' });
    } catch (err: unknown) {
      // Already gone (double-tap / retry with a still-valid JWT) — the
      // desired end state holds, so report success instead of a 500.
      const msg = err instanceof Error ? err.message : '';
      if (/user not found/i.test(msg)) {
        await deleteAllRefreshTokens(userId);
        return reply.send({ message: 'Account deleted' });
      }
      request.log.error(err, 'account deletion failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
