import { prisma } from './src/lib/prisma';

async function checkChatRooms() {
  try {
    // Get all chat rooms
    const rooms = await prisma.chatRoom.findMany({
      include: {
        hrUser: { select: { id: true, fullName: true, email: true } },
        worker: { select: { id: true, fullName: true, email: true } },
        clientUser: { select: { id: true, fullName: true, email: true } },
        agencyUser: { select: { id: true, fullName: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            content: true,
            senderId: true,
            senderType: true,
            createdAt: true
          }
        }
      }
    });
    
    console.log(`Found ${rooms.length} chat rooms:`);
    rooms.forEach((room, index) => {
      console.log(`\nRoom ${index + 1}: ${room.id}`);
      console.log(`Type: ${room.type}`);
      
      if (room.hrUser) {
        console.log(`HR User: ${room.hrUser.fullName} (${room.hrUser.email})`);
      }
      if (room.worker) {
        console.log(`Worker: ${room.worker.fullName} (${room.worker.email})`);
      }
      if (room.clientUser) {
        console.log(`Client User: ${room.clientUser.fullName} (${room.clientUser.email})`);
      }
      if (room.agencyUser) {
        console.log(`Agency User: ${room.agencyUser.fullName} (${room.agencyUser.email})`);
      }
      
      console.log(`Messages: ${room.messages.length}`);
      room.messages.forEach(msg => {
        console.log(`  - ${msg.senderType}: ${msg.content?.substring(0, 50)}...`);
      });
    });
    
    // Get admin user and workers to create a test room
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, fullName: true, email: true, organizationId: true }
    });
    
    const worker = await prisma.user.findFirst({
      where: { role: 'WORKER' },
      select: { id: true, fullName: true, email: true, organizationId: true }
    });
    
    if (adminUser && worker && rooms.length === 0) {
      console.log('\nCreating a test chat room...');
      
      // Create a test chat room
      const newRoom = await prisma.chatRoom.create({
        data: {
          organizationId: adminUser.organizationId,
          type: 'HR_WORKER',
          hrUserId: adminUser.id,
          workerId: worker.id
        },
        include: {
          hrUser: { select: { id: true, fullName: true, email: true } },
          worker: { select: { id: true, fullName: true, email: true } }
        }
      });
      
      console.log(`Created room: ${newRoom.id}`);
      console.log(`Between: ${newRoom.hrUser.fullName} and ${newRoom.worker.fullName}`);
      
      // Create a test message
      const testMessage = await prisma.chatMessage.create({
        data: {
          chatRoomId: newRoom.id,
          senderId: adminUser.id,
          senderType: 'user',
          content: 'Hello! This is a test message.',
          status: 'SENT'
        }
      });
      
      console.log(`Created test message: ${testMessage.id}`);
    }
    
  } catch (error) {
    console.error('Error checking chat rooms:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkChatRooms();
