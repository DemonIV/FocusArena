import type {
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
  preHandlerHookHandler,
} from 'fastify';
import type { JwtPayload } from './auth.schema';
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
} from './auth.service';

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

  function signTokenPair(userId: string, email: string) {
    const base = { sub: userId, email };
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
      const { accessToken, refreshToken } = signTokenPair(user.id, user.email);
      await storeRefreshToken(user.id, refreshToken);

      return reply.code(201).send({ accessToken, refreshToken, user });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (/already registered|already exists|duplicate/i.test(msg)) {
        return reply.code(409).send({ error: 'Conflict', message: 'Email or username already in use' });
      }
      request.log.error(err, 'register failed');
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
      const { accessToken, refreshToken } = signTokenPair(user.id, user.email);
      await storeRefreshToken(user.id, refreshToken);

      return reply.send({ accessToken, refreshToken, user });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (/invalid login credentials/i.test(msg)) {
        return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid email or password' });
      }
      request.log.error(err, 'login failed');
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

      // 2. Compare against Redis (token rotation guard)
      const isValid = await validateRefreshToken(payload.sub, refreshToken);
      if (!isValid) {
        // Possible token reuse attack — wipe the stored token
        await deleteRefreshToken(payload.sub);
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Refresh token is invalid or has already been used',
        });
      }

      // 3. Issue new pair and rotate Redis entry
      const { accessToken: newAccess, refreshToken: newRefresh } = signTokenPair(payload.sub, payload.email);
      await storeRefreshToken(payload.sub, newRefresh);

      return reply.send({ accessToken: newAccess, refreshToken: newRefresh });
    } catch {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired refresh token' });
    }
  });

  // ── POST /logout ──────────────────────────────────────────────

  fastify.post('/logout', { preHandler: authGuard }, async (request, reply) => {
    await deleteRefreshToken(request.user.sub);
    return reply.send({ message: 'Logged out successfully' });
  });
};
