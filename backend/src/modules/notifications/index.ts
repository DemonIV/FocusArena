import type { FastifyPluginAsync } from 'fastify';
import { notificationsRoutes } from './notifications.routes';

export const notificationsModule: FastifyPluginAsync = async (fastify) => {
  await fastify.register(notificationsRoutes);
};

export {
  notifyStreakDanger,
  notifyWinback,
  notifyFriendRequest,
  notifyFriendAccepted,
  notifyReferralRedeemed,
  savePushToken,
  clearPushToken,
  setPushEnabled,
  sendExpoPush,
} from './notifications.service';
