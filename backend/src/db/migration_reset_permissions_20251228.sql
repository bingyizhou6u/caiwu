-- Migration: Reset Role Permissions (Strict Separation)
-- Date: 2025-12-28

-- 1. HQ Finance: Pure Finance & Audit
UPDATE positions 
SET permissions = '{"finance":{"flow":["view","create","update","delete","export"],"transfer":["view","create","update","delete","approve"],"ar":["view","create","update","delete"],"ap":["view","create","update","delete"],"borrowing":["view","create","approve","reject"],"salary":["view","create","update","delete","approve"],"allowance":["view","create","update","delete"],"site_bill":["view","create","update","delete"]},"report":{"finance":["view","export"],"salary":["view","export"],"view":["finance","salary","account"]},"system":{"account":["view","create","update","delete"],"category":["view","create","update","delete"],"currency":["view","create","update","delete"],"audit":["view"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'hq_finance';

-- 2. HQ HR: Pure HR & Org
UPDATE positions 
SET permissions = '{"hr":{"employee":["view","create","update","delete"],"salary":["view","create","update","approve"],"leave":["view","approve","reject"],"reimbursement":["view","approve","reject"]},"report":{"hr":["view","export"],"salary":["view","export"],"view":["hr","salary","employee"]},"system":{"position":["view","create","update","delete"],"department":["view","create","update","delete"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'hq_hr';

-- 3. HQ Admin: Pure Asset & Site
UPDATE positions 
SET permissions = '{"asset":{"fixed":["view","create","update","delete","allocate"],"rental":["view","create","update","delete"]},"site":{"info":["view","create","update","delete"],"bill":["view","create","update","delete"]},"report":{"asset":["view","export"],"view":["asset"]},"system":{"site_config":["manage"],"department":["view"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'hq_admin';

-- 4. Project Finance: Functional Finance (No System Config)
UPDATE positions 
SET permissions = '{"finance":{"flow":["view","create","update","delete","export"],"transfer":["view","create","update"],"ar":["view","create","update","delete"],"ap":["view","create","update","delete"],"borrowing":["view","create"],"salary":["view","create","update"],"allowance":["view","create","update"],"site_bill":["view","create","update","delete"]},"report":{"finance":["view","export"],"salary":["view","export"],"view":["finance","salary","account"]},"system":{"account":["view"],"department":["view"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'project_finance';

-- 5. Project HR: Functional HR (No Org Config)
UPDATE positions 
SET permissions = '{"hr":{"employee":["view","create","update","delete"],"salary":["view","create","update"],"leave":["view","approve","reject"],"reimbursement":["view","approve","reject"]},"report":{"hr":["view","export"],"salary":["view","export"],"view":["hr","salary","employee"]},"system":{"department":["view"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'project_hr';

-- 6. Project Admin: Functional Admin (No Site Config)
UPDATE positions 
SET permissions = '{"asset":{"fixed":["view","create","update","delete","allocate"],"rental":["view","create","update","delete"]},"site":{"info":["view","update"],"bill":["view","create","update"]},"report":{"asset":["view","export"],"view":["asset"]},"system":{"department":["view"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'project_admin';

-- 7. Team Leader: Add PM permissions
UPDATE positions 
SET permissions = '{"hr":{"leave":["view","approve","reject"],"reimbursement":["view","approve","reject"]},"pm":{"task":["view","create","update","assign","delete"],"timelog":["view","create","delete"],"report":["view"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'team_leader';

-- 8. Team Engineer: Add PM permissions (Self)
UPDATE positions 
SET permissions = '{"pm":{"task":["view","update"],"timelog":["view","create","delete"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'team_engineer';
