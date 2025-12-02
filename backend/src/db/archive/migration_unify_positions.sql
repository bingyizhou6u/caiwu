-- Unify Position Codes and Roles
-- Created: 2025-12-01
-- Description: Rename positions to match code logic (e.g. hq_director -> hq_manager) and ensure function_role is correct.

-- 1. Consolidate HQ positions
-- Move employees from hq_director to hq_manager if both exist
UPDATE employees SET position_id = (SELECT id FROM positions WHERE code = 'hq_manager') 
WHERE position_id IN (SELECT id FROM positions WHERE code = 'hq_director') 
AND EXISTS (SELECT 1 FROM positions WHERE code = 'hq_manager');

-- Delete hq_director if hq_manager exists
DELETE FROM positions WHERE code = 'hq_director' AND EXISTS (SELECT 1 FROM positions WHERE code = 'hq_manager');

-- If hq_manager does NOT exist, rename hq_director to hq_manager
UPDATE positions SET code = 'hq_manager', name = '总部主管', function_role = 'director' WHERE code = 'hq_director';

-- Ensure function_role for hq_manager
UPDATE positions SET function_role = 'director' WHERE code = 'hq_manager';

-- hq_finance, hq_hr, hq_admin
UPDATE positions SET function_role = 'finance' WHERE code = 'hq_finance';
UPDATE positions SET function_role = 'hr' WHERE code = 'hq_hr';
UPDATE positions SET function_role = 'admin' WHERE code = 'hq_admin';

-- 2. Consolidate Project positions
-- Move employees from project_director to project_manager
UPDATE employees SET position_id = (SELECT id FROM positions WHERE code = 'project_manager') 
WHERE position_id IN (SELECT id FROM positions WHERE code = 'project_director') 
AND EXISTS (SELECT 1 FROM positions WHERE code = 'project_manager');

-- Delete project_director if project_manager exists
DELETE FROM positions WHERE code = 'project_director' AND EXISTS (SELECT 1 FROM positions WHERE code = 'project_manager');

-- If project_manager does NOT exist, rename project_director
UPDATE positions SET code = 'project_manager', name = '项目主管', function_role = 'director' WHERE code = 'project_director';

-- Ensure function_role
UPDATE positions SET function_role = 'director' WHERE code = 'project_manager';
UPDATE positions SET function_role = 'finance' WHERE code = 'project_finance';
UPDATE positions SET function_role = 'hr' WHERE code = 'project_hr';
UPDATE positions SET function_role = 'admin' WHERE code = 'project_admin';

-- 3. Consolidate Team positions
-- team_leader is consistent, just update role
UPDATE positions SET function_role = 'director' WHERE code = 'team_leader';

-- team_developer -> team_engineer
UPDATE employees SET position_id = (SELECT id FROM positions WHERE code = 'team_engineer') 
WHERE position_id IN (SELECT id FROM positions WHERE code = 'team_developer') 
AND EXISTS (SELECT 1 FROM positions WHERE code = 'team_engineer');

DELETE FROM positions WHERE code = 'team_developer' AND EXISTS (SELECT 1 FROM positions WHERE code = 'team_engineer');

UPDATE positions SET code = 'team_engineer', name = '工程师', function_role = 'developer' WHERE code = 'team_developer';

-- team_member -> team_engineer
UPDATE employees SET position_id = (SELECT id FROM positions WHERE code = 'team_engineer') 
WHERE position_id IN (SELECT id FROM positions WHERE code = 'team_member') 
AND EXISTS (SELECT 1 FROM positions WHERE code = 'team_engineer');

DELETE FROM positions WHERE code = 'team_member' AND EXISTS (SELECT 1 FROM positions WHERE code = 'team_engineer');

UPDATE positions SET code = 'team_engineer', name = '工程师', function_role = 'developer' WHERE code = 'team_member';

-- Ensure function_role for team_engineer
UPDATE positions SET function_role = 'developer' WHERE code = 'team_engineer';

-- 4. Verify
SELECT code, name, level, function_role FROM positions ORDER BY level, sort_order;
