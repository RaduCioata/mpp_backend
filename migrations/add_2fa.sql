-- Add two_factor_secret column to users table
ALTER TABLE users
ADD COLUMN two_factor_secret VARCHAR(32) NULL,
ADD COLUMN two_factor_enabled BOOLEAN DEFAULT FALSE;

-- Add password column if it doesn't exist
ALTER TABLE users
ADD COLUMN password VARCHAR(255) NULL; 