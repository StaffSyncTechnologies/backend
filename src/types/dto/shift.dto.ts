import { ShiftStatus, AssignmentStatus } from '@prisma/client';

// Request DTOs
export interface CreateShiftRequest {
  locationId: string;
  clientCompanyId?: string;
  title: string;
  description?: string;
  date: string; // ISO date
  startTime: string; // HH:mm
  endTime: string;
  breakMinutes?: number;
  requiredWorkers: number;
  payRate?: number;
  chargeRate?: number;
  notes?: string;
  requiredSkillIds?: string[];
}

export interface UpdateShiftRequest {
  title?: string;
  description?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  requiredWorkers?: number;
  payRate?: number;
  chargeRate?: number;
  notes?: string;
  status?: ShiftStatus;
}

export interface AssignWorkerRequest {
  workerId: string;
  payRate?: number;
  notes?: string;
}

export interface ShiftFilterParams {
  locationId?: string;
  clientCompanyId?: string;
  status?: ShiftStatus;
  startDate?: string;
  endDate?: string;
  workerId?: string;
}

// Response DTOs
export interface ShiftResponse {
  id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: ShiftStatus;
  requiredWorkers: number;
  assignedWorkers: number;
  payRate: number;
  chargeRate: number;
  location: {
    id: string;
    name: string;
    address: string;
  };
  clientCompany?: {
    id: string;
    name: string;
  };
}

export interface ShiftDetailResponse extends ShiftResponse {
  assignments: ShiftAssignmentResponse[];
  requiredSkills: {
    id: string;
    name: string;
  }[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShiftAssignmentResponse {
  id: string;
  workerId: string;
  workerName: string;
  workerAvatar?: string;
  status: AssignmentStatus;
  payRate: number;
  clockInTime?: Date;
  clockOutTime?: Date;
  actualBreakMinutes?: number;
}

export interface ShiftListResponse {
  shifts: ShiftResponse[];
  total: number;
}
