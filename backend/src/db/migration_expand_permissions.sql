-- ==================== 职位权限扩展迁移 ====================
-- 目的：扩展职位权限配置，添加缺失的模块以支持统一权限检查
-- 新增模块：
--   finance: salary, allowance, site_bill
--   system: account, category, currency, headquarters
-- ==================== ==================== ====================

-- 1. 更新总部负责人（hq_director）权限
UPDATE positions SET permissions = '{
  "finance": {
    "flow": ["view", "create", "update", "delete", "export"],
    "transfer": ["view", "create", "update", "delete", "approve"],
    "ar": ["view", "create", "update", "delete"],
    "ap": ["view", "create", "update", "delete"],
    "borrowing": ["view", "create", "approve", "reject"],
    "salary": ["view", "create", "update", "delete", "approve"],
    "allowance": ["view", "create", "update", "delete"],
    "site_bill": ["view", "create", "update", "delete"]
  },
  "hr": {
    "employee": ["view", "create", "update", "delete"],
    "salary": ["view", "create", "update", "approve"],
    "leave": ["view", "approve", "reject"],
    "reimbursement": ["view", "approve", "reject"]
  },
  "asset": {
    "fixed": ["view", "create", "update", "delete", "allocate"],
    "rental": ["view", "create", "update", "delete"]
  },
  "report": {
    "view": ["all"],
    "export": ["all"]
  },
  "system": {
    "user": ["view", "create", "update", "delete"],
    "position": ["view", "create", "update", "delete"],
    "department": ["view", "create", "update", "delete"],
    "audit": ["view", "export"],
    "config": ["view", "update"],
    "account": ["view", "create", "update", "delete"],
    "category": ["view", "create", "update", "delete"],
    "currency": ["view", "create", "update", "delete"],
    "headquarters": ["view", "create", "update", "delete"]
  },
  "site": {
    "info": ["view", "create", "update", "delete"],
    "bill": ["view", "create", "update", "delete"]
  },
  "self": {
    "leave": ["view", "create"],
    "reimbursement": ["view", "create"],
    "salary": ["view"],
    "asset": ["view"],
    "borrowing": ["view", "create"]
  }
}', updated_at = strftime('%s', 'now') * 1000
WHERE code = 'hq_director';

-- 2. 更新总部人事（hq_hr）权限
UPDATE positions SET permissions = '{
  "hr": {
    "employee": ["view", "create", "update", "delete"],
    "salary": ["view", "create", "update", "approve"],
    "leave": ["view", "approve", "reject"],
    "reimbursement": ["view", "approve", "reject"]
  },
  "finance": {
    "salary": ["view", "create", "update", "approve"],
    "allowance": ["view", "create", "update"]
  },
  "asset": {
    "fixed": ["view", "allocate"]
  },
  "report": {
    "view": ["salary", "leave", "employee"],
    "export": ["salary", "leave"]
  },
  "system": {
    "user": ["view", "create", "update"],
    "audit": ["view"]
  },
  "self": {
    "leave": ["view", "create"],
    "reimbursement": ["view", "create"],
    "salary": ["view"]
  }
}', updated_at = strftime('%s', 'now') * 1000
WHERE code = 'hq_hr';

-- 3. 更新总部财务（hq_finance）权限
UPDATE positions SET permissions = '{
  "finance": {
    "flow": ["view", "create", "update", "delete", "export"],
    "transfer": ["view", "create", "approve"],
    "ar": ["view", "create", "update", "delete"],
    "ap": ["view", "create", "update", "delete"],
    "borrowing": ["view", "create", "approve", "reject"],
    "salary": ["view", "create", "update", "approve"],
    "allowance": ["view", "create", "update"],
    "site_bill": ["view", "create", "update", "delete"]
  },
  "hr": {
    "salary": ["view", "export"],
    "reimbursement": ["view", "approve", "reject"]
  },
  "asset": {
    "fixed": ["view", "create", "update", "allocate"],
    "rental": ["view", "create", "update"]
  },
  "report": {
    "view": ["cash_flow", "salary", "account", "ar_ap"],
    "export": ["cash_flow", "salary", "account", "ar_ap"]
  },
  "system": {
    "audit": ["view"],
    "account": ["view", "create", "update"],
    "category": ["view", "create", "update"],
    "currency": ["view", "create", "update"],
    "department": ["view", "create", "update"],
    "headquarters": ["view", "update"]
  },
  "site": {
    "info": ["view", "create", "update"],
    "bill": ["view", "create", "update"]
  },
  "self": {
    "leave": ["view", "create"],
    "reimbursement": ["view", "create"],
    "salary": ["view"]
  }
}', updated_at = strftime('%s', 'now') * 1000
WHERE code = 'hq_finance';

-- 4. 更新总部行政（hq_admin）权限
UPDATE positions SET permissions = '{
  "asset": {
    "fixed": ["view", "create", "update", "allocate"],
    "rental": ["view", "create", "update"]
  },
  "report": {
    "view": ["account", "asset"]
  },
  "system": {
    "department": ["view"]
  },
  "site": {
    "info": ["view", "create", "update"]
  },
  "self": {
    "leave": ["view", "create"],
    "reimbursement": ["view", "create"],
    "salary": ["view"]
  }
}', updated_at = strftime('%s', 'now') * 1000
WHERE code = 'hq_admin';

