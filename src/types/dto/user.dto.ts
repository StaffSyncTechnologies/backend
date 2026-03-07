import { UserRole, UserStatus } from '@prisma/client';

// Request DTOs
export interface CreateUserRequest {
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  jobTitle?: string;
  department?: string;
  sendInvite?: boolean;
}

export interface UpdateUserRequest {
  fullName?: string;
  phone?: string;
  jobTitle?: string;
  department?: string;
  status?: UserStatus;
  avatarUrl?: string;
}

export interface InviteUserRequest {
  email: string;
  fullName: string;
  role: UserRole;
}

export interface UserFilterParams {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  department?: string;
}

// Response DTOs
export interface UserResponse {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  phone?: string;
  jobTitle?: string;
  department?: string;
  avatarUrl?: string;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface UserListResponse {
  users: UserResponse[];
  total: number;
}

export interface UserDetailResponse extends UserResponse {
  organization: {
    id: string;
    name: string;
  };
  skills?: {
    id: string;
    name: string;
    level: number;
  }[];
  reliabilityScore?: number;
}
