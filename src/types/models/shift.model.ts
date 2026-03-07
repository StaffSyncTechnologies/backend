import { ShiftStatus, AssignmentStatus } from '@prisma/client';

export interface IShift {
  id: string;
  title: string;
  date: Date;
  startTime: Date;
  endTime: Date;
  status: ShiftStatus;
  locationId: string;
  organizationId: string;

  // Computed
  durationHours: number;
  isFilled: boolean;
  isUpcoming: boolean;
  isInProgress: boolean;
  isCompleted: boolean;
}

export interface ShiftRequirements {
  shiftId: string;
  requiredWorkers: number;
  assignedWorkers: number;
  requiredSkills: string[];
  minimumReliabilityScore?: number;
}

export interface ShiftConflict {
  type: 'OVERLAP' | 'REST_PERIOD' | 'MAX_HOURS';
  conflictingShiftId?: string;
  message: string;
}

export interface IShiftAssignment {
  shiftId: string;
  workerId: string;
  status: AssignmentStatus;
  payRate: number;
  assignedAt: Date;
  confirmedAt?: Date;
  clockInTime?: Date;
  clockOutTime?: Date;
}

export interface ShiftCoverage {
  shiftId: string;
  required: number;
  confirmed: number;
  pending: number;
  declined: number;
  coveragePercent: number;
  status: 'UNDERSTAFFED' | 'PARTIAL' | 'FULLY_STAFFED' | 'OVERSTAFFED';
}

export interface ShiftCostEstimate {
  shiftId: string;
  estimatedHours: number;
  laborCost: number;
  chargeAmount: number;
  grossMargin: number;
  marginPercent: number;
}

export interface BulkShiftOperation {
  action: 'CREATE' | 'UPDATE' | 'CANCEL' | 'ASSIGN';
  shiftIds: string[];
  data?: Partial<IShift>;
  workerIds?: string[];
}

export interface ShiftTemplate {
  id: string;
  name: string;
  title: string;
  startTime: string; // HH:mm
  endTime: string;
  breakMinutes: number;
  requiredWorkers: number;
  locationId: string;
  requiredSkillIds: string[];
  payRate?: number;
  chargeRate?: number;
}
