-- Simple production database initialization
-- Create admin user with password "password"

INSERT OR IGNORE INTO headquarters (id, name, active) VALUES ('hq', 'Headquarters', 1);

INSERT OR IGNORE INTO positions (id, code, name, level, function_role, can_manage_subordinates, description, permissions, sort_order, created_at, updated_at)
VALUES ('pos-hq-director', 'hq_director', '总部负责人', 1, 'director', 1, '总部负责人', '{}', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

INSERT OR IGNORE INTO departments (id, hq_id, name, active) VALUES ('hq', 'hq', '总部', 1);

-- Admin user (password: password)
-- Hash: $2b$10$8YHB2Aa4Kg6rUdl2GZcrNe67/Ux7Y3X84/RkWQoK94tIahkzgHJve
INSERT OR IGNORE INTO users (id, email, password_hash, active, must_change_password, password_changed, created_at)
VALUES ('admin_user', 'admin@example.com', '$2b$10$8YHB2Aa4Kg6rUdl2GZcrNe67/Ux7Y3X84/RkWQoK94tIahkzgH Jve', 1, 0, 1, strftime('%s', 'now') * 1000);

INSERT OR IGNORE INTO employees (id, email, name, position_id, department_id, join_date, status, active, created_at, updated_at)
VALUES ('admin_employee', 'admin@example.com', 'Admin', 'pos-hq-director', 'hq', '2023-01-01', 'regular', 1, strftime('%s', 'now') * 1000, strftime('%s', 'now') * 1000);

UPDATE users SET position_id = 'pos-hq-director', department_id = 'hq' WHERE id = 'admin_user';
