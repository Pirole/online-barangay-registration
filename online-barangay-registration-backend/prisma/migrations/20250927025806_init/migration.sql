-- ================================================
-- ONLINE BARANGAY REGISTRATION SYSTEM - DATABASE SCHEMA
-- ================================================
-- Migration 001: Initial Schema Setup
-- Run these in order, or use a migration tool like Knex/Prisma

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- CORE TABLES
-- ================================================

-- 1. ROLES TABLE (Static roles)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO roles (name, description, permissions) VALUES
('SuperAdmin', 'Full system access', '["*"]'),
('EventManager', 'Manage assigned events', '["events.manage", "registrations.approve", "users.view"]'),
('Staff', 'Read-only access to events', '["events.view", "registrations.view"]'),
('Resident', 'Register for events', '["events.register", "profile.manage"]');

-- 2. USERS TABLE (Authentication & Basic Info)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. PROFILES TABLE (Extended user information)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    age INTEGER,
    birth_date DATE,
    address TEXT,
    barangay VARCHAR(100) NOT NULL,
    city VARCHAR(100) DEFAULT 'Your City',
    province VARCHAR(100) DEFAULT 'Your Province',
    gender VARCHAR(20),
    photo_path VARCHAR(500),
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- 4. EVENT CATEGORIES TABLE
CREATE TABLE event_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    color_code VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO event_categories (name, description, color_code, icon) VALUES
('Sports', 'Basketball, volleyball, and other sports events', '#10B981', 'trophy'),
('Health & Medical', 'Medical missions, health checkups, vaccinations', '#EF4444', 'heart'),
('Education', 'Seminars, workshops, training sessions', '#8B5CF6', 'book'),
('Social', 'Community gatherings, festivals, celebrations', '#F59E0B', 'users'),
('Emergency', 'Disaster preparedness, emergency response', '#DC2626', 'alert-triangle'),
('Government', 'Official barangay meetings and announcements', '#6366F1', 'building');

-- 5. EVENTS TABLE (Core event information)
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES event_categories(id) ON DELETE SET NULL,
    manager_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Event timing
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    registration_start TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    registration_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Location & capacity
    location TEXT NOT NULL,
    venue_details TEXT,
    capacity INTEGER,
    current_registrations INTEGER DEFAULT 0,
    
    -- Registration restrictions
    age_min INTEGER DEFAULT 0,
    age_max INTEGER,
    gender_restriction VARCHAR(20) CHECK (gender_restriction IN ('male', 'female', 'any')) DEFAULT 'any',
    barangay_restriction TEXT[], -- Array of allowed barangays
    
    -- Event settings
    requires_approval BOOLEAN DEFAULT true,
    allow_walk_in BOOLEAN DEFAULT false,
    allow_team_registration BOOLEAN DEFAULT false,
    max_team_members INTEGER DEFAULT 1,
    
    -- Custom fields (JSON schema for dynamic form fields)
    custom_fields JSONB DEFAULT '[]',
    
    -- Event status
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'ongoing', 'completed', 'cancelled')),
    is_featured BOOLEAN DEFAULT false,
    
    -- QR and attendance
    qr_required BOOLEAN DEFAULT true,
    attendance_tracking BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TEAMS TABLE (For team-based events)
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    captain_id UUID REFERENCES users(id) ON DELETE SET NULL,
    max_members INTEGER NOT NULL,
    current_members INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(event_id, name)
);

