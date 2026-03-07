// Timesheet status type (not a Prisma model, custom interface)
export type TimesheetStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPUTED';

export interface ITimesheet {
  id: string;
  shiftId: string;
  workerId: string;
  status: TimesheetStatus;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualStart?: Date;
  actualEnd?: Date;

  // Computed
  scheduledHours: number;
  actualHours: number;
  variance: number;
  isLate: boolean;
  isEarlyLeave: boolean;
}

export interface TimesheetEntry {
  timesheetId: string;
  clockIn: Date;
  clockOut?: Date;
  breakStart?: Date;
  breakEnd?: Date;
  notes?: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export interface TimesheetApproval {
  timesheetId: string;
  action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
  approvedBy: string;
  approvedAt: Date;
  adjustedHours?: number;
  adjustmentReason?: string;
  notes?: string;
}

export interface TimesheetSummary {
  workerId: string;
  periodStart: Date;
  periodEnd: Date;
  totalShifts: number;
  totalScheduledHours: number;
  totalActualHours: number;
  totalApprovedHours: number;
  pendingApproval: number;
  disputed: number;
}

export interface TimesheetDispute {
  timesheetId: string;
  raisedBy: 'WORKER' | 'CLIENT' | 'AGENCY';
  reason: string;
  requestedHours?: number;
  evidence?: string[];
  status: 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'ESCALATED';
  resolution?: string;
}

export interface BulkTimesheetApproval {
  timesheetIds: string[];
  action: 'APPROVE' | 'REJECT';
  approvedBy: string;
  notes?: string;
}
