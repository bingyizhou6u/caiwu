-- 员工表添加上班时间字段
ALTER TABLE employees ADD COLUMN work_schedule TEXT DEFAULT '{"days":[1,2,3,4,5,6],"start":"09:00","end":"21:00"}';

-- 系统配置添加年假参数（包含周期类型选择）
INSERT OR IGNORE INTO system_config (key, value, description, updated_at) VALUES 
  ('annual_leave_cycle_months', '6', '年假周期月数（6=半年制，12=年制）', strftime('%s','now') * 1000);
INSERT OR IGNORE INTO system_config (key, value, description, updated_at) VALUES 
  ('annual_leave_days_per_cycle', '5', '每周期获得的年假天数', strftime('%s','now') * 1000);
INSERT OR IGNORE INTO system_config (key, value, description, updated_at) VALUES 
  ('annual_leave_overtime_multiplier', '1', '未休年假折算工资系数', strftime('%s','now') * 1000);
