import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';

const expo = new Expo();

export interface PushNotificationOptions {
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: 'default' | null;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  categoryId?: string;
}

export interface BulkPushOptions {
  pushTokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  categoryId?: string;
}

export class ExpoPushService {
  static isValidPushToken(token: string): boolean {
    return Expo.isExpoPushToken(token);
  }

  static async send(options: PushNotificationOptions): Promise<ExpoPushTicket[]> {
    const { pushToken, title, body, data, badge, sound = 'default', channelId, priority = 'high', categoryId } = options;

    if (!this.isValidPushToken(pushToken)) {
      console.warn(`Invalid Expo push token: ${pushToken}`);
      return [];
    }

    const message: ExpoPushMessage = {
      to: pushToken,
      title,
      body,
      data,
      badge,
      sound,
      channelId,
      priority,
      ...(categoryId && { categoryId }),
    };

    const chunks = expo.chunkPushNotifications([message]);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    return tickets;
  }

  static async sendBulk(options: BulkPushOptions): Promise<ExpoPushTicket[]> {
    const { pushTokens, title, body, data } = options;

    const validTokens = pushTokens.filter(token => this.isValidPushToken(token));

    if (validTokens.length === 0) {
      console.warn('No valid push tokens provided');
      return [];
    }

    const messages: ExpoPushMessage[] = validTokens.map(token => ({
      to: token,
      title,
      body,
      data,
      sound: 'default' as const,
      priority: 'high' as const,
      ...(options.categoryId && { categoryId: options.categoryId }),
    }));

    const chunks = expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    return tickets;
  }

  static async getReceipts(ticketIds: string[]): Promise<Record<string, ExpoPushReceipt>> {
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);
    const receipts: Record<string, ExpoPushReceipt> = {};

    for (const chunk of receiptIdChunks) {
      const chunkReceipts = await expo.getPushNotificationReceiptsAsync(chunk);
      Object.assign(receipts, chunkReceipts);
    }

    return receipts;
  }

  static async sendShiftAssigned(pushToken: string, shiftDetails: {
    shiftId: string;
    date: string;
    time: string;
    location: string;
  }): Promise<ExpoPushTicket[]> {
    return this.send({
      pushToken,
      title: 'New Shift Assigned',
      body: `You have been assigned a shift on ${shiftDetails.date} at ${shiftDetails.time}`,
      data: {
        type: 'shift_assigned',
        shiftId: shiftDetails.shiftId,
      },
      channelId: 'shifts',
    });
  }

  static async sendShiftReminder(pushToken: string, shiftDetails: {
    shiftId: string;
    startsIn: string;
    location: string;
  }): Promise<ExpoPushTicket[]> {
    return this.send({
      pushToken,
      title: 'Shift Reminder',
      body: `Your shift starts in ${shiftDetails.startsIn} at ${shiftDetails.location}`,
      data: {
        type: 'shift_reminder',
        shiftId: shiftDetails.shiftId,
      },
      channelId: 'reminders',
    });
  }
}
