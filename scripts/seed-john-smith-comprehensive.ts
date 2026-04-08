import { PrismaClient, ShiftStatus, ShiftPriority, LeaveType, LeaveStatus, PayslipStatus, PayPeriodStatus, AttendanceStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seedJohnSmithComprehensive() {
  console.log('=== SEEDING COMPREHENSIVE DATA FOR JOHN SMITH ===');

  try {
    // Get John Smith and organization
    const johnSmith = await prisma.user.findFirst({
      where: { 
        fullName: 'John Smith',
        role: 'WORKER'
      }
    });

    if (!johnSmith) {
      console.log('John Smith not found');
      return;
    }

    const organization = await prisma.organization.findFirst({
      where: { email: 'admin@staffsync-demo.com' }
    });

    if (!organization) {
      console.log('StaffSync Demo organization not found');
      return;
    }

    console.log(`Found John Smith: ${johnSmith.email}`);
    console.log(`Organization: ${organization.name}`);

    // Get or create manager
    let manager = await prisma.user.findFirst({
      where: { 
        organizationId: organization.id,
        role: { in: ['ADMIN', 'OPS_MANAGER', 'SHIFT_COORDINATOR'] }
      }
    });

    if (!manager) {
      const hashedPin = await bcrypt.hash('1234', 10);
      manager = await prisma.user.create({
        data: {
          fullName: 'Sarah Johnson',
          email: 'sarah.johnson@staffsync-demo.com',
          password: hashedPin,
          pin: hashedPin,
          role: 'OPS_MANAGER',
          organizationId: organization.id,
          status: 'ACTIVE',
          phone: '+447700900123',
          address: '123 Manager Street, London, UK',
          dateOfBirth: new Date('1985-05-15'),
          nationalInsurance: 'SJ123456C',
          emergencyContactName: 'Mike Johnson',
          emergencyContactPhone: '+447700900124',
          emergencyContactRelationship: 'Husband',
        }
      });
      console.log('Created manager: Sarah Johnson');
    }

    // Update John Smith with manager
    await prisma.user.update({
      where: { id: johnSmith.id },
      data: { managerId: manager.id }
    });

    // Clear existing data for John Smith
    await prisma.shiftAssignment.deleteMany({
      where: { workerId: johnSmith.id }
    });
    await prisma.attendance.deleteMany({
      where: { workerId: johnSmith.id }
    });
    await prisma.payslip.deleteMany({
      where: { workerId: johnSmith.id }
    });
    await prisma.leaveRequest.deleteMany({
      where: { workerId: johnSmith.id }
    });
    await prisma.workerAvailability.deleteMany({
      where: { workerId: johnSmith.id }
    });

    console.log('Cleared existing data for John Smith');

    // Get skills
    const warehouseSkills = await prisma.skill.findMany({
      where: { category: 'WAREHOUSE' }
    });
    const healthcareSkills = await prisma.skill.findMany({
      where: { category: 'HEALTHCARE' }
    });

    // Create worker profile and skills
    await prisma.workerProfile.upsert({
      where: { userId: johnSmith.id },
      update: {},
      create: {
        userId: johnSmith.id,
        nationalInsurance: 'JS123456D',
        emergencyContactName: 'Jane Smith',
        emergencyContactPhone: '+447700900999',
        emergencyContactRelationship: 'Wife',
        bankAccountNumber: '12345678',
        bankSortCode: '12-34-56',
        bankAccountName: 'John Smith',
        taxCode: '1257L',
        niNumber: 'JS123456D',
        p45Uk: true,
        rightToWork: true,
        dbsChecked: true,
        dbsCheckExpiry: new Date('2025-12-31'),
        manualHandlingCert: true,
        manualHandlingExpiry: new Date('2025-06-30'),
        firstAidCert: true,
        firstAidExpiry: new Date('2025-08-31'),
      }
    });

    // Assign skills to John Smith
    const skillsToAssign = [
      warehouseSkills[0], // Picking
      warehouseSkills[1], // Packing
      healthcareSkills[0], // Personal Care
      healthcareSkills[1], // Medication Administration
    ].filter(Boolean);

    for (const skill of skillsToAssign) {
      await prisma.workerSkill.create({
        data: {
          userId: johnSmith.id,
          skillId: skill.id,
          experience: '2-5 years',
          certification: true,
          certificationExpiry: new Date('2025-12-31'),
        }
      });
    }

    console.log('Created worker profile and skills');

    // Create client companies for shifts
    const clientCompanies = [
      {
        name: 'Amazon Warehouse',
        address: '100 Fulfilment Way, London, UK',
        siteLat: 51.5074,
        siteLng: -0.1278,
        defaultPayRate: 11.50,
        defaultChargeRate: 18.50,
        contactEmail: 'contact@amazon.co.uk',
        contactPhone: '+447000000001',
        organizationId: organization.id,
      },
      {
        name: 'St Mary Hospital',
        address: '1 Hospital Road, London, UK',
        siteLat: 51.5154,
        siteLng: -0.1419,
        defaultPayRate: 14.00,
        defaultChargeRate: 22.00,
        contactEmail: 'contact@stmary.nhs.uk',
        contactPhone: '+447000000002',
        organizationId: organization.id,
      },
      {
        name: 'Tesco Distribution',
        address: '500 Distribution Park, London, UK',
        siteLat: 51.4934,
        siteLng: -0.0098,
        defaultPayRate: 12.00,
        defaultChargeRate: 19.00,
        contactEmail: 'contact@tesco.co.uk',
        contactPhone: '+447000000003',
        organizationId: organization.id,
      },
    ];

    for (const clientData of clientCompanies) {
      await prisma.clientCompany.upsert({
        where: { name: clientData.name },
        update: {},
        create: clientData
      });
    }

    console.log('Created client companies');

    // Get client companies
    const amazon = await prisma.clientCompany.findFirst({ where: { name: 'Amazon Warehouse' } });
    const stMary = await prisma.clientCompany.findFirst({ where: { name: 'St Mary Hospital' } });
    const tesco = await prisma.clientCompany.findFirst({ where: { name: 'Tesco Distribution' } });

    // Create comprehensive shifts
    const now = new Date();
    const shifts = [];

    // Past shifts (completed)
    for (let i = 30; i >= 1; i--) {
      const shiftDate = new Date(now);
      shiftDate.setDate(shiftDate.getDate() - i);
      
      const shiftData = {
        title: i % 3 === 0 ? 'Warehouse Picking' : i % 3 === 1 ? 'Healthcare Support' : 'Distribution Packing',
        clientCompanyId: i % 3 === 0 ? amazon?.id : i % 3 === 1 ? stMary?.id : tesco?.id,
        startAt: new Date(shiftDate.setHours(9, 0, 0, 0)),
        endAt: new Date(shiftDate.setHours(17, 0, 0, 0)),
        breakMinutes: 60,
        hourlyRate: i % 3 === 0 ? 11.50 : i % 3 === 1 ? 14.00 : 12.00,
        chargeRate: i % 3 === 0 ? 18.50 : i % 3 === 1 ? 22.00 : 19.00,
        status: ShiftStatus.COMPLETED,
        priority: i % 4 === 0 ? ShiftPriority.HIGH : ShiftPriority.NORMAL,
        organizationId: organization.id,
        createdBy: manager.id,
      };
      shifts.push(shiftData);
    }

    // Current and upcoming shifts
    for (let i = 0; i <= 30; i++) {
      const shiftDate = new Date(now);
      shiftDate.setDate(shiftDate.getDate() + i);
      
      const shiftData = {
        title: i % 3 === 0 ? 'Night Shift - Picking' : i % 3 === 1 ? 'Day Shift - Care Support' : 'Evening Shift - Packing',
        clientCompanyId: i % 3 === 0 ? amazon?.id : i % 3 === 1 ? stMary?.id : tesco?.id,
        startAt: new Date(shiftDate.setHours(i % 3 === 0 ? 22 : i % 3 === 1 ? 8 : 16, 0, 0, 0)),
        endAt: new Date(shiftDate.setHours(i % 3 === 0 ? 6 : i % 3 === 1 ? 16 : 0, 0, 0, 0)),
        breakMinutes: i % 3 === 0 ? 45 : 60,
        hourlyRate: i % 3 === 0 ? 13.00 : i % 3 === 1 ? 15.00 : 13.50,
        chargeRate: i % 3 === 0 ? 20.00 : i % 3 === 1 ? 24.00 : 21.00,
        status: i === 0 ? ShiftStatus.IN_PROGRESS : i <= 7 ? ShiftStatus.ASSIGNED : ShiftStatus.PUBLISHED,
        priority: i <= 3 ? ShiftPriority.HIGH : ShiftPriority.NORMAL,
        organizationId: organization.id,
        createdBy: manager.id,
      };
      shifts.push(shiftData);
    }

    // Create shifts
    const createdShifts = [];
    for (const shiftData of shifts) {
      const shift = await prisma.shift.create({ data: shiftData });
      createdShifts.push(shift);
    }

    console.log(`Created ${createdShifts.length} shifts`);

    // Create shift assignments and attendance for John Smith
    for (let i = 0; i < createdShifts.length; i++) {
      const shift = createdShifts[i];
      
      // Assign John Smith to most shifts
      if (i % 5 !== 0) { // Skip some shifts to make it realistic
        const assignment = await prisma.shiftAssignment.create({
          data: {
            shiftId: shift.id,
            workerId: johnSmith.id,
            status: shift.status === ShiftStatus.COMPLETED ? 'COMPLETED' : 
                   shift.status === ShiftStatus.IN_PROGRESS ? 'ACTIVE' : 'ASSIGNED',
            assignedAt: new Date(shift.startAt.getTime() - 24 * 60 * 60 * 1000), // 1 day before shift
            assignedBy: manager.id,
          }
        });

        // Create attendance for completed shifts
        if (shift.status === ShiftStatus.COMPLETED) {
          const clockInTime = new Date(shift.startAt.getTime() + Math.random() * 30 * 60 * 1000); // Within 30 mins of start
          const clockOutTime = new Date(shift.endAt.getTime() - Math.random() * 30 * 60 * 1000); // Within 30 mins of end
          
          await prisma.attendance.create({
            data: {
              shiftId: shift.id,
              workerId: johnSmith.id,
              assignmentId: assignment.id,
              clockInAt: clockInTime,
              clockOutAt: clockOutTime,
              breakDuration: shift.breakMinutes,
              status: AttendanceStatus.COMPLETED,
              approvedAt: new Date(clockOutTime.getTime() + 60 * 60 * 1000), // 1 hour after clock out
              approvedBy: manager.id,
              notes: 'Good performance',
              locationVerified: true,
              locationVerifiedAt: clockInTime,
            }
          });
        }

        // Create attendance for in-progress shift
        if (shift.status === ShiftStatus.IN_PROGRESS) {
          await prisma.attendance.create({
            data: {
              shiftId: shift.id,
              workerId: johnSmith.id,
              assignmentId: assignment.id,
              clockInAt: new Date(shift.startAt.getTime() + 15 * 60 * 1000), // 15 mins after start
              status: AttendanceStatus.ACTIVE,
              notes: 'On shift',
              locationVerified: true,
              locationVerifiedAt: new Date(shift.startAt.getTime() + 15 * 60 * 1000),
            }
          });
        }
      }
    }

    console.log('Created shift assignments and attendance');

    // Create payslips for past 3 months
    for (let month = 0; month < 3; month++) {
      const payslipDate = new Date(now);
      payslipDate.setMonth(payslipDate.getMonth() - month);
      payslipDate.setDate(1); // First day of month
      
      const startDate = new Date(payslipDate);
      startDate.setDate(1);
      const endDate = new Date(payslipDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0); // Last day of month

      // Calculate hours worked in this month
      const monthShifts = createdShifts.filter(shift => 
        shift.startAt >= startDate && shift.startAt <= endDate && shift.status === ShiftStatus.COMPLETED
      );

      const totalHours = monthShifts.reduce((sum, shift) => {
        const hours = (shift.endAt.getTime() - shift.startAt.getTime()) / (1000 * 60 * 60);
        return sum + hours - (shift.breakMinutes / 60);
      }, 0);

      const grossPay = totalHours * 12.50; // Average hourly rate
      const tax = grossPay * 0.2; // 20% tax
      const ni = grossPay * 0.12; // 12% NI
      const netPay = grossPay - tax - ni;

      await prisma.payslip.create({
        data: {
          workerId: johnSmith.id,
          payPeriod: month === 0 ? PayPeriodStatus.CURRENT : month === 1 ? PayPeriodStatus.PREVIOUS : PayPeriodStatus.ARCHIVED,
          startDate,
          endDate,
          totalHours,
          grossPay,
          tax,
          nationalInsurance: ni,
          netPay,
          status: month === 0 ? PayslipStatus.DRAFT : month === 1 ? PayslipStatus.APPROVED : PayslipStatus.PAID,
          paymentDate: month === 2 ? new Date(endDate.getTime() + 5 * 24 * 60 * 60 * 1000) : null, // 5 days after month end
          createdAt: new Date(endDate.getTime() + 24 * 60 * 60 * 1000), // 1 day after month end
          organizationId: organization.id,
        }
      });
    }

    console.log('Created payslips for past 3 months');

    // Create leave requests
    const leaveRequests = [
      {
        type: LeaveType.ANNUAL,
        startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Next week
        endDate: new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000), // 2 days
        reason: 'Family vacation',
        status: LeaveStatus.PENDING,
      },
      {
        type: LeaveType.SICK,
        startDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        endDate: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000), // 1 day
        reason: 'Flu symptoms',
        status: LeaveStatus.APPROVED,
        approvedAt: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
        approvedBy: manager.id,
      },
      {
        type: LeaveType.ANNUAL,
        startDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // Next month
        endDate: new Date(now.getTime() + 34 * 24 * 60 * 60 * 1000), // 4 days
        reason: 'Christmas break',
        status: LeaveStatus.PENDING,
      },
    ];

    for (const leaveData of leaveRequests) {
      await prisma.leaveRequest.create({
        data: {
          ...leaveData,
          workerId: johnSmith.id,
          organizationId: organization.id,
          createdAt: new Date(),
        }
      });
    }

    console.log('Created leave requests');

    // Create worker availability schedule
    const availability = [
      { dayOfWeek: 1, available: true, preferredShift: 'DAY' }, // Monday
      { dayOfWeek: 2, available: true, preferredShift: 'DAY' }, // Tuesday
      { dayOfWeek: 3, available: true, preferredShift: 'NIGHT' }, // Wednesday
      { dayOfWeek: 4, available: true, preferredShift: 'DAY' }, // Thursday
      { dayOfWeek: 5, available: true, preferredShift: 'DAY' }, // Friday
      { dayOfWeek: 6, available: false, preferredShift: null }, // Saturday
      { dayOfWeek: 0, available: false, preferredShift: null }, // Sunday
    ];

    for (const avail of availability) {
      await prisma.workerAvailability.create({
        data: {
          userId: johnSmith.id,
          ...avail,
        }
      });
    }

    console.log('Created worker availability schedule');

    // Create notifications
    const notifications = [
      {
        title: 'Welcome to StaffSync!',
        message: 'Your profile is complete and ready for shifts.',
        type: 'SYSTEM',
        priority: 'NORMAL',
      },
      {
        title: 'New Shift Available',
        message: 'Night shift at Amazon Warehouse - £13.00/hour',
        type: 'SHIFT',
        priority: 'HIGH',
      },
      {
        title: 'Payslip Available',
        message: 'Your payslip for last month is ready to view.',
        type: 'PAYSLIP',
        priority: 'NORMAL',
      },
      {
        title: 'Leave Request Update',
        message: 'Your sick leave request has been approved.',
        type: 'LEAVE',
        priority: 'NORMAL',
      },
      {
        title: 'Manager Assignment',
        message: 'Sarah Johnson has been assigned as your manager.',
        type: 'SYSTEM',
        priority: 'NORMAL',
      },
    ];

    for (const notif of notifications) {
      await prisma.notification.create({
        data: {
          ...notif,
          userId: johnSmith.id,
          organizationId: organization.id,
          createdAt: new Date(),
          read: false,
        }
      });
    }

    console.log('Created notifications');

    // Create wallet
    const hashedPin = await bcrypt.hash('1234', 10);
    await prisma.wallet.upsert({
      where: { userId: johnSmith.id },
      update: { pin: hashedPin },
      create: {
        userId: johnSmith.id,
        balance: 0.00,
        pin: hashedPin,
        organizationId: organization.id,
      }
    });

    console.log('Created wallet');

    console.log('\n=== JOHN SMITH COMPREHENSIVE DATA SEEDING COMPLETE ===');
    console.log(`Worker: ${johnSmith.fullName} (${johnSmith.email})`);
    console.log(`Manager: ${manager.fullName} (${manager.email})`);
    console.log(`Organization: ${organization.name}`);
    console.log(`Shifts: ${createdShifts.length} total`);
    console.log(`Payslips: 3 (draft, approved, paid)`);
    console.log(`Leave Requests: 3`);
    console.log(`Skills: ${skillsToAssign.length}`);
    console.log(`Availability: 7 days scheduled`);
    console.log(`Notifications: 5`);
    console.log(`Wallet PIN: 1234`);

  } catch (error) {
    console.error('Error seeding John Smith data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedJohnSmithComprehensive().catch(console.error);
