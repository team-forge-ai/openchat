-- Add model field to app_settings table
-- This allows users to configure which model to use

ALTER TABLE app_settings 
ADD COLUMN model TEXT;
