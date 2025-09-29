// src/types/database.ts
// Re-export Prisma types for easier importing throughout the app

import type {
  User,
  Profile,
  Event,
  EventCategory,
  Registration,
  Team,
  TeamMember,
  AuditLog,
  QrCode,
  OtpRequest,
  CustomField,
  RefreshToken,
  UserRole,
  RegistrationStatus,
  AuditAction,
  Prisma,
  PrismaClient,
} from '@prisma/client';

// Re-export main Prisma types
export type {
  User,
  Profile,
  Event,
  EventCategory,
  Registration,
  Team,
  TeamMember,
  AuditLog,
  QrCode,
  OtpRequest,
  CustomField,
  RefreshToken,
  UserRole,
  RegistrationStatus,
  AuditAction,
  Prisma,
  PrismaClient,
};

// ========================
// Extended Types
// ========================

export interface UserWithRelations extends User {
  profile?: Profile;
  managedEvents?: Event[];
  refreshTokens?: RefreshToken[];
}

export interface EventWithDetails extends Event {
  manager: User;
  category: EventCategory;
  registrations?: Registration[];
  teams?: Team[];
  customFields?: CustomField[];
  _count?: {
    registrations: number;
    teams: number;
    customFields: number;
  };
}

export interface RegistrationWithRelations extends Registration {
  event: Event;
  profile?: Profile;
  qrCodes?: QrCode[];
  otpRequests?: OtpRequest[];
}

export interface AuditLogWithActor extends AuditLog {
  actor?: User;
}

export interface TeamWithMembers extends Team {
  event: Event;
  members?: TeamMember[];
}

// ========================
// API Response Types
// ========================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ========================
// OTP
// ========================

export interface OtpResponse {
  success: boolean;
  message: string;
  expiresAt: Date;
  attemptsLeft: number;
}

// ========================
// QR Codes
// ========================

export interface QrCodeData {
  registrationId: string;
  eventId: string;
  issuedAt: number;
  expiresAt: number;
  signature?: string;
}

// ========================
// Event Statistics
// ========================

export interface EventStats {
  totalEvents: number;
  upcomingEvents: number;
  ongoingEvents: number;
  completedEvents: number;
  totalRegistrations: number;
  approvedRegistrations: number;
  pendingRegistrations: number;
  rejectedRegistrations: number;
}

// ========================
// System Config
// ========================

export interface SystemConfig {
  maxFileSize: number;
  allowedImageTypes: string[];
  otpExpiryMinutes: number;
  otpMaxAttempts: number;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
  auditLogRetentionDays: number;
  bcryptRounds: number;
}

// ========================
// Database Transaction Type
// ========================

export type DatabaseTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>;

// ========================
// Error Classes
// ========================

export class DatabaseError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}
