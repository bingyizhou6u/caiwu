-- PM Module Database Integration Migration
-- Extends departments table with PM fields
-- Updates tasks to reference departments instead of projects

-- Step 1: Add PM fields to departments table
ALTER TABLE departments ADD COLUMN manager_id TEXT;
ALTER TABLE departments ADD COLUMN status TEXT DEFAULT 'active'; -- active, on_hold, completed, cancelled
ALTER TABLE departments ADD COLUMN priority TEXT DEFAULT 'medium'; -- high, medium, low
ALTER TABLE departments ADD COLUMN start_date TEXT;
ALTER TABLE departments ADD COLUMN end_date TEXT;
ALTER TABLE departments ADD COLUMN actual_start_date TEXT;
ALTER TABLE departments ADD COLUMN actual_end_date TEXT;
ALTER TABLE departments ADD COLUMN budget_cents INTEGER;
ALTER TABLE departments ADD COLUMN description TEXT;
ALTER TABLE departments ADD COLUMN memo TEXT;

-- Step 2: Add department_id column to tasks table (nullable for now)
ALTER TABLE tasks ADD COLUMN department_id TEXT;

-- Step 3: Create index on department_id
CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department_id);

-- Step 4: Update requirements table to use department_id
ALTER TABLE requirements ADD COLUMN department_id TEXT;
CREATE INDEX IF NOT EXISTS idx_requirements_department ON requirements(department_id);

-- Step 5: Update task_timelogs with department_id for easier querying
ALTER TABLE task_timelogs ADD COLUMN department_id TEXT;
CREATE INDEX IF NOT EXISTS idx_timelogs_department ON task_timelogs(department_id);

-- Step 6: Update milestones to use department_id
ALTER TABLE milestones ADD COLUMN department_id TEXT;
CREATE INDEX IF NOT EXISTS idx_milestones_department ON milestones(department_id);

-- Note: After this migration:
-- 1. Update backend services to use departments table instead of projects
-- 2. The old projects table can be kept for reference or dropped later
-- 3. projectId columns will be deprecated in favor of departmentId
