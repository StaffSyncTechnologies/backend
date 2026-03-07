// Request DTOs
export interface CreateClientCompanyRequest {
  name: string;
  registrationNumber?: string;
  industry?: string;
  address?: string;
  city?: string;
  postcode?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  defaultPayRate?: number;
  defaultChargeRate?: number;
  createAdmin?: boolean;
  admin?: {
    fullName: string;
    email: string;
    phone?: string;
    jobTitle?: string;
    sendInvite?: boolean;
  };
}

export interface UpdateClientCompanyRequest {
  name?: string;
  registrationNumber?: string;
  industry?: string;
  address?: string;
  city?: string;
  postcode?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  defaultPayRate?: number;
  defaultChargeRate?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface CreateClientLocationRequest {
  name: string;
  address: string;
  city: string;
  postcode: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

export interface SetClientPayRatesRequest {
  defaultPayRate?: number;
  defaultChargeRate?: number;
  skillRates?: {
    skillId: string;
    payRate: number;
    chargeRate: number;
  }[];
}

export interface ClientFilterParams {
  status?: string;
  industry?: string;
  search?: string;
}

// Response DTOs
export interface ClientCompanyResponse {
  id: string;
  name: string;
  industry?: string;
  status: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  city?: string;
  postcode?: string;
  activeWorkers: number;
  totalShifts: number;
  createdAt: Date;
}

export interface ClientCompanyDetailResponse extends ClientCompanyResponse {
  registrationNumber?: string;
  defaultPayRate?: number;
  defaultChargeRate?: number;
  locations: ClientLocationResponse[];
  users: ClientUserResponse[];
  payRates: ClientPayRateResponse[];
  stats: ClientStatsResponse;
}

export interface ClientLocationResponse {
  id: string;
  name: string;
  address: string;
  city: string;
  postcode: string;
  contactName?: string;
  contactPhone?: string;
}

export interface ClientUserResponse {
  id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  jobTitle?: string;
  lastLoginAt?: Date;
}

export interface ClientPayRateResponse {
  skillId?: string;
  skillName?: string;
  payRate: number;
  chargeRate: number;
}

export interface ClientStatsResponse {
  totalShifts: number;
  completedShifts: number;
  upcomingShifts: number;
  totalHours: number;
  totalSpend: number;
  avgRating?: number;
}

export interface ClientListResponse {
  clients: ClientCompanyResponse[];
  total: number;
}
