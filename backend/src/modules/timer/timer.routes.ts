import type { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import {
  StartTimerSchema,
  CreateSubjectSchema,
  UpdateSubjectSchema,
  SessionQuerySchema,
} from './timer.schema';
import {
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  getTimerStatus,
  getSessions,
  getStats,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from './timer.service';
import { getSocketServer } from '../../websocket';

export const timerRoutes: FastifyPluginAsync = async (fastify) => {
  // All timer routes require authentication
  fastify.addHook('preHandler', authGuard);

  // ── Timer Control ─────────────────────────────────────────

  /** POST /timer/start */
  fastify.post('/start', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;

    const parsed = StartTimerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }
    const { duration, subjectId } = parsed.data;

    try {
      const state = await startTimer(userId, duration, subjectId);

      // Notify room-mates via Socket.io (best-effort)
      try {
        const io = getSocketServer();
        io.to(`user:${userId}`).emit('timer:started', {
          sessionId: state.sessionId,
          startedAt: new Date(state.startTime).toISOString(),
        });
      } catch {
        // socket server may not be connected yet — ignore
      }

      return reply.code(201).send({ state });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'TIMER_ACTIVE') return reply.code(409).send({ error: 'Conflict', message: e.message });
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      request.log.error(err, 'timer/start failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** POST /timer/pause */
  fastify.post('/pause', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const state = await pauseTimer(userId);
      return reply.send({ state });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NO_TIMER') return reply.code(404).send({ error: 'Not Found', message: e.message });
      if (e.code === 'ALREADY_PAUSED') return reply.code(409).send({ error: 'Conflict', message: e.message });
      request.log.error(err, 'timer/pause failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** POST /timer/resume */
  fastify.post('/resume', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const state = await resumeTimer(userId);
      return reply.send({ state });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NO_TIMER') return reply.code(404).send({ error: 'Not Found', message: e.message });
      if (e.code === 'NOT_PAUSED') return reply.code(409).send({ error: 'Conflict', message: e.message });
      request.log.error(err, 'timer/resume failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** POST /timer/stop */
  fastify.post('/stop', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const result = await stopTimer(userId);
      return reply.send({ result });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NO_TIMER') return reply.code(404).send({ error: 'Not Found', message: e.message });
      request.log.error(err, 'timer/stop failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** GET /timer/status */
  fastify.get('/status', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const status = await getTimerStatus(userId);
      return reply.send(status);
    } catch (err) {
      request.log.error(err, 'timer/status failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── Sessions ──────────────────────────────────────────────

  /** GET /timer/sessions */
  fastify.get('/sessions', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;

    const parsed = SessionQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const result = await getSessions(userId, parsed.data);
      return reply.send(result);
    } catch (err) {
      request.log.error(err, 'timer/sessions failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** GET /timer/stats */
  fastify.get('/stats', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const stats = await getStats(userId);
      return reply.send(stats);
    } catch (err) {
      request.log.error(err, 'timer/stats failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── Subjects ──────────────────────────────────────────────

  /** GET /timer/subjects */
  fastify.get('/subjects', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const subjects = await getSubjects(userId);
      return reply.send({ subjects });
    } catch (err) {
      request.log.error(err, 'timer/subjects GET failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** POST /timer/subjects */
  fastify.post('/subjects', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;

    const parsed = CreateSubjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const subject = await createSubject(userId, parsed.data);
      return reply.code(201).send({ subject });
    } catch (err) {
      request.log.error(err, 'timer/subjects POST failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** PATCH /timer/subjects/:id */
  fastify.patch('/subjects/:id', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    const parsed = UpdateSubjectSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      const subject = await updateSubject(userId, id, parsed.data);
      return reply.send({ subject });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      request.log.error(err, 'timer/subjects PATCH failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** DELETE /timer/subjects/:id */
  fastify.delete('/subjects/:id', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { id } = request.params as { id: string };

    try {
      await deleteSubject(userId, id);
      return reply.code(204).send();
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      request.log.error(err, 'timer/subjects DELETE failed');
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
