import { DeploymentMode } from '@prisma/client';

// Request DTOs
export interface UpdateOrganizationRequest {
  name?: string;
  legalName?: string;
  registrationNumber?: string;
  vatNumber?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  postcode?: string;
  country?: string;
}

export interface UpdateBrandingRequest {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  customDomain?: string;
}

export interface UpdateSettingsRequest {
  timezone?: string;
  dateFormat?: string;
  currency?: string;
  defaultPayRate?: number;
  defaultChargeRate?: number;
  overtimeMultiplier?: number;
  weekendMultiplier?: number;
  holidayMultiplier?: number;
  minimumShiftHours?: number;
  maximumShiftHours?: number;
  breakThresholdHours?: number;
  breakDurationMinutes?: number;
  autoApproveTimesheets?: boolean;
  requireGeolocation?: boolean;
  allowShiftSwaps?: boolean;
}

// Response DTOs
export interface OrganizationResponse {
  id: string;
  name: string;
  deploymentMode: DeploymentMode;
  legalName?: string;
  registrationNumber?: string;
  vatNumber?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  postcode?: string;
  country?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  onboardingComplete: boolean;
  createdAt: Date;
}

export interface OrganizationSettingsResponse {
  timezone: string;
  dateFormat: string;
  currency: string;
  defaultPayRate: number;
  defaultChargeRate: number;
  overtimeMultiplier: number;
  weekendMultiplier: number;
  holidayMultiplier: number;
  minimumShiftHours: number;
  maximumShiftHours: number;
  breakThresholdHours: number;
  breakDurationMinutes: number;
  autoApproveTimesheets: boolean;
  requireGeolocation: boolean;
  allowShiftSwaps: boolean;
}

export interface OrganizationStatsResponse {
  totalWorkers: number;
  activeWorkers: number;
  totalClients: number;
  totalShifts: number;
  pendingTimesheets: number;
  unpaidInvoices: number;
}
