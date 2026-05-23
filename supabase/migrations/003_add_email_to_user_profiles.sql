-- Add email column to user_profiles for display in user management UI
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email text;
