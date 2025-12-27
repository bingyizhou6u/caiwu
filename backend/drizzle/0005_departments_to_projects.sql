-- Migration: Copy departments data to projects table
-- Step 1: Insert departments data into projects (keeping same IDs for FK compatibility)

INSERT INTO projects (id, code, name, description, department_id, manager_id, status, start_date, end_date, actual_start_date, actual_end_date, priority, budget_cents, memo, created_by, created_at, updated_at, active)
SELECT 
    id,                           -- Keep same ID for FK compatibility
    REPLACE(id, 'dept-', 'PRJ-'), -- Generate code from id
    name,                         -- Project name
    description,                  -- Description
    id,                           -- department_id points to itself temporarily
    manager_id,                   -- Manager
    status,                       -- Status
    start_date,                   -- Start date
    end_date,                     -- End date
    actual_start_date,            -- Actual start
    actual_end_date,              -- Actual end
    priority,                     -- Priority
    budget_cents,                 -- Budget
    memo,                         -- Memo
    NULL,                         -- created_by
    strftime('%s', 'now') * 1000, -- created_at (timestamp in ms)
    strftime('%s', 'now') * 1000, -- updated_at
    active                        -- active status
FROM departments;
