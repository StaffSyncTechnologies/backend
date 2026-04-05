import { prisma } from './src/lib/prisma';
import bcrypt from 'bcryptjs';

async function checkUser() {
  try {
    // First find the organization by name
    const orgs = await prisma.organization.findMany({
      where: { name: 'Acme Corporation' }
    });
    
    if (orgs.length === 0) {
      console.log('❌ Organization not found');
      return;
    }
    
    const org = orgs[0];
    console.log('✅ Found organization:', org.name, 'ID:', org.id);
    
    const user = await prisma.user.findUnique({
      where: { 
        organizationId_email: {
          organizationId: org.id,
          email: 'admin@acmecorporation.com'
        }
      },
      include: { organization: true }
    });
    
    console.log('🔍 User lookup result:', {
      found: !!user,
      email: user?.email,
      fullName: user?.fullName,
      role: user?.role,
      organization: user?.organization?.name,
      status: user?.status,
      hasPasswordHash: !!user?.passwordHash
    });
    
    if (user?.passwordHash) {
      // Test password verification
      const isValid = await bcrypt.compare('Admin123!', user.passwordHash);
      console.log('🔐 Password verification (Admin123!):', isValid);
      
      // Test with common variations
      const variations = ['admin123!', 'Admin123', 'admin123', '123456'];
      for (const pwd of variations) {
        const valid = await bcrypt.compare(pwd, user.passwordHash);
        if (valid) {
          console.log('✅ Actual password works:', pwd);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
