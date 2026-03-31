import { prisma } from '../../lib/prisma';
import { MessageStatus, ChatRoomType } from '@prisma/client';

export interface CreateMessageInput {
  chatRoomId: string;
  senderId: string;
  senderType: 'user' | 'client_user';
  content: string;
}

export interface GetOrCreateRoomInput {
  organizationId: string;
  type: ChatRoomType;
  hrUserId?: string;
  workerId?: string;
  clientUserId?: string;
  agencyUserId?: string;
  clientCompanyId?: string;
}

export class ChatService {
  static async getOrCreateRoom({ organizationId, type, hrUserId, workerId, clientUserId, agencyUserId, clientCompanyId }: GetOrCreateRoomInput) {
    // For HR-Worker rooms
    if (type === ChatRoomType.HR_WORKER && hrUserId && workerId) {
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
            type: ChatRoomType.HR_WORKER,
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

    // For Client-Agency rooms
    if (type === ChatRoomType.CLIENT_AGENCY && clientUserId && agencyUserId && clientCompanyId) {
      let room = await prisma.chatRoom.findFirst({
        where: {
          type: ChatRoomType.CLIENT_AGENCY,
          clientUserId,
          agencyUserId,
        },
        include: {
          clientUser: { select: { id: true, fullName: true, email: true } },
          agencyUser: { select: { id: true, fullName: true, role: true } },
          clientCompany: { select: { id: true, name: true } },
        },
      });

      if (!room) {
        room = await prisma.chatRoom.create({
          data: {
            organizationId,
            type: ChatRoomType.CLIENT_AGENCY,
            clientUserId,
            agencyUserId,
            clientCompanyId,
          },
          include: {
            clientUser: { select: { id: true, fullName: true, email: true } },
            agencyUser: { select: { id: true, fullName: true, role: true } },
            clientCompany: { select: { id: true, name: true } },
          },
        });
      }

      return room;
    }

    throw new Error('Invalid room configuration');
  }

  static async getRoomById(roomId: string, userId: string, userType: 'user' | 'client_user') {
    const room = await prisma.chatRoom.findFirst({
      where: {
        id: roomId,
        OR: [
          // HR-Worker access
          { hrUserId: userId },
          { workerId: userId },
          // Client-Agency access
          { clientUserId: userType === 'client_user' ? userId : undefined },
          { agencyUserId: userType === 'user' ? userId : undefined },
        ].filter(Boolean),
      },
      select: {
        id: true,
        organizationId: true,
        type: true,
        hrUserId: true,
        workerId: true,
        clientUserId: true,
        agencyUserId: true,
        clientCompanyId: true,
        lastMessageAt: true,
        createdAt: true,
        hrUser: { select: { id: true, fullName: true, role: true } },
        worker: { select: { id: true, fullName: true, role: true } },
        clientUser: { select: { id: true, fullName: true, email: true } },
        agencyUser: { select: { id: true, fullName: true, role: true } },
        clientCompany: { select: { id: true, name: true } },
      },
    });

    return room;
  }

  static async getUserRooms(userId: string, userType: 'user' | 'client_user') {
    const rooms = await prisma.chatRoom.findMany({
      where: {
        OR: [
          // HR-Worker rooms
          { hrUserId: userType === 'user' ? userId : undefined },
          { workerId: userType === 'user' ? userId : undefined },
          // Client-Agency rooms
          { clientUserId: userType === 'client_user' ? userId : undefined },
          { agencyUserId: userType === 'user' ? userId : undefined },
        ].filter(Boolean),
      },
      include: {
        hrUser: { select: { id: true, fullName: true, role: true } },
        worker: { select: { id: true, fullName: true, role: true } },
        clientUser: { select: { id: true, fullName: true, email: true } },
        agencyUser: { select: { id: true, fullName: true, role: true } },
        clientCompany: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            senderType: true,
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

  static async createMessage({ chatRoomId, senderId, senderType, content }: CreateMessageInput) {
    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId,
        senderId,
        senderType,
        content,
        status: MessageStatus.SENT,
      },
      include: {
        chatRoom: {
          include: {
            hrUser: { select: { id: true, fullName: true, role: true } },
            worker: { select: { id: true, fullName: true, role: true } },
            clientUser: { select: { id: true, fullName: true, email: true } },
            agencyUser: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    });

    // Update last message timestamp
    await prisma.chatRoom.update({
      where: { id: chatRoomId },
      data: { lastMessageAt: new Date() },
    });

    return message;
  }

  static async getRoomMessages(roomId: string, userId: string, userType: 'user' | 'client_user', limit = 50, cursor?: string) {
    // Verify user has access to this room
    const room = await this.getRoomById(roomId, userId, userType);
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
        chatRoom: {
          include: {
            hrUser: { select: { id: true, fullName: true, role: true } },
            worker: { select: { id: true, fullName: true, role: true } },
            clientUser: { select: { id: true, fullName: true, email: true } },
            agencyUser: { select: { id: true, fullName: true, role: true } },
          },
        },
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

  static async getUnreadCount(userId: string, userType: 'user' | 'client_user') {
    return prisma.chatMessage.count({
      where: {
        chatRoom: {
          OR: [
            // HR-Worker rooms
            { hrUserId: userType === 'user' ? userId : undefined },
            { workerId: userType === 'user' ? userId : undefined },
            // Client-Agency rooms
            { clientUserId: userType === 'client_user' ? userId : undefined },
            { agencyUserId: userType === 'user' ? userId : undefined },
          ].filter(Boolean),
        },
        senderId: { not: userId },
        status: { not: MessageStatus.READ },
      },
    });
  }

  // Client-Agency specific methods
  static async getClientAgencyRooms(clientUserId: string) {
    return prisma.chatRoom.findMany({
      where: {
        type: ChatRoomType.CLIENT_AGENCY,
        clientUserId,
      },
      include: {
        agencyUser: { select: { id: true, fullName: true, role: true } },
        clientCompany: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            senderType: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  static async getAgencyClientRooms(agencyUserId: string) {
    return prisma.chatRoom.findMany({
      where: {
        type: ChatRoomType.CLIENT_AGENCY,
        agencyUserId,
      },
      include: {
        clientUser: { select: { id: true, fullName: true, email: true } },
        clientCompany: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            senderType: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }
}
