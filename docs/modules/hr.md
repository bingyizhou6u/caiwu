# 人力资源模块文档

> **服务目录**：`backend/src/services/hr/`

---

## 👥 核心功能

### 1. 员工管理 (EmployeeService)

员工信息 CRUD，包含认证字段。

**关键关系**：
- `positionId` → 职位（权限来源）
- `departmentId` → 项目/部门
- `orgDepartmentId` → 组织部门

**状态**：
- `probation` - 试用期
- `regular` - 正式
- `resigned` - 离职

### 2. 薪资管理 (SalaryPaymentService)

薪资发放全流程管理。

**状态流转**：
```
pending_employee_confirmation
    ↓
pending_finance_approval
    ↓
pending_payment
    ↓
pending_payment_confirmation
    ↓
completed
```

**薪资组成**：
- 基本工资 (`employee_salaries`)
- 津贴 (`employee_allowances`)
- 扣款（请假等）

### 3. 请假管理 (EmployeeLeaveService)

请假申请、审批流程。

**假期类型**：
- `annual` - 年假
- `sick` - 病假
- `personal` - 事假
- `marriage` - 婚假
- `maternity` - 产假
- `other` - 其他

**审批**：
- 基于 `canManageSubordinates` 权限
- 基于 `dataScope` 范围限制

### 4. 报销管理 (ExpenseReimbursementService)

费用报销申请、审批。

**报销类型**：
- `travel` - 差旅
- `office` - 办公
- `meal` - 餐饮
- `transport` - 交通
- `other` - 其他

### 5. 考勤管理 (AttendanceService)

考勤打卡记录。

**状态**：
- `normal` - 正常
- `late` - 迟到
- `early` - 早退
- `late_early` - 迟到+早退

---

## 🏢 组织架构

### 三层结构

```
总部 (headquarters)
  └── 项目/部门 (departments)
        └── 组织部门 (org_departments)
              └── 员工 (employees)
```

### 职位体系 (positions)

- `code` - 职位代码（唯一）
- `dataScope` - 数据访问范围
- `permissions` - 权限配置（JSON）
- `canManageSubordinates` - 下属管理权限

---

**最后更新**：2025-12-27
