import { prisma } from '../../lib/prisma';
import { MessageStatus } from '@prisma/client';

export interface CreateMessageInput {
  chatRoomId: string;
  senderId: string;
  content: string;
}

export interface GetOrCreateRoomInput {
  organizationId: string;
  hrUserId: string;
  workerId: string;
}

export class ChatService {
  static async getOrCreateRoom({ organizationId, hrUserId, workerId }: GetOrCreateRoomInput) {
    let room = await prisma.chatRoom.findUnique({
      where: {
        hrUserId_workerId: { hrUserId, workerId },
      },
      include: {
        hrUser: { select: { id: true, fullName: true, role: true } },
        worker: { select: { id: true, fullName: true, role: true } },
      },
    });

    if (!room) {
      room = await prisma.chatRoom.create({
        data: {
          organizationId,
          hrUserId,
          workerId,
        },
        include: {
          hrUser: { select: { id: true, fullName: true, role: true } },
          worker: { select: { id: true, fullName: true, role: true } },
        },
      });
    }

    return room;
  }

  static async getRoomById(roomId: string, userId: string) {
    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [{ hrUserId: userId }, { workerId: userId }],
      },
      include: {
        hrUser: { select: { id: true, fullName: true, role: true } },
        worker: { select: { id: true, fullName: true, role: true } },
      },
    });

    return room;
  }

  static async getUserRooms(userId: string) {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        OR: [{ hrUserId: userId }, { workerId: userId }],
      },
      include: {
        hrUser: { select: { id: true, fullName: true, role: true } },
        worker: { select: { id: true, fullName: true, role: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Count unread messages for each room
    const roomsWithUnread = await Promise.all(
      rooms.map(async (room) => {
        const unreadCount = await prisma.chatMessage.count({
          where: {
            chatRoomId: room.id,
            senderId: { not: userId },
            status: { not: MessageStatus.READ },
          },
        });
        return { ...room, unreadCount };
      })
    );

    return roomsWithUnread;
  }

  static async createMessage({ chatRoomId, senderId, content }: CreateMessageInput) {
    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId,
        content,
        status: MessageStatus.SENT,
      },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
      },
    });

    // Update last message timestamp
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  static async getRoomMessages(roomId: string, userId: string, limit = 50, cursor?: string) {
    // Verify user has access to this room
    const room = await this.getRoomById(roomId, userId);
    if (!room) {
      throw new Error('Chat room not found or access denied');
    }

    const messages = await prisma.chatMessage.findMany({
      where: { chatRoomId: roomId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
      },
    });

    return messages.reverse();
  }

  static async markMessagesAsRead(roomId: string, userId: string) {
    const result = await prisma.chatMessage.updateMany({
      where: {
        chatRoomId: roomId,
        senderId: { not: userId },
        status: { not: MessageStatus.READ },
      },
      data: {
        status: MessageStatus.READ,
        readAt: new Date(),
      },
    });

    return result.count;
  }

  static async markMessageAsDelivered(messageId: string) {
    return prisma.chatMessage.update({
      where: { id: messageId },
      data: { status: MessageStatus.DELIVERED },
    });
  }

  static async getUnreadCount(userId: string) {
    return prisma.chatMessage.count({
      where: {
        chatRoom: {
          OR: [{ hrUserId: userId }, { workerId: userId }],
        },
        senderId: { not: userId },
        status: { not: MessageStatus.READ },
      },
    });
  }
}
