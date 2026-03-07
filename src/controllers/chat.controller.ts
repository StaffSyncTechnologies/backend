import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ChatService } from '../services/chat';
import { ApiResponse } from '../utils/ApiResponse';
import { prisma } from '../lib/prisma';

export class ChatController {
  getMyRooms = async (req: AuthRequest, res: Response) => {
    const rooms = await ChatService.getUserRooms(req.user!.id);
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
    const count = await ChatService.getUnreadCount(req.user!.id);
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
}
