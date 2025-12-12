
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'

async function generate() {
    const salt = await bcrypt.genSalt(10)
    const passwordHash = await bcrypt.hash('password123', salt)

    const sql = []

    // 1. Headquarters
    sql.push(`INSERT OR IGNORE INTO headquarters (id, name, active) VALUES ('hq-001', 'Global HQ', 1);`)

    // 2. Departments
    sql.push(`INSERT OR IGNORE INTO departments (id, hq_id, name, code, active, created_at) VALUES ('dept-finance', 'hq-001', 'Finance', 'FIN', 1, ${Date.now()});`)
    sql.push(`INSERT OR IGNORE INTO departments (id, hq_id, name, code, active, created_at) VALUES ('dept-eng', 'hq-001', 'Engineering', 'ENG', 1, ${Date.now()});`)
    sql.push(`INSERT OR IGNORE INTO departments (id, hq_id, name, code, active, created_at) VALUES ('dept-hr', 'hq-001', 'Human Resources', 'HR', 1, ${Date.now()});`)

    // 3. Positions
    // Level 1: Admin, 2: Manager, 5: Engineer
    sql.push(`INSERT OR IGNORE INTO positions (id, code, name, level, function_role, can_manage_subordinates, active, created_at) VALUES ('pos-admin', 'ADMIN', 'Administrator', 1, 'manager', 1, 1, ${Date.now()});`)
    sql.push(`INSERT OR IGNORE INTO positions (id, code, name, level, function_role, can_manage_subordinates, active, created_at) VALUES ('pos-manager', 'MGR', 'Manager', 2, 'manager', 1, 1, ${Date.now()});`)
    sql.push(`INSERT OR IGNORE INTO positions (id, code, name, level, function_role, can_manage_subordinates, active, created_at) VALUES ('pos-engineer', 'ENG', 'Engineer', 5, 'engineer', 0, 1, ${Date.now()});`)
    sql.push(`INSERT OR IGNORE INTO positions (id, code, name, level, function_role, can_manage_subordinates, active, created_at) VALUES ('pos-finance', 'FIN', 'Finance Officer', 4, 'finance', 0, 1, ${Date.now()});`)

    // 4. Admin Employee
    const adminId = 'emp-admin'
    // Note: employees.email is unique.
    sql.push(`INSERT OR IGNORE INTO employees (
        id, email, personal_email, name, position_id, department_id, 
        join_date, status, active, password_hash, must_change_password, created_at
    ) VALUES (
        '${adminId}', 'admin@example.com', 'admin.personal@example.com', 'System Admin', 
        'pos-admin', 'dept-eng', '2023-01-01', 'regular', 1, '${passwordHash}', 0, ${Date.now()}
    );`)

    console.log(sql.join('\n'))
}

generate().catch(console.error)
