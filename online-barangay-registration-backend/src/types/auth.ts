// src/types/auth.ts

export interface AuthUser {
  id: string;
  email: string;
  phone?: string;
  password_hash: string;
  role: AuthUserRole;
  name: string;
  barangay: string;
  created_at: Date;
  updated_at: Date;
}

export enum AuthUserRole {
  SUPER_ADMIN = 'super_admin',
  EVENT_MANAGER = 'event_manager',
  STAFF = 'staff',
  RESIDENT = 'resident',
  GUEST = 'guest',
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: AuthUserRole;
  iat?: number;
  exp?: number;
}
