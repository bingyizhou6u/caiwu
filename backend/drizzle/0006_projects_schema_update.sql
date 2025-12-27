-- Migration: Adjust projects table to be compatible with departments usage
-- Make department_id nullable (self-referencing is not needed for old departments data)

-- Step 1: Create new temporary table with correct schema
CREATE TABLE projects_new (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    hq_id TEXT,  -- Added for departments compatibility
    department_id TEXT,  -- Made nullable
    manager_id TEXT,
    status TEXT DEFAULT 'active',
    start_date TEXT,
    end_date TEXT,
    actual_start_date TEXT,
    actual_end_date TEXT,
    priority TEXT DEFAULT 'medium',
    budget_cents INTEGER,
    memo TEXT,
    sort_order INTEGER DEFAULT 100,  -- Added for departments compatibility
    created_by TEXT,
    created_at INTEGER,
    updated_at INTEGER,
    active INTEGER DEFAULT 1
);

-- Step 2: Copy data from old projects table
INSERT INTO projects_new (id, code, name, description, hq_id, department_id, manager_id, status, start_date, end_date, actual_start_date, actual_end_date, priority, budget_cents, memo, sort_order, created_by, created_at, updated_at, active)
SELECT id, code, name, description, NULL, NULL, manager_id, status, start_date, end_date, actual_start_date, actual_end_date, priority, budget_cents, memo, 100, created_by, created_at, updated_at, active
FROM projects;

-- Step 3: Update with hq_id from old departments table where IDs match
UPDATE projects_new SET hq_id = (
    SELECT hq_id FROM departments WHERE departments.id = projects_new.id
) WHERE EXISTS (SELECT 1 FROM departments WHERE departments.id = projects_new.id);

-- Step 4: Drop old table and rename new one
DROP TABLE projects;
ALTER TABLE projects_new RENAME TO projects;

-- Step 5: Recreate indexes
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_active ON projects(active);