-- 5. 更新项目负责人（project_director）权限
UPDATE positions SET permissions = '{
  "finance": {
    "flow": ["view", "export"],
    "transfer": ["view"],
    "ar": ["view"],
    "ap": ["view"],
    "borrowing": ["view", "approve"],
    "salary": ["view", "create", "approve"],
    "allowance": ["view"],
    "site_bill": ["view", "create", "update"]
  },
  "hr": {
    "employee": ["view", "create", "update"],
    "salary": ["view"],
    "leave": ["view", "approve", "reject"],
    "reimbursement": ["view", "approve", "reject"]
  },
  "asset": {
    "fixed": ["view", "create", "allocate"],
    "rental": ["view", "create"]
  },
  "report": {
    "view": ["cash_flow", "salary", "account", "leave"],
    "export": ["cash_flow", "salary"]
  },
  "system": {
    "department": ["view", "create", "update"]
  },
  "site": {
    "info": ["view"],
    "bill": ["view", "create", "update"]
  },
  "self": {
    "leave": ["view", "create"],
    "reimbursement": ["view", "create"],
    "salary": ["view"],
    "asset": ["view"]
  }
}', updated_at = strftime('%s', 'now') * 1000
WHERE code = 'project_director';

-- 6. 更新项目人事（project_hr）权限
UPDATE positions SET permissions = '{
  "hr": {
    "employee": ["view", "create", "update"],
    "salary": ["view", "create"],
    "leave": ["view", "approve", "reject"],
    "reimbursement": ["view", "approve", "reject"]
  },
  "finance": {
    "salary": ["view", "create"],
    "allowance": ["view", "create"]
  },
  "asset": {
    "fixed": ["view", "allocate"]
  },
  "report": {
    "view": ["salary", "leave", "employee"],
    "export": ["salary", "leave"]
  },
  "self": {
    "leave": ["view", "create"],
    "reimbursement": ["view", "create"],
    "salary": ["view"]
  }
}', updated_at = strftime('%s', 'now') * 1000
WHERE code = 'project_hr';

-- 7. 更新项目财务（project_finance）权限
UPDATE positions SET permissions = '{
  "finance": {
    "flow": ["view", "create", "update", "export"],
    "transfer": ["view", "create"],
    "ar": ["view", "create", "update"],
    "ap": ["view", "create", "update"],
    "borrowing": ["view", "create"],
    "salary": ["view", "create", "update"],
    "allowance": ["view", "create"],
    "site_bill": ["view", "create", "update"]
  },
  "asset": {
    "fixed": ["view", "create", "update", "allocate"],
    "rental": ["view", "create", "update"]
  },
  "report": {
    "view": ["cash_flow", "account", "ar_ap"],
    "export": ["cash_flow", "account"]
  },
  "site": {
    "bill": ["view", "create", "update"]
  },
  "self": {
    "leave": ["view", "create"],
    "reimbursement": ["view", "create"],
    "salary": ["view"]
  }
}', updated_at = strftime('%s', 'now') * 1000
WHERE code = 'project_finance';

-- 8. 更新项目行政（project_admin）权限
UPDATE positions SET permissions = '{
  "asset": {
    "fixed": ["view", "create", "update", "allocate"],
    "rental": ["view", "create", "update"]
  },
  "site": {
    "info": ["view", "update"],
    "bill": ["view"]
  },
  "self": {
    "leave": ["view", "create"],
    "reimbursement": ["view", "create"],
    "salary": ["view"]
  }
}', updated_at = strftime('%s', 'now') * 1000
WHERE code = 'project_admin';

-- 9. 更新组长（team_leader）权限（保持不变，组长不需要财务/系统权限）
UPDATE positions SET permissions = '{
  "hr": {
    "employee": ["view"],
    "leave": ["view", "approve", "reject"],
    "reimbursement": ["view", "approve", "reject"]
  },
  "report": {
    "view": ["leave"]
  },
  "self": {
    "leave": ["view", "create"],
    "reimbursement": ["view", "create"],
    "salary": ["view"],
    "asset": ["view"]
  }
}', updated_at = strftime('%s', 'now') * 1000
WHERE code = 'team_leader';

-- 10. 更新组员（team_developer）权限（保持不变，组员只有个人中心权限）
UPDATE positions SET permissions = '{
  "self": {
    "leave": ["view", "create"],
    "reimbursement": ["view", "create"],
    "salary": ["view"],
    "asset": ["view"],
    "borrowing": ["view", "create"]
  }
}', updated_at = strftime('%s', 'now') * 1000
WHERE code = 'team_developer';

-- ==================== 验证更新 ====================
SELECT code, name, json_extract(permissions, '$.finance') as finance_perms, json_extract(permissions, '$.system') as system_perms FROM positions ORDER BY sort_order;

