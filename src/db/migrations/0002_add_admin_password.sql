-- Migration: Add password_hash column to admins table
ALTER TABLE admins ADD COLUMN password_hash TEXT;
