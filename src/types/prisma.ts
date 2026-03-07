// Re-export Prisma generated types for convenience
export {
  User,
  Organization,
  ClientCompany,
  Shift,
  ShiftAssignment,
  Rota,
  Skill,
  WorkerSkill,
  Location,
  Attendance,
  Notification,
  InviteCode,
  WorkerReliabilityScore,
  WorkerBlock,
  WorkerAvailability,
  ClientPayRate,
  WorkerProfile,
  WorkerDocument,
  PayPeriod,
  Payslip,
  PayslipLineItem,
  LeaveEntitlement,
  LeaveRequest,
  // Enums
  UserRole,
  UserStatus,
  DeploymentMode,
  ShiftStatus,
  AssignmentStatus,
  AttendanceStatus,
  PayslipStatus,
  DocumentType,
  BlockType,
  BlockStatus,
  BlockReason,
  DayOfWeek,
  LeaveType,
  LeaveStatus,
} from '@prisma/client';

// Prisma utility types
import { Prisma } from '@prisma/client';

export type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    organization: true;
    workerSkills: { include: { skill: true } };
    reliabilityScore: true;
  };
}>;

export type ShiftWithRelations = Prisma.ShiftGetPayload<{
  include: {
    location: true;
    assignments: { include: { worker: true } };
    skillsRequired: { include: { skill: true } };
  };
}>;

export type OrganizationWithRelations = Prisma.OrganizationGetPayload<{
  include: {
    users: true;
    clientCompanies: true;
    locations: true;
  };
}>;

export type ClientCompanyWithRelations = Prisma.ClientCompanyGetPayload<{
  include: {
    organization: true;
    shifts: true;
    payRates: true;
  };
}>;

export type AttendanceWithRelations = Prisma.AttendanceGetPayload<{
  include: {
    worker: true;
    shift: { include: { location: true } };
  };
}>;

export type PayslipWithRelations = Prisma.PayslipGetPayload<{
  include: {
    worker: true;
    payPeriod: true;
    lineItems: true;
  };
}>;
