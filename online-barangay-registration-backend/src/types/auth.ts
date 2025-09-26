export interface User {
  id: string;
  email: string;
  phone?: string;
  password_hash: string;
  role: UserRole;
  name: string;
  barangay: string;
  created_at: Date;
  updated_at: Date;
}

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  EVENT_MANAGER = 'event_manager',
  STAFF = 'staff',
  RESIDENT = 'resident',
  GUEST = 'guest',
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}