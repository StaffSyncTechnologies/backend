// ============================================================
// TEST CLIENT AGENCY SWITCHING
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAgencySwitching() {
  console.log('🔄 Testing Client Agency Switching...\n');

  try {
    // 1. Get both agencies
    const demoAgency = await prisma.organization.findFirst({
      where: { name: 'StaffSync Demo Agency' },
    });

    const acmeAgency = await prisma.organization.findFirst({
      where: { name: 'Acme Corporation' },
    });

    if (!demoAgency || !acmeAgency) {
      console.log('❌ Agencies not found');
      return;
    }

    console.log(`📋 Found agencies:`);
    console.log(`   Demo Agency: ${demoAgency.name} (${demoAgency.id})`);
    console.log(`   Acme Agency: ${acmeAgency.name} (${acmeAgency.id})\n`);

    // 2. Get a client from Demo Agency
    const demoClient = await prisma.clientCompany.findFirst({
      where: { organizationId: demoAgency.id },
      include: {
        shifts: { take: 3 },
        invoices: { take: 2 },
      },
    });

    if (!demoClient) {
      console.log('❌ No client found in Demo Agency');
      return;
    }

    console.log(`👤 Found client: ${demoClient.name}`);
    console.log(`   Current agency: ${demoAgency.name}`);
    console.log(`   Shifts count: ${demoClient.shifts.length}`);
    console.log(`   Invoices count: ${demoClient.invoices.length}\n`);

    // 3. Show what client sees BEFORE switch
    console.log('📊 BEFORE SWITCH - Client data in Demo Agency:');
    const shiftsBefore = await prisma.shift.findMany({
      where: {
        clientCompanyId: demoClient.id,
        organizationId: demoAgency.id,
      },
      select: { id: true, title: true, startAt: true },
    });

    const invoicesBefore = await prisma.invoice.findMany({
      where: {
        clientCompanyId: demoClient.id,
        organizationId: demoAgency.id,
      },
      select: { id: true, invoiceNumber: true, total: true },
    });

    console.log(`   Shifts: ${shiftsBefore.length}`);
    shiftsBefore.forEach(s => console.log(`     - ${s.title} (${s.id})`));
    console.log(`   Invoices: ${invoicesBefore.length}`);
    invoicesBefore.forEach(i => console.log(`     - ${i.invoiceNumber} (£${i.total})`));

    // 4. Switch client to Acme Agency
    console.log('\n🔄 Switching client to Acme Agency...');
    await prisma.clientCompany.update({
      where: { id: demoClient.id },
      data: { organizationId: acmeAgency.id },
    });

    console.log('✅ Client switched to Acme Agency!');

    // 5. Show what client sees AFTER switch
    console.log('\n📊 AFTER SWITCH - Client data in Acme Agency:');
    const shiftsAfter = await prisma.shift.findMany({
      where: {
        clientCompanyId: demoClient.id,
        organizationId: acmeAgency.id,
      },
      select: { id: true, title: true, startAt: true },
    });

    const invoicesAfter = await prisma.invoice.findMany({
      where: {
        clientCompanyId: demoClient.id,
        organizationId: acmeAgency.id,
      },
      select: { id: true, invoiceNumber: true, total: true },
    });

    console.log(`   Shifts: ${shiftsAfter.length}`);
    if (shiftsAfter.length === 0) {
      console.log('     - No shifts in Acme Agency (as expected)');
    } else {
      shiftsAfter.forEach(s => console.log(`     - ${s.title} (${s.id})`));
    }

    console.log(`   Invoices: ${invoicesAfter.length}`);
    if (invoicesAfter.length === 0) {
      console.log('     - No invoices in Acme Agency (as expected)');
    } else {
      invoicesAfter.forEach(i => console.log(`     - ${i.invoiceNumber} (£${i.total})`));
    }

    // 6. Switch back to Demo Agency
    console.log('\n🔄 Switching client back to Demo Agency...');
    await prisma.clientCompany.update({
      where: { id: demoClient.id },
      data: { organizationId: demoAgency.id },
    });

    console.log('✅ Client switched back to Demo Agency!');

    // 7. Verify data is back
    const shiftsBack = await prisma.shift.findMany({
      where: {
        clientCompanyId: demoClient.id,
        organizationId: demoAgency.id,
      },
      select: { id: true, title: true },
    });

    console.log(`📊 VERIFICATION - Shifts back in Demo Agency: ${shiftsBack.length}`);

    console.log('\n🎉 Agency switching test completed successfully!');
    console.log('\n💡 Key Points:');
    console.log('   • Client data is filtered by organizationId');
    console.log('   • Switching agencies changes which data is visible');
    console.log('   • No data transfer needed - just change organizationId');
    console.log('   • Each agency only sees their own data');

  } catch (error) {
    console.error('❌ Error testing agency switching:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testAgencySwitching();
