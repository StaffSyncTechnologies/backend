-- Initial database setup script
-- This runs when PostgreSQL container starts for the first time

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE staffsync TO staffsync;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'StaffSync database initialized successfully';
END $$;
