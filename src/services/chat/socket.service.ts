import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { prisma } from '../../lib/prisma';
import { ChatService } from './chat.service';
import { NotificationService } from '../notifications';

interface AuthenticatedSocket extends Socket {
  userId: string;
  organizationId: string;
  role: string;
}

interface JwtPayload {
  userId: string;
  organizationId: string;
}

export class SocketService {
  private static io: Server;
  private static userSockets: Map<string, Set<string>> = new Map();

  static initialize(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.io.use(this.authMiddleware);
    this.io.on('connection', this.handleConnection.bind(this));

    console.log('🔌 Socket.IO initialized');
    return this.io;
  }

  private static async authMiddleware(socket: Socket, next: (err?: Error) => void) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, organizationId: true, role: true, status: true },
      });

      if (!user || user.status !== 'ACTIVE') {
        return next(new Error('User not found or inactive'));
      }

      (socket as AuthenticatedSocket).userId = user.id;
      (socket as AuthenticatedSocket).organizationId = user.organizationId;
      (socket as AuthenticatedSocket).role = user.role;

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  }

  private static handleConnection(socket: Socket) {
    const authSocket = socket as AuthenticatedSocket;
    const { userId, role } = authSocket;

    console.log(`👤 User connected: ${userId} (${role})`);

    // Track user's socket connections
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Join user's personal room for direct messages
    socket.join(`user:${userId}`);

    // Event handlers
    socket.on('chat:join', (data) => this.handleJoinRoom(authSocket, data));
    socket.on('chat:leave', (data) => this.handleLeaveRoom(authSocket, data));
    socket.on('chat:message', (data) => this.handleMessage(authSocket, data));
    socket.on('chat:typing', (data) => this.handleTyping(authSocket, data));
    socket.on('chat:read', (data) => this.handleMarkRead(authSocket, data));
    socket.on('chat:get_rooms', () => this.handleGetRooms(authSocket));

    socket.on('disconnect', () => this.handleDisconnect(authSocket));
  }

  private static async handleJoinRoom(socket: AuthenticatedSocket, data: { roomId: string }) {
    try {
      const room = await ChatService.getRoomById(data.roomId, socket.userId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found or access denied' });
        return;
      }

      socket.join(`room:${data.roomId}`);
      
      // Mark messages as read when joining
      await ChatService.markMessagesAsRead(data.roomId, socket.userId);
      
      // Notify other user that messages were read
      const otherUserId = room.hrUserId === socket.userId ? room.workerId : room.hrUserId;
      this.emitToUser(otherUserId, 'chat:messages_read', { roomId: data.roomId, readBy: socket.userId });

      socket.emit('chat:joined', { roomId: data.roomId });
    } catch (error) {
      socket.emit('error', { message: 'Failed to join room' });
    }
  }

  private static handleLeaveRoom(socket: AuthenticatedSocket, data: { roomId: string }) {
    socket.leave(`room:${data.roomId}`);
  }

  private static async handleMessage(
    socket: AuthenticatedSocket,
    data: { roomId: string; content: string }
  ) {
    try {
      const room = await ChatService.getRoomById(data.roomId, socket.userId);
      
      if (!room) {
        socket.emit('error', { message: 'Room not found or access denied' });
        return;
      }

      const message = await ChatService.createMessage({
        chatRoomId: data.roomId,
        senderId: socket.userId,
        content: data.content,
      });

      // Emit to all users in the room
      this.io.to(`room:${data.roomId}`).emit('chat:message', message);

      // Also emit to recipient's user room (for notification if not in chat room)
      const recipientId = room.hrUserId === socket.userId ? room.workerId : room.hrUserId;
      this.emitToUser(recipientId, 'chat:new_message', {
        roomId: data.roomId,
        message,
      });

      // Check if recipient is actively viewing the chat room
      const recipientInRoom = this.io.sockets.adapter.rooms.get(`room:${data.roomId}`);
      const recipientSocketIds = this.userSockets.get(recipientId);
      const isRecipientInRoom = recipientInRoom && recipientSocketIds &&
        [...recipientSocketIds].some((sid) => recipientInRoom.has(sid));

      // Always create in-app notification; only send push if not viewing the room
      try {
        const senderUser = await prisma.user.findUnique({
          where: { id: socket.userId },
          select: { fullName: true },
        });

        const senderName = senderUser?.fullName || 'Someone';
        const preview = data.content.length > 100 ? data.content.substring(0, 100) + '...' : data.content;

        await NotificationService.send({
          userId: recipientId,
          title: `New message from ${senderName}`,
          body: preview,
          type: 'chat_message',
          channels: isRecipientInRoom ? [] : ['push'],
          preferenceType: 'chat_message',
          data: {
            type: 'chat_message',
            action: 'VIEW_CHAT',
            roomId: data.roomId,
            senderId: socket.userId,
          },
        });
      } catch (notifErr) {
        console.error('Failed to send chat notification:', notifErr);
      }

    } catch (error) {
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  private static handleTyping(
    socket: AuthenticatedSocket,
    data: { roomId: string; isTyping: boolean }
  ) {
    socket.to(`room:${data.roomId}`).emit('chat:typing', {
      roomId: data.roomId,
      userId: socket.userId,
      isTyping: data.isTyping,
    });
  }

  private static async handleMarkRead(
    socket: AuthenticatedSocket,
    data: { roomId: string }
  ) {
    try {
      const room = await ChatService.getRoomById(data.roomId, socket.userId);
      
      if (!room) return;

      await ChatService.markMessagesAsRead(data.roomId, socket.userId);

      // Notify sender that messages were read
      const otherUserId = room.hrUserId === socket.userId ? room.workerId : room.hrUserId;
      this.emitToUser(otherUserId, 'chat:messages_read', { 
        roomId: data.roomId, 
        readBy: socket.userId 
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }

  private static async handleGetRooms(socket: AuthenticatedSocket) {
    try {
      const rooms = await ChatService.getUserRooms(socket.userId);
      socket.emit('chat:rooms', rooms);
    } catch (error) {
      socket.emit('error', { message: 'Failed to get rooms' });
    }
  }

  private static handleDisconnect(socket: AuthenticatedSocket) {
    const { userId } = socket;
    
    // Remove socket from user's connections
    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds) {
      userSocketIds.delete(socket.id);
      if (userSocketIds.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    console.log(`👤 User disconnected: ${userId}`);
  }

  static emitToUser(userId: string, event: string, data: unknown) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  static emitToRoom(roomId: string, event: string, data: unknown) {
    this.io.to(`room:${roomId}`).emit(event, data);
  }

  static isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  static getIO(): Server {
    return this.io;
  }
}
