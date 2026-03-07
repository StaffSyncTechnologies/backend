import { SmsService } from './sms.service';
import { WhatsAppService } from './whatsapp.service';
import { ExpoPushService, PushNotificationOptions } from './expo-push.service';
import { EmailService } from './email.service';
import { prisma } from '../../lib/prisma';

export type NotificationChannel = 'push' | 'sms' | 'whatsapp' | 'email';

export interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
  channels?: NotificationChannel[];
  preferenceType?: string; // Used to check user notification preferences
  categoryId?: string; // Expo notification category for interactive actions
}

export interface UserNotificationPreferences {
  push: boolean;
  sms: boolean;
  whatsapp: boolean;
  email: boolean;
}

export class NotificationService {
  static async send(payload: NotificationPayload): Promise<{
    push?: string;
    sms?: string;
    whatsapp?: string;
    email?: string;
    inApp?: string;
  }> {
    const { userId, title, body, type, data, channels = ['push'], preferenceType, categoryId } = payload;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        organizationId: true,
        notificationPreferences: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check user notification preferences if preferenceType is provided
    const enabledChannels = new Set(channels);
    if (preferenceType && user.notificationPreferences.length > 0) {
      for (const pref of user.notificationPreferences) {
        if (pref.notificationType === preferenceType && !pref.enabled) {
          const channelMap: Record<string, NotificationChannel> = {
            PUSH: 'push',
            SMS: 'sms',
            WHATSAPP: 'whatsapp',
            EMAIL: 'email',
          };
          const channel = channelMap[pref.channel];
          if (channel) enabledChannels.delete(channel);
        }
      }
    }

    const results: Record<string, string> = {};

    // Store in-app notification
    const notification = await prisma.notification.create({
      data: {
        userId,
        organizationId: user.organizationId,
        title,
        message: body,
        type,
        channel: 'PUSH',
      },
    });
    results.inApp = notification.id;

    // Get user's push tokens if push notification requested
    if (enabledChannels.has('push')) {
      const pushTokens = await this.getUserPushTokens(userId);
      if (pushTokens.length > 0) {
        try {
          const tickets = await ExpoPushService.sendBulk({
            pushTokens,
            title,
            body,
            data: { ...data, notificationId: notification.id },
            ...(categoryId && { categoryId }),
          });
          if (tickets.length > 0 && 'id' in tickets[0]) {
            results.push = tickets[0].id;
          }
        } catch (error) {
          console.error('Push notification failed:', error);
        }
      }
    }

    // Send SMS if requested and phone available
    if (enabledChannels.has('sms') && user.phone) {
      try {
        results.sms = await SmsService.send({ to: user.phone, message: `${title}: ${body}` });
      } catch (error) {
        console.error('SMS notification failed:', error);
      }
    }

    // Send WhatsApp if requested and phone available
    if (enabledChannels.has('whatsapp') && user.phone) {
      try {
        results.whatsapp = await WhatsAppService.send({ to: user.phone, message: `*${title}*\n\n${body}` });
      } catch (error) {
        console.error('WhatsApp notification failed:', error);
      }
    }

    // Send Email if requested
    if (enabledChannels.has('email') && user.email) {
      try {
        results.email = await EmailService.sendNotification(user.email, title, body, user.fullName);
      } catch (error) {
        console.error('Email notification failed:', error);
      }
    }

    return results;
  }

  static async sendToMultiple(
    userIds: string[],
    payload: Omit<NotificationPayload, 'userId'>
  ): Promise<void> {
    await Promise.allSettled(
      userIds.map(userId => this.send({ ...payload, userId }))
    );
  }

  static async getUserPushTokens(userId: string): Promise<string[]> {
    const devices = await prisma.deviceToken.findMany({
      where: { userId, isActive: true },
      select: { token: true },
    });

    return devices.map(d => d.token);
  }

  static async registerPushToken(
    userId: string, 
    pushToken: string, 
    platform: string = 'expo',
    deviceId?: string
  ): Promise<void> {
    if (!ExpoPushService.isValidPushToken(pushToken)) {
      throw new Error('Invalid push token');
    }

    await prisma.deviceToken.upsert({
      where: { userId_token: { userId, token: pushToken } },
      update: { isActive: true, platform, deviceId },
      create: {
        userId,
        token: pushToken,
        platform,
        deviceId,
        isActive: true,
      },
    });
  }

  static async deactivatePushToken(userId: string, pushToken: string): Promise<void> {
    await prisma.deviceToken.updateMany({
      where: { userId, token: pushToken },
      data: { isActive: false },
    });
  }

  static async markAsRead(notificationId: string, userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  static async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, readAt: null },
    });
  }
}

export { SmsService } from './sms.service';
export { WhatsAppService } from './whatsapp.service';
export { ExpoPushService } from './expo-push.service';
export { EmailService } from './email.service';
