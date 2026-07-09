import type { FastifyPluginAsync } from 'fastify';
import { authGuard } from '../auth';
import type { JwtPayload } from '../auth/auth.schema';
import { captureException, track } from '../../shared/observability';
import {
  StartTimerSchema,
  StopTimerSchema,
  CreateSubjectSchema,
  UpdateSubjectSchema,
  SessionQuerySchema,
  MonthlyQuerySchema,
  SetTimezoneSchema,
} from './timer.schema';
import { areFriends } from '../friends';
import {
  startTimer,
  pauseTimer,
  resumeTimer,
  stopTimer,
  rescueSession,
  getTimerStatus,
  getSessions,
  getStats,
  getActivityHeatmap,
  getMonthlyStats,
  getGhost,
  getStudyDNA,
  getWeeklyChallenge,
  claimWeeklyReward,
  setUserTimezone,
  getSubjectStats,
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
      captureException(err, { method: request.method, url: request.url });
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
      request.log.error(err, 'timer/pause failed');
      captureException(err, { method: request.method, url: request.url });
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
      request.log.error(err, 'timer/resume failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** POST /timer/stop */
  fastify.post('/stop', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    // Distraction telemetry is optional — an empty/missing body scores on
    // completion alone (safe default for older clients).
    const parsed = StopTimerSchema.safeParse(request.body ?? {});
    const telemetry = parsed.success ? parsed.data : { exits: 0, awayMs: 0, pauses: 0 };
    try {
      const result = await stopTimer(userId, telemetry);
      return reply.send({ result });
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NO_TIMER') return reply.code(404).send({ error: 'Not Found', message: e.message });
      request.log.error(err, 'timer/stop failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** POST /timer/rescue — pay coins to save a strict-mode session */
  fastify.post('/rescue', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const result = await rescueSession(userId);
      track(userId, 'strict_session_rescued', { cost: result.cost });
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NO_TIMER') return reply.code(404).send({ error: 'Not Found', message: e.message });
      if (e.code === 'INSUFFICIENT_COINS') return reply.code(402).send({ error: 'insufficient_coins' });
      request.log.error(err, 'timer/rescue failed');
      captureException(err, { method: request.method, url: request.url });
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
      captureException(err, { method: request.method, url: request.url });
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
      captureException(err, { method: request.method, url: request.url });
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
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** GET /timer/heatmap?days=30 — daily focus minutes for the activity calendar */
  fastify.get('/heatmap', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    const { days } = request.query as { days?: string };
    const parsedDays = days ? parseInt(days, 10) : 30;
    try {
      const heatmap = await getActivityHeatmap(userId, Number.isFinite(parsedDays) ? parsedDays : 30);
      return reply.send(heatmap);
    } catch (err) {
      request.log.error(err, 'timer/heatmap failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /timer/monthly?month=YYYY-MM&userId=…
   * Calendar-month day-by-day + per-subject stats. Own stats by default;
   * another user's require an accepted friendship (403 otherwise).
   */
  fastify.get('/monthly', async (request, reply) => {
    const { sub: callerId } = request.user as JwtPayload;

    const parsed = MonthlyQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }
    const month = parsed.data.month ?? new Date().toISOString().slice(0, 7);
    const targetId = parsed.data.userId ?? callerId;

    try {
      if (targetId !== callerId && !(await areFriends(callerId, targetId))) {
        return reply.code(403).send({ error: 'Forbidden', message: 'Stats are visible to friends only' });
      }
      const stats = await getMonthlyStats(targetId, month);
      return reply.send(stats);
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'NOT_FOUND') return reply.code(404).send({ error: 'Not Found', message: e.message });
      request.log.error(err, 'timer/monthly failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** GET /timer/ghost — race vs. yesterday-you at the same point in the day */
  fastify.get('/ghost', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const ghost = await getGhost(userId);
      return reply.send(ghost);
    } catch (err) {
      request.log.error(err, 'timer/ghost failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** GET /timer/dna — shareable "Study DNA" personality snapshot */
  fastify.get('/dna', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const dna = await getStudyDNA(userId);
      return reply.send(dna);
    } catch (err) {
      request.log.error(err, 'timer/dna failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** GET /timer/challenge — weekly personal goal + friend ranking */
  fastify.get('/challenge', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const challenge = await getWeeklyChallenge(userId);
      return reply.send(challenge);
    } catch (err) {
      request.log.error(err, 'timer/challenge failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** POST /timer/challenge/claim — claim this week's personal-goal coin reward */
  fastify.post('/challenge/claim', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const result = await claimWeeklyReward(userId);
      track(userId, 'weekly_reward_claimed', { coins: result.coinsAwarded });
      return reply.send(result);
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'GOAL_NOT_REACHED') return reply.code(409).send({ error: 'goal_not_reached' });
      if (e.code === 'ALREADY_CLAIMED') return reply.code(409).send({ error: 'already_claimed' });
      request.log.error(err, 'timer/challenge/claim failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** PUT /timer/timezone — device reports its UTC offset for local day/week windows */
  fastify.put('/timezone', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;

    const parsed = SetTimezoneSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Validation error', details: parsed.error.flatten() });
    }

    try {
      await setUserTimezone(userId, parsed.data.offsetMinutes);
      return reply.send({ ok: true });
    } catch (err) {
      request.log.error(err, 'timer/timezone failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // ── Subjects ──────────────────────────────────────────────

  /** GET /timer/subjects — list of active subjects (no stats) */
  fastify.get('/subjects', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const subjects = await getSubjects(userId);
      return reply.send({ subjects });
    } catch (err) {
      request.log.error(err, 'timer/subjects GET failed');
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  /** GET /timer/subjects/stats — subjects enriched with total focus time */
  fastify.get('/subjects/stats', async (request, reply) => {
    const { sub: userId } = request.user as JwtPayload;
    try {
      const subjects = await getSubjectStats(userId);
      return reply.send({ subjects });
    } catch (err) {
      request.log.error(err, 'timer/subjects/stats GET failed');
      captureException(err, { method: request.method, url: request.url });
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
    } catch (err: unknown) {
      const e = err as { code?: string; message: string };
      if (e.code === 'LIMIT_REACHED') {
        return reply.code(402).send({ error: 'Payment Required', code: 'LIMIT_REACHED', message: e.message });
      }
      request.log.error(err, 'timer/subjects POST failed');
      captureException(err, { method: request.method, url: request.url });
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
      captureException(err, { method: request.method, url: request.url });
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
      captureException(err, { method: request.method, url: request.url });
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
};
