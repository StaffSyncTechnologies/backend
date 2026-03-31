import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ChatService } from '../services/chat';
import { ApiResponse } from '../utils/ApiResponse';
import { prisma } from '../lib/prisma';
import { ChatRoomType } from '@prisma/client';

export class ChatController {
  // HR-Worker chat methods (existing)
  getMyRooms = async (req: AuthRequest, res: Response) => {
    const rooms = await ChatService.getUserRooms(req.user!.id, 'user');
    ApiResponse.ok(res, 'Chat rooms retrieved', rooms);
  };

  getOrCreateRoom = async (req: AuthRequest, res: Response) => {
    const { workerId } = req.body;
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;

    // Verify the worker exists and belongs to the same organization
    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        organizationId,
        role: 'WORKER',
      },
    });

    if (!worker) {
      return ApiResponse.send({ res, statusCode: 404, success: false, message: 'Worker not found' });
    }

    // HR user initiates chat with worker
    const room = await ChatService.getOrCreateRoom({
      organizationId,
      type: ChatRoomType.HR_WORKER,
      hrUserId: userId,
      workerId,
    });

    ApiResponse.ok(res, 'Chat room retrieved', room);
  };

  getRoomMessages = async (req: AuthRequest, res: Response) => {
    const { roomId } = req.params;
    const { limit, cursor } = req.query;

    const messages = await ChatService.getRoomMessages(
      roomId,
      req.user!.id,
      'user',
      limit ? parseInt(limit as string) : 50,
      cursor as string | undefined
    );

    ApiResponse.ok(res, 'Messages retrieved', messages);
  };

  markAsRead = async (req: AuthRequest, res: Response) => {
    const { roomId } = req.params;

    const count = await ChatService.markMessagesAsRead(roomId, req.user!.id);
    ApiResponse.ok(res, 'Messages marked as read', { count });
  };

  getUnreadCount = async (req: AuthRequest, res: Response) => {
    const count = await ChatService.getUnreadCount(req.user!.id, 'user');
    ApiResponse.ok(res, 'Unread count retrieved', { count });
  };

  workerGetOrCreateRoom = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;

    // Check if worker already has a chat room
    const existingRoom = await prisma.chatRoom.findFirst({
      where: { workerId: userId },
      include: {
        hrUser: { select: { id: true, fullName: true, role: true } },
        worker: { select: { id: true, fullName: true, role: true } },
      },
    });

    if (existingRoom) {
      ApiResponse.ok(res, 'Chat room retrieved', existingRoom);
      return;
    }

    // Find the worker's manager, or fall back to any HR staff
    const worker = await prisma.user.findUnique({
      where: { id: userId },
      select: { managerId: true },
    });

    let hrUserId = worker?.managerId;

    if (!hrUserId) {
      // Find any non-worker staff member in the organization
      const hrUser = await prisma.user.findFirst({
        where: {
          organizationId,
          role: { in: ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'] },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      hrUserId = hrUser?.id;
    }

    if (!hrUserId) {
      return ApiResponse.send({ res, statusCode: 404, success: false, message: 'No manager available to chat with' });
    }

    const room = await ChatService.getOrCreateRoom({
      organizationId,
      type: ChatRoomType.HR_WORKER,
      hrUserId,
      workerId: userId,
    });

    ApiResponse.ok(res, 'Chat room created', room);
  };

  getAssignedWorkers = async (req: AuthRequest, res: Response) => {
    const userId = req.user!.id;
    const organizationId = req.user!.organizationId;

    // Get workers in the same organization that HR can chat with
    const workers = await prisma.user.findMany({
      where: {
        organizationId,
        role: 'WORKER',
        status: 'ACTIVE',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
      orderBy: { fullName: 'asc' },
    });

    ApiResponse.ok(res, 'Workers retrieved', workers);
  };

  // Client-Agency chat methods (new)
  clientGetMyRooms = async (req: AuthRequest, res: Response) => {
    const rooms = await ChatService.getClientAgencyRooms(req.user!.id);
    ApiResponse.ok(res, 'Client chat rooms retrieved', rooms);
  };

  agencyGetMyRooms = async (req: AuthRequest, res: Response) => {
    const rooms = await ChatService.getAgencyClientRooms(req.user!.id);
    ApiResponse.ok(res, 'Agency chat rooms retrieved', rooms);
  };

  clientGetOrCreateRoom = async (req: AuthRequest, res: Response) => {
    const clientUserId = req.user!.id;
    const organizationId = req.user!.organizationId;

    // Get client user's company
    const clientUser = await prisma.clientUser.findUnique({
      where: { id: clientUserId },
      include: { clientCompany: true },
    });

    if (!clientUser) {
      return ApiResponse.send({ res, statusCode: 404, success: false, message: 'Client user not found' });
    }

    // Find an agency staff member to chat with
    const agencyUser = await prisma.user.findFirst({
      where: {
        organizationId,
        role: { in: ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (!agencyUser) {
      return ApiResponse.send({ res, statusCode: 404, success: false, message: 'No agency staff available to chat with' });
    }

    const room = await ChatService.getOrCreateRoom({
      organizationId,
      type: ChatRoomType.CLIENT_AGENCY,
      clientUserId,
      agencyUserId: agencyUser.id,
      clientCompanyId: clientUser.clientCompanyId,
    });

    ApiResponse.ok(res, 'Client chat room created', room);
  };

  agencyGetOrCreateRoom = async (req: AuthRequest, res: Response) => {
    const { clientUserId } = req.body;
    const agencyUserId = req.user!.id;
    const organizationId = req.user!.organizationId;

    // Verify the client user exists and belongs to the same organization
    const clientUser = await prisma.clientUser.findFirst({
      where: {
        id: clientUserId,
        clientCompany: { organizationId },
      },
      include: { clientCompany: true },
    });

    if (!clientUser) {
      return ApiResponse.send({ res, statusCode: 404, success: false, message: 'Client user not found' });
    }

    // Agency user initiates chat with client
    const room = await ChatService.getOrCreateRoom({
      organizationId,
      type: ChatRoomType.CLIENT_AGENCY,
      clientUserId,
      agencyUserId,
      clientCompanyId: clientUser.clientCompanyId,
    });

    ApiResponse.ok(res, 'Agency chat room created', room);
  };

  clientGetRoomMessages = async (req: AuthRequest, res: Response) => {
    const { roomId } = req.params;
    const { limit, cursor } = req.query;

    const messages = await ChatService.getRoomMessages(
      roomId,
      req.user!.id,
      'client_user',
      limit ? parseInt(limit as string) : 50,
      cursor as string | undefined
    );

    ApiResponse.ok(res, 'Messages retrieved', messages);
  };

  clientMarkAsRead = async (req: AuthRequest, res: Response) => {
    const { roomId } = req.params;

    const count = await ChatService.markMessagesAsRead(roomId, req.user!.id);
    ApiResponse.ok(res, 'Messages marked as read', { count });
  };

  clientGetUnreadCount = async (req: AuthRequest, res: Response) => {
    const count = await ChatService.getUnreadCount(req.user!.id, 'client_user');
    ApiResponse.ok(res, 'Unread count retrieved', { count });
  };

  // Universal message sending (works for both HR-Worker and Client-Agency)
  sendMessage = async (req: AuthRequest, res: Response) => {
    const { roomId, content } = req.body;
    const userId = req.user!.id;

    if (!content || !content.trim()) {
      return ApiResponse.send({ res, statusCode: 400, success: false, message: 'Message content is required' });
    }

    try {
      const message = await ChatService.createMessage({
        chatRoomId: roomId,
        senderId: userId,
        senderType: 'user', // This could be determined based on user type
        content: content.trim(),
      });

      ApiResponse.ok(res, 'Message sent', message);
    } catch (error: any) {
      ApiResponse.send({ res, statusCode: 403, success: false, message: error.message });
    }
  };

  clientSendMessage = async (req: AuthRequest, res: Response) => {
    const { roomId, content } = req.body;
    const userId = req.user!.id;

    if (!content || !content.trim()) {
      return ApiResponse.send({ res, statusCode: 400, success: false, message: 'Message content is required' });
    }

    try {
      const message = await ChatService.createMessage({
        chatRoomId: roomId,
        senderId: userId,
        senderType: 'client_user',
        content: content.trim(),
      });

      ApiResponse.ok(res, 'Message sent', message);
    } catch (error: any) {
      ApiResponse.send({ res, statusCode: 403, success: false, message: error.message });
    }
  };

  // Get available clients for agency staff to chat with
  getAvailableClients = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;

    const clients = await prisma.clientUser.findMany({
      where: {
        clientCompany: { organizationId },
        status: 'ACTIVE',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        jobTitle: true,
        clientCompany: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    ApiResponse.ok(res, 'Available clients retrieved', clients);
  };
}
