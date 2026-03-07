import { UserStatus, DayOfWeek } from '@prisma/client';

export interface IWorker {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  status: UserStatus;
  organizationId: string;

  // Computed properties
  isAvailable(date: Date): boolean;
  canWorkShift(shiftStart: Date, shiftEnd: Date): boolean;
  hasSkill(skillId: string): boolean;
  calculateReliabilityScore(): number;
}

export interface WorkerAvailabilitySlot {
  dayOfWeek: DayOfWeek;
  isAvailable: boolean;
  startTime?: string;
  endTime?: string;
}

export interface WorkerEligibility {
  workerId: string;
  isEligible: boolean;
  reasons: EligibilityReason[];
}

export type EligibilityReason =
  | { type: 'AVAILABLE'; message: string }
  | { type: 'UNAVAILABLE'; message: string }
  | { type: 'CONFLICT'; shiftId: string; message: string }
  | { type: 'BLOCKED'; clientId?: string; message: string }
  | { type: 'MISSING_SKILL'; skillId: string; message: string }
  | { type: 'MAX_HOURS_EXCEEDED'; currentHours: number; message: string }
  | { type: 'REST_PERIOD'; previousShiftEnd: Date; message: string };

export interface WorkerMetrics {
  workerId: string;
  period: 'week' | 'month' | 'year' | 'all';
  totalShifts: number;
  completedShifts: number;
  cancelledShifts: number;
  noShows: number;
  lateArrivals: number;
  totalHours: number;
  totalEarnings: number;
  avgRating?: number;
  reliabilityScore: number;
}

export interface WorkerPayCalculation {
  baseHours: number;
  baseRate: number;
  basePay: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimePay: number;
  holidayHours: number;
  holidayRate: number;
  holidayPay: number;
  deductions: number;
  grossPay: number;
  netPay: number;
}