-- 7. REGISTRATIONS TABLE (Individual or team registrations)
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for guest registrations
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    
    -- Guest registration fields (when user_id is NULL)
    guest_first_name VARCHAR(100),
    guest_last_name VARCHAR(100),
    guest_phone VARCHAR(20),
    guest_email VARCHAR(255),
    guest_age INTEGER,
    guest_address TEXT,
    guest_barangay VARCHAR(100),
    
    -- Registration data
    custom_field_values JSONB DEFAULT '{}',
    photo_path VARCHAR(500),
    
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'waitlisted', 'cancelled')),
    rejection_reason TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Special flags
    is_walk_in BOOLEAN DEFAULT false,
    priority_level INTEGER DEFAULT 0, -- For prioritizing registrations
    
    -- Attendance
    checked_in BOOLEAN DEFAULT false,
    check_in_time TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID REFERENCES users(id),
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. QR CODES TABLE (QR code management)
CREATE TABLE qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    qr_value TEXT NOT NULL UNIQUE, -- JWT token or encrypted payload
    qr_image_path VARCHAR(500),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    scan_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. OTP REQUESTS TABLE (SMS OTP verification)
CREATE TABLE otp_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone VARCHAR(20) NOT NULL,
    code_hash VARCHAR(255) NOT NULL, -- Store hashed OTP for security
    purpose VARCHAR(50) NOT NULL, -- 'registration', 'login', 'phone_verify'
    related_id UUID, -- Can reference registration_id, user_id, etc.
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    provider_response JSONB, -- Store TextBee response
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. AUDIT LOGS TABLE (Complete audit trail)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50),
    actor_ip INET,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    user_agent TEXT,
    session_id VARCHAR(255),
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. REFRESH TOKENS TABLE (JWT token management)
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- ================================================
-- INDEXES FOR PERFORMANCE
-- ================================================

-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Profiles table indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_barangay ON profiles(barangay);
CREATE INDEX idx_profiles_age ON profiles(age);

-- Events table indexes
CREATE INDEX idx_events_category_id ON events(category_id);
CREATE INDEX idx_events_manager_id ON events(manager_id);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_end_date ON events(end_date);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_is_featured ON events(is_featured);

-- Registrations table indexes
CREATE INDEX idx_registrations_event_id ON registrations(event_id);
CREATE INDEX idx_registrations_user_id ON registrations(user_id);
CREATE INDEX idx_registrations_team_id ON registrations(team_id);
CREATE INDEX idx_registrations_status ON registrations(status);
CREATE INDEX idx_registrations_created_at ON registrations(created_at);

-- QR codes table indexes
CREATE INDEX idx_qr_codes_registration_id ON qr_codes(registration_id);
CREATE INDEX idx_qr_codes_qr_value ON qr_codes(qr_value);
CREATE INDEX idx_qr_codes_expires_at ON qr_codes(expires_at);

-- OTP requests table indexes
CREATE INDEX idx_otp_requests_phone ON otp_requests(phone);
CREATE INDEX idx_otp_requests_expires_at ON otp_requests(expires_at);
CREATE INDEX idx_otp_requests_purpose ON otp_requests(purpose);

-- Audit logs table indexes
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);

-- Refresh tokens table indexes
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);

-- ================================================
-- CONSTRAINTS & TRIGGERS
-- ================================================

-- Ensure registration capacity doesn't exceed event capacity
CREATE OR REPLACE FUNCTION check_event_capacity()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT capacity FROM events WHERE id = NEW.event_id) IS NOT NULL THEN
        IF (SELECT current_registrations FROM events WHERE id = NEW.event_id) >= 
           (SELECT capacity FROM events WHERE id = NEW.event_id) THEN
            RAISE EXCEPTION 'Event capacity exceeded';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_capacity
    BEFORE INSERT ON registrations
    FOR EACH ROW
    EXECUTE FUNCTION check_event_capacity();

-- Update event registration count
CREATE OR REPLACE FUNCTION update_registration_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE events 
        SET current_registrations = current_registrations + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.event_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE events 
        SET current_registrations = current_registrations - 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = OLD.event_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_registration_count
    AFTER INSERT OR DELETE ON registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_registration_count();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_registrations_updated_at BEFORE UPDATE ON registrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trigger_event_categories_updated_at BEFORE UPDATE ON event_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- SEED DATA FOR DEVELOPMENT
-- ================================================

