import { UserStatus, DayOfWeek } from '@prisma/client';

// Request DTOs
export interface CreateWorkerRequest {
  email: string;
  fullName: string;
  phone?: string;
  dateOfBirth?: string;
  nationalInsurance?: string;
  address?: string;
  city?: string;
  postcode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankSortCode?: string;
  skillIds?: string[];
  defaultPayRate?: number;
}

export interface UpdateWorkerRequest {
  fullName?: string;
  phone?: string;
  address?: string;
  city?: string;
  postcode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  status?: UserStatus;
  defaultPayRate?: number;
}

export interface SetAvailabilityRequest {
  availability: {
    dayOfWeek: DayOfWeek;
    isAvailable: boolean;
    startTime?: string; // HH:mm
    endTime?: string;
  }[];
}

export interface RequestTimeOffRequest {
  startDate: string;
  endDate: string;
  reason?: string;
}

export interface WorkerFilterParams {
  status?: UserStatus;
  skillId?: string;
  search?: string;
  availableOn?: string; // ISO date
}

// Response DTOs
export interface WorkerResponse {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  status: UserStatus;
  avatarUrl?: string;
  defaultPayRate?: number;
  reliabilityScore: number;
  skillCount: number;
  completedShifts: number;
}

export interface WorkerDetailResponse extends WorkerResponse {
  dateOfBirth?: string;
  address?: string;
  city?: string;
  postcode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  skills: {
    id: string;
    name: string;
    category: string;
    level: number;
    verifiedAt?: Date;
  }[];
  availability: {
    dayOfWeek: DayOfWeek;
    isAvailable: boolean;
    startTime?: string;
    endTime?: string;
  }[];
  documents: {
    id: string;
    type: string;
    name: string;
    expiresAt?: Date;
  }[];
  stats: WorkerStatsResponse;
}

export interface WorkerStatsResponse {
  totalShifts: number;
  completedShifts: number;
  upcomingShifts: number;
  hoursThisWeek: number;
  hoursThisMonth: number;
  earningsThisMonth: number;
  avgRating?: number;
  noShows: number;
  lateArrivals: number;
}

export interface WorkerListResponse {
  workers: WorkerResponse[];
  total: number;
}

export interface WorkerScheduleResponse {
  date: string;
  shifts: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    location: string;
    status: string;
  }[];
}
