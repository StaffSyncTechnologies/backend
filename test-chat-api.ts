import { prisma } from './src/lib/prisma';

async function testChatAPI() {
  try {
    // Get a user to test with
    const user = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, fullName: true, email: true, organizationId: true }
    });
    
    if (!user) {
      console.log('No admin user found, trying any user...');
      const anyUser = await prisma.user.findFirst({
        select: { id: true, fullName: true, email: true, organizationId: true }
      });
      
      if (!anyUser) {
        console.log('No users found in database!');
        return;
      }
      
      console.log(`Found user: ${anyUser.fullName} (${anyUser.email})`);
      console.log(`User ID: ${anyUser.id}`);
      console.log(`Organization ID: ${anyUser.organizationId}`);
    } else {
      console.log(`Found admin user: ${user.fullName} (${user.email})`);
      console.log(`User ID: ${user.id}`);
      console.log(`Organization ID: ${user.organizationId}`);
    }
    
    // Check if there are any chat rooms
    const rooms = await prisma.chatRoom.count();
    console.log(`Total chat rooms: ${rooms}`);
    
    // Check if there are any chat messages
    const messages = await prisma.chatMessage.count();
    console.log(`Total chat messages: ${messages}`);
    
  } catch (error) {
    console.error('Error testing chat API:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testChatAPI();
