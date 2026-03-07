import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../middleware/auth';
import { NotificationService } from '../services/notifications';
import { z } from 'zod';

export class NotificationController {
  /**
   * Get all notifications for current user (paginated)
   * GET /api/notifications
   */
  getNotifications = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const unreadOnly = req.query.unreadOnly === 'true';

    const where = {
      userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    const unreadCount = await prisma.notification.count({
      where: { userId, readAt: null },
    });

    ApiResponse.success(res, 'Notifications retrieved', {
      notifications: notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        referenceType: n.referenceType,
        referenceId: n.referenceId,
        isRead: !!n.readAt,
        createdAt: n.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  };

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  getUnreadCount = async (req: AuthRequest, res: Response) => {
    const count = await NotificationService.getUnreadCount(req.user!.id);
    ApiResponse.success(res, 'Unread count retrieved', { count });
  };

  /**
   * Mark notification as read
   * POST /api/notifications/:id/read
   */
  markAsRead = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    await NotificationService.markAsRead(id, req.user!.id);
    ApiResponse.success(res, 'Notification marked as read');
  };

  /**
   * Mark all notifications as read
   * POST /api/notifications/read-all
   */
  markAllAsRead = async (req: AuthRequest, res: Response) => {
    await NotificationService.markAllAsRead(req.user!.id);
    ApiResponse.success(res, 'All notifications marked as read');
  };

  /**
   * Register device token for push notifications
   * POST /api/notifications/register-device
   */
  registerDevice = async (req: AuthRequest, res: Response) => {
    const { pushToken, platform, deviceId } = z.object({
      pushToken: z.string(),
      platform: z.enum(['ios', 'android', 'expo']).optional().default('expo'),
      deviceId: z.string().optional(),
    }).parse(req.body);

    await NotificationService.registerPushToken(
      req.user!.id,
      pushToken,
      platform,
      deviceId
    );

    ApiResponse.success(res, 'Device registered for push notifications');
  };

  /**
   * Deactivate device token
   * POST /api/notifications/deactivate-device
   */
  deactivateDevice = async (req: AuthRequest, res: Response) => {
    const { pushToken } = z.object({
      pushToken: z.string(),
    }).parse(req.body);

    await NotificationService.deactivatePushToken(req.user!.id, pushToken);
    ApiResponse.success(res, 'Device deactivated');
  };

  /**
   * Get notification preferences
   * GET /api/notifications/preferences
   */
  getPreferences = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    // Default preference types based on the app UI
    const preferenceTypes = [
      { type: 'NEW_SHIFT_ALERTS', category: 'work_alerts', defaultEnabled: true },
      { type: 'SHIFT_REMINDER', category: 'work_alerts', defaultEnabled: true },
      { type: 'PAYSLIP_READY', category: 'administrative', defaultEnabled: true },
      { type: 'HOLIDAY_REQUEST', category: 'administrative', defaultEnabled: true },
      { type: 'APP_UPDATES', category: 'administrative', defaultEnabled: false },
    ];

    // Get existing preferences from DB
    const existingPrefs = await prisma.notificationPreference.findMany({
      where: { userId },
    });

    // Build preference map
    const prefMap = new Map(
      existingPrefs.map(p => [`${p.notificationType}_${p.channel}`, p.enabled])
    );

    // Build response with defaults
    const preferences = preferenceTypes.map(pt => ({
      type: pt.type,
      category: pt.category,
      push: prefMap.get(`${pt.type}_PUSH`) ?? pt.defaultEnabled,
      sms: prefMap.get(`${pt.type}_SMS`) ?? false,
      email: prefMap.get(`${pt.type}_EMAIL`) ?? false,
    }));

    ApiResponse.success(res, 'Preferences retrieved', { preferences });
  };

  /**
   * Update notification preference
   * PUT /api/notifications/preferences
   */
  updatePreference = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const data = z.object({
      type: z.enum([
        'NEW_SHIFT_ALERTS',
        'SHIFT_REMINDER',
        'PAYSLIP_READY',
        'HOLIDAY_REQUEST',
        'APP_UPDATES',
      ]),
      channel: z.enum(['PUSH', 'SMS', 'EMAIL']).optional().default('PUSH'),
      enabled: z.boolean(),
    }).parse(req.body);

    await prisma.notificationPreference.upsert({
      where: {
        userId_notificationType_channel: {
          userId,
          notificationType: data.type,
          channel: data.channel,
        },
      },
      create: {
        userId,
        notificationType: data.type,
        channel: data.channel,
        enabled: data.enabled,
      },
      update: {
        enabled: data.enabled,
      },
    });

    ApiResponse.success(res, 'Preference updated');
  };

  /**
   * Bulk update notification preferences
   * PUT /api/notifications/preferences/bulk
   */
  updatePreferencesBulk = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;

    const data = z.object({
      preferences: z.array(z.object({
        type: z.enum([
          'NEW_SHIFT_ALERTS',
          'SHIFT_REMINDER',
          'PAYSLIP_READY',
          'HOLIDAY_REQUEST',
          'APP_UPDATES',
        ]),
        enabled: z.boolean(),
      })),
    }).parse(req.body);

    // Upsert all preferences (default to PUSH channel)
    await prisma.$transaction(
      data.preferences.map(pref =>
        prisma.notificationPreference.upsert({
          where: {
            userId_notificationType_channel: {
              userId,
              notificationType: pref.type,
              channel: 'PUSH',
            },
          },
          create: {
            userId,
            notificationType: pref.type,
            channel: 'PUSH',
            enabled: pref.enabled,
          },
          update: {
            enabled: pref.enabled,
          },
        })
      )
    );

    ApiResponse.success(res, 'Preferences updated');
  };
}
