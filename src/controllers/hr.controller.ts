import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError, NotFoundError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import * as XLSX from 'xlsx';

export class HRController {
  /**
   * Get manager statistics for HR dashboard
   */
  getManagerStats = async (req: AuthRequest, res: Response) => {
    const organizationId = req.user!.organizationId;
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get current counts
    const [totalManagers, activeManagers, inactiveManagers] = await Promise.all([
      prisma.user.count({
        where: {
          organizationId,
          role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
        },
      }),
      prisma.user.count({
        where: {
          organizationId,
          role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
          status: 'ACTIVE',
        },
      }),
      prisma.user.count({
        where: {
          organizationId,
          role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
          status: 'SUSPENDED',
        },
      }),
    ]);

    // Get counts from one week ago for percentage change
    const [totalLastWeek, activeLastWeek, inactiveLastWeek] = await Promise.all([
      prisma.user.count({
        where: {
          organizationId,
          role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
          createdAt: { lt: oneWeekAgo },
        },
      }),
      prisma.user.count({
        where: {
          organizationId,
          role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
          status: 'ACTIVE',
          createdAt: { lt: oneWeekAgo },
        },
      }),
      prisma.user.count({
        where: {
          organizationId,
          role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
          status: 'SUSPENDED',
          createdAt: { lt: oneWeekAgo },
        },
      }),
    ]);

    // Calculate average compliance score (based on managed workers with complete RTW)
    const managersWithCompliance = await prisma.user.findMany({
      where: {
        organizationId,
        role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
      },
      select: {
        id: true,
        managedWorkers: {
          where: { role: 'WORKER' },
          select: {
            workerProfile: {
              select: { rtwStatus: true },
            },
          },
        },
      },
    });

    let totalComplianceScore = 0;
    let managersWithWorkers = 0;

    for (const manager of managersWithCompliance) {
      if (manager.managedWorkers.length > 0) {
        const verifiedWorkers = manager.managedWorkers.filter(
          w => w.workerProfile?.rtwStatus === 'APPROVED'
        ).length;
        const complianceScore = (verifiedWorkers / manager.managedWorkers.length) * 100;
        totalComplianceScore += complianceScore;
        managersWithWorkers++;
      }
    }

    const averageCompliance = managersWithWorkers > 0
      ? Math.round(totalComplianceScore / managersWithWorkers)
      : 0;

    // Calculate percentage changes
    const calcChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100 * 10) / 10;
    };

    res.json({
      success: true,
      data: {
        totalManagers: {
          count: totalManagers,
          change: calcChange(totalManagers, totalLastWeek),
        },
        activeManagers: {
          count: activeManagers,
          change: calcChange(activeManagers, activeLastWeek),
        },
        inactiveManagers: {
          count: inactiveManagers,
          change: calcChange(inactiveManagers, inactiveLastWeek),
        },
        averageCompliance: {
          score: averageCompliance,
          change: 0, // Would need historical data to calculate
        },
      },
    });
  };

  /**
   * List managers with pagination, search, and filtering
   */
  listManagers = async (req: AuthRequest, res: Response) => {
    const query = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(10),
      search: z.string().optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'INVITED', 'PENDING']).optional(),
      role: z.enum(['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER']).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      sortBy: z.enum(['fullName', 'email', 'role', 'createdAt', 'managedWorkersCount']).default('fullName'),
      sortOrder: z.enum(['asc', 'desc']).default('asc'),
    }).parse(req.query);

    const organizationId = req.user!.organizationId;
    const skip = (query.page - 1) * query.limit;

    // Build where clause
    const where: any = {
      organizationId,
      role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
    };

    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { teamNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.role) {
      where.role = query.role;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    // Get total count
    const total = await prisma.user.count({ where });

    // Get managers with their subordinates
    const managers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        teamNumber: true,
        profilePicUrl: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: { managedWorkers: true },
        },
        // For Ops Managers: get their Shift Coordinators
        managedWorkers: {
          where: { role: 'SHIFT_COORDINATOR' },
          select: {
            id: true,
            _count: { select: { managedWorkers: true } },
          },
        },
      },
      skip,
      take: query.limit,
      orderBy: query.sortBy === 'managedWorkersCount'
        ? { managedWorkers: { _count: query.sortOrder } }
        : { [query.sortBy]: query.sortOrder },
    });

    // Format role for display
    const roleDisplayMap: Record<string, string> = {
      OPS_MANAGER: 'OPS Manager',
      SHIFT_COORDINATOR: 'Shift Coordinator',
      COMPLIANCE_OFFICER: 'Compliance Officer',
    };

    const formattedManagers = managers.map(m => {
      let managedWorkersCount = 0;
      
      if (m.role === 'SHIFT_COORDINATOR') {
        // Shift Coordinator: count workers directly assigned to them
        managedWorkersCount = m._count.managedWorkers;
      } else if (m.role === 'OPS_MANAGER') {
        // Ops Manager: count workers under their Shift Coordinators
        managedWorkersCount = m.managedWorkers.reduce(
          (sum, sc) => sum + sc._count.managedWorkers,
          0
        );
      }
      // Compliance Officer: 0 managed workers

      return {
        id: m.id,
        fullName: m.fullName,
        email: m.email,
        phone: m.phone,
        role: m.role,
        roleDisplay: roleDisplayMap[m.role] || m.role,
        status: m.status,
        teamNumber: m.teamNumber,
        profilePicUrl: m.profilePicUrl,
        managedWorkersCount,
        createdAt: m.createdAt,
        lastLoginAt: m.lastLoginAt,
      };
    });

    res.json({
      success: true,
      data: {
        managers: formattedManagers,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
    });
  };

  /**
   * Get single manager details
   */
  getManager = async (req: AuthRequest, res: Response) => {
    const { managerId } = req.params;

    const manager = await prisma.user.findFirst({
      where: {
        id: managerId,
        organizationId: req.user!.organizationId,
        role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        teamNumber: true,
        profilePicUrl: true,
        createdAt: true,
        lastLoginAt: true,
        managedWorkers: {
          select: {
            id: true,
            fullName: true,
            email: true,
            status: true,
            workerProfile: {
              select: { rtwStatus: true, onboardingStatus: true },
            },
          },
        },
        staffCompanyAssignments: {
          where: { status: 'ACTIVE' },
          select: {
            clientCompany: {
              select: { id: true, name: true },
            },
            isPrimary: true,
          },
        },
      },
    });

    if (!manager) {
      throw new NotFoundError('Manager');
    }

    res.json({ success: true, data: manager });
  };

  /**
   * Export managers to XLS
   */
  exportManagers = async (req: AuthRequest, res: Response) => {
    const query = z.object({
      status: z.enum(['ACTIVE', 'SUSPENDED', 'INVITED', 'PENDING']).optional(),
      role: z.enum(['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER']).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).parse(req.query);

    const organizationId = req.user!.organizationId;

    const where: any = {
      organizationId,
      role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
    };

    if (query.status) where.status = query.status;
    if (query.role) where.role = query.role;
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const managers = await prisma.user.findMany({
      where,
      select: {
        fullName: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        teamNumber: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: { managedWorkers: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const roleDisplayMap: Record<string, string> = {
      OPS_MANAGER: 'OPS Manager',
      SHIFT_COORDINATOR: 'Shift Coordinator',
      COMPLIANCE_OFFICER: 'Compliance Officer',
    };

    const data = managers.map(m => ({
      'Full Name': m.fullName,
      'Team Number': m.teamNumber || '-',
      'Email': m.email,
      'Phone': m.phone || '-',
      'Role': roleDisplayMap[m.role] || m.role,
      'Status': m.status,
      'Managed Workers': m._count.managedWorkers,
      'Created At': m.createdAt.toISOString().split('T')[0],
      'Last Login': m.lastLoginAt ? m.lastLoginAt.toISOString().split('T')[0] : 'Never',
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(data);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Full Name
      { wch: 15 }, // Team Number
      { wch: 30 }, // Email
      { wch: 15 }, // Phone
      { wch: 20 }, // Role
      { wch: 12 }, // Status
      { wch: 15 }, // Managed Workers
      { wch: 12 }, // Created At
      { wch: 12 }, // Last Login
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Managers');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=managers_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  };

  /**
   * Update manager status (activate/suspend)
   */
  updateManagerStatus = async (req: AuthRequest, res: Response) => {
    const { managerId } = req.params;
    const { status } = z.object({
      status: z.enum(['ACTIVE', 'SUSPENDED']),
    }).parse(req.body);

    const result = await prisma.user.updateMany({
      where: {
        id: managerId,
        organizationId: req.user!.organizationId,
        role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
      },
      data: { status },
    });

    if (result.count === 0) {
      throw new NotFoundError('Manager');
    }

    res.json({
      success: true,
      message: status === 'ACTIVE' ? 'Manager activated' : 'Manager suspended',
    });
  };

  /**
   * Delete manager
   */
  deleteManager = async (req: AuthRequest, res: Response) => {
    const { managerId } = req.params;

    if (managerId === req.user!.id) {
      throw new AppError('Cannot delete yourself', 400, 'CANNOT_DELETE_SELF');
    }

    // Unassign workers before deleting
    await prisma.user.updateMany({
      where: { managerId },
      data: { managerId: null },
    });

    const result = await prisma.user.deleteMany({
      where: {
        id: managerId,
        organizationId: req.user!.organizationId,
        role: { in: ['OPS_MANAGER', 'SHIFT_COORDINATOR', 'COMPLIANCE_OFFICER'] },
      },
    });

    if (result.count === 0) {
      throw new NotFoundError('Manager');
    }

    res.json({ success: true, message: 'Manager deleted' });
  };

  // ============================================================
  // WORKER-MANAGER ASSIGNMENT
  // ============================================================

  /**
   * Assign workers to a Shift Coordinator (Admin and Ops Manager can perform this)
   */
  assignWorkersToManager = async (req: AuthRequest, res: Response) => {
    const { managerId } = req.params;
    const { workerIds } = z.object({
      workerIds: z.array(z.string().uuid()),
    }).parse(req.body);

    // Verify target is a Shift Coordinator (workers can only be assigned to Shift Coordinators)
    const manager = await prisma.user.findFirst({
      where: {
        id: managerId,
        organizationId: req.user!.organizationId,
        role: 'SHIFT_COORDINATOR',
      },
    });

    if (!manager) {
      throw new AppError('Shift Coordinator not found. Workers can only be assigned to Shift Coordinators.', 404, 'SHIFT_COORDINATOR_NOT_FOUND');
    }

    // Assign workers to manager
    const result = await prisma.user.updateMany({
      where: {
        id: { in: workerIds },
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
      data: { managerId },
    });

    res.json({
      success: true,
      message: `${result.count} workers assigned to ${manager.fullName}`,
      data: { assignedCount: result.count, managerId, managerName: manager.fullName },
    });
  };

  /**
   * Remove manager assignment from workers
   */
  unassignWorkersFromManager = async (req: AuthRequest, res: Response) => {
    const { workerIds } = z.object({
      workerIds: z.array(z.string().uuid()),
    }).parse(req.body);

    const result = await prisma.user.updateMany({
      where: {
        id: { in: workerIds },
        organizationId: req.user!.organizationId,
        role: 'WORKER',
      },
      data: { managerId: null },
    });

    res.json({
      success: true,
      message: `${result.count} workers unassigned`,
      data: { unassignedCount: result.count },
    });
  };

  /**
   * Get workers managed by a specific staff member
   */
  getManagedWorkers = async (req: AuthRequest, res: Response) => {
    const { managerId } = req.params;

    const workers = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        managerId,
        role: 'WORKER',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        workerProfile: {
          select: { onboardingStatus: true, rtwStatus: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({ success: true, data: workers });
  };

  /**
   * Get my managed workers (for logged-in staff member)
   */
  getMyManagedWorkers = async (req: AuthRequest, res: Response) => {
    if (req.user!.role === 'WORKER') {
      throw new AppError('Workers cannot manage other workers', 403, 'FORBIDDEN');
    }

    const workers = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        managerId: req.user!.id,
        role: 'WORKER',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        workerProfile: {
          select: { onboardingStatus: true, rtwStatus: true },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({ success: true, data: workers, count: workers.length });
  };

  /**
   * Get unassigned workers (no manager assigned)
   */
  getUnassignedWorkers = async (req: AuthRequest, res: Response) => {
    const workers = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        role: 'WORKER',
        managerId: null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({ success: true, data: workers, count: workers.length });
  };

  /**
   * Get staff members with their managed worker counts (hierarchy-aware)
   */
  getStaffWithWorkerCounts = async (req: AuthRequest, res: Response) => {
    const staff = await prisma.user.findMany({
      where: {
        organizationId: req.user!.organizationId,
        role: { notIn: ['WORKER'] },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        _count: {
          select: { managedWorkers: true },
        },
        // For Ops Managers: get their Shift Coordinators' worker counts
        managedWorkers: {
          where: { role: 'SHIFT_COORDINATOR' },
          select: {
            _count: { select: { managedWorkers: true } },
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    res.json({
      success: true,
      data: staff.map(s => {
        let managedWorkersCount = 0;
        
        if (s.role === 'SHIFT_COORDINATOR') {
          managedWorkersCount = s._count.managedWorkers;
        } else if (s.role === 'OPS_MANAGER') {
          managedWorkersCount = s.managedWorkers.reduce(
            (sum, sc) => sum + sc._count.managedWorkers,
            0
          );
        }

        return {
          id: s.id,
          fullName: s.fullName,
          email: s.email,
          role: s.role,
          status: s.status,
          managedWorkersCount,
        };
      }),
    });
  };
}
