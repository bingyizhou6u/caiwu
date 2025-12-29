-- Migration: Drop old departments table (data already migrated to projects)
-- Disable foreign key checks temporarily

PRAGMA foreign_keys = OFF;
DROP TABLE IF EXISTS departments;
PRAGMA foreign_keys = ON;