-- Create default super admin (password: admin123)
-- Note: In production, change this password immediately
INSERT INTO users (email, phone, password_hash, role_id) VALUES (
    'admin@barangay.gov',
    '+639123456789',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqyT4kdxmMxalrU8J2Cd4V2', -- admin123
    (SELECT id FROM roles WHERE name = 'SuperAdmin')
);

-- Create admin profile
INSERT INTO profiles (user_id, first_name, last_name, barangay, address) VALUES (
    (SELECT id FROM users WHERE email = 'admin@barangay.gov'),
    'System',
    'Administrator',
    'Main Office',
    'Barangay Hall, Main Street'
);

-- Sample event manager (password: manager123)
INSERT INTO users (email, phone, password_hash, role_id) VALUES (
    'manager@barangay.gov',
    '+639987654321',
    '$2b$12$Ks8J3qI8WxRv5Og7A9MjpelQhWe.Y1VfwO/i1HXFCHqm9Qd4tGr3S', -- manager123
    (SELECT id FROM roles WHERE name = 'EventManager')
);

INSERT INTO profiles (user_id, first_name, last_name, barangay, address) VALUES (
    (SELECT id FROM users WHERE email = 'manager@barangay.gov'),
    'Juan',
    'Manager',
    'Zone 1',
    '123 Sports Complex St.'
);

-- Sample events
INSERT INTO events (
    title, description, category_id, manager_id,
    start_date, end_date, registration_end,
    location, capacity, age_min, age_max,
    custom_fields, status
) VALUES 
(
    'Inter-Barangay Basketball Championship',
    'Annual basketball tournament featuring all barangays in the city',
    (SELECT id FROM event_categories WHERE name = 'Sports'),
    (SELECT id FROM users WHERE email = 'manager@barangay.gov'),
    '2024-03-15 08:00:00+08',
    '2024-03-15 18:00:00+08',
    '2024-03-10 23:59:59+08',
    'Barangay Basketball Court',
    100,
    18,
    35,
    '[
        {
            "key": "position",
            "label": "Position",
            "type": "select",
            "required": true,
            "options": ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"]
        },
        {
            "key": "jersey_number",
            "label": "Preferred Jersey Number",
            "type": "number",
            "required": false,
            "min": 1,
            "max": 99
        }
    ]',
    'published'
),
(
    'Free Medical Mission',
    'Comprehensive health checkup and consultation for all residents',
    (SELECT id FROM event_categories WHERE name = 'Health & Medical'),
    (SELECT id FROM users WHERE email = 'manager@barangay.gov'),
    '2024-03-20 07:00:00+08',
    '2024-03-20 16:00:00+08',
    '2024-03-18 23:59:59+08',
    'Barangay Health Center',
    200,
    0,
    NULL,
    '[
        {
            "key": "medical_history",
            "label": "Medical History",
            "type": "textarea",
            "required": false,
            "placeholder": "List any existing medical conditions or medications"
        },
        {
            "key": "emergency_contact",
            "label": "Emergency Contact Person",
            "type": "text",
            "required": true
        }
    ]',
    'published'
);

-- ================================================
-- HELPFUL QUERIES FOR DEVELOPMENT
-- ================================================

/*
-- Check all tables
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- View all users with roles
SELECT u.email, u.phone, r.name as role, p.first_name, p.last_name, p.barangay
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN profiles p ON u.id = p.user_id;

-- View events with categories and registration counts
SELECT 
    e.title,
    ec.name as category,
    e.current_registrations,
    e.capacity,
    e.status,
    u.email as manager_email
FROM events e
LEFT JOIN event_categories ec ON e.category_id = ec.id
LEFT JOIN users u ON e.manager_id = u.id;

-- View recent audit logs
SELECT 
    al.timestamp,
    u.email as actor,
    al.action,
    al.resource_type,
    al.success
FROM audit_logs al
LEFT JOIN users u ON al.actor_id = u.id
ORDER BY al.timestamp DESC
LIMIT 10;
*/