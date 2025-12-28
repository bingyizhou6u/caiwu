-- Migration: Fix Permission Keys and Add Vendor/HQ
-- Date: 2025-12-28
-- Description: 
-- 1. Fix typo in hq_admin: site_config -> config (matching code)
-- 2. Add vendor management to hq_finance
-- 3. Add headquarters management to hq_hr (assuming HR manages Org structure)

-- 1. HQ Admin: Fix site_config -> config
UPDATE positions 
SET permissions = '{"asset":{"fixed":["view","create","update","delete","allocate"],"rental":["view","create","update","delete"]},"site":{"info":["view","create","update","delete"],"bill":["view","create","update","delete"]},"report":{"asset":["view","export"],"view":["asset"]},"system":{"config":["view","update"],"department":["view"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'hq_admin';

-- 2. HQ Finance: Add vendor
UPDATE positions 
SET permissions = '{"finance":{"flow":["view","create","update","delete","export"],"transfer":["view","create","update","delete","approve"],"ar":["view","create","update","delete"],"ap":["view","create","update","delete"],"borrowing":["view","create","approve","reject"],"salary":["view","create","update","delete","approve"],"allowance":["view","create","update","delete"],"site_bill":["view","create","update","delete"]},"report":{"finance":["view","export"],"salary":["view","export"],"view":["finance","salary","account"]},"system":{"account":["view","create","update","delete"],"category":["view","create","update","delete"],"currency":["view","create","update","delete"],"vendor":["view","create","update","delete"],"audit":["view"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'hq_finance';

-- 3. HQ HR: Add headquarters
UPDATE positions 
SET permissions = '{"hr":{"employee":["view","create","update","delete"],"salary":["view","create","update","approve"],"leave":["view","approve","reject"],"reimbursement":["view","approve","reject"]},"report":{"hr":["view","export"],"salary":["view","export"],"view":["hr","salary","employee"]},"system":{"position":["view","create","update","delete"],"department":["view","create","update","delete"],"headquarters":["view","create","update","delete"]},"self":{"leave":["view","create"],"reimbursement":["view","create"],"salary":["view"]}}'
WHERE code = 'hq_hr';
