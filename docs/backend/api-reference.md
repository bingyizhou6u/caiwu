# API 接口参考

> **版本**：V2 (推荐)  
> **基础路径**：`/api/v2/`  
> **路由目录**：`backend/src/routes/v2/`

---

## 📋 端点分类

### 🔐 认证 (`auth.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/cf-session` | CF Access 登录 |
| POST | `/auth/logout` | 登出 |
| GET | `/auth/me` | 获取当前用户 |
| GET | `/my-permissions` | 获取权限 |

### 👥 人事 (`employees.ts`, `employee-*.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/employees` | 员工列表 |
| GET | `/employees/:id` | 员工详情 |
| POST | `/employees` | 创建员工 |
| PATCH | `/employees/:id` | 更新员工 |
| DELETE | `/employees/:id` | 删除员工 |
| GET | `/employee-leaves` | 请假列表 |
| POST | `/employee-leaves` | 申请请假 |
| PATCH | `/employee-leaves/:id/approve` | 审批请假 |
| GET | `/expense-reimbursements` | 报销列表 |
| POST | `/expense-reimbursements` | 申请报销 |

### 💰 财务 (`flows.ts`, `salary-payments.ts`, `ar-ap.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/flows` | 现金流水列表 |
| POST | `/flows` | 创建流水 |
| POST | `/flows/:id/reverse` | 红冲流水 |
| GET | `/salary-payments` | 薪资发放列表 |
| POST | `/salary-payments/generate` | 生成薪资 |
| GET | `/ar-ap` | 应收应付列表 |
| GET | `/account-transfers` | 账户转账列表 |

### 🏢 资产 (`fixed-assets.ts`, `rental.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/fixed-assets` | 固定资产列表 |
| POST | `/fixed-assets` | 创建资产 |
| POST | `/fixed-assets/:id/allocate` | 分配资产 |
| POST | `/fixed-assets/:id/return` | 归还资产 |
| GET | `/rental/properties` | 租赁物业列表 |
| GET | `/rental/payments` | 租金支付记录 |

### 📊 报表 (`reports.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/reports/dashboard` | 仪表板数据 |
| GET | `/reports/cash-flow` | 现金流报表 |
| GET | `/reports/salary` | 薪资报表 |
| GET | `/reports/ar-aging` | 应收账龄 |

### ⚙️ 系统 (`master-data.ts`, `system-config.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/master-data/accounts` | 账户列表 |
| GET | `/master-data/currencies` | 币种列表 |
| GET | `/master-data/categories` | 分类列表 |
| GET | `/master-data/departments` | 部门列表 |
| GET | `/master-data/positions` | 职位列表 |
| GET | `/audit/logs` | 审计日志 |

### 👤 个人中心 (`my.ts`)

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/my/profile` | 我的资料 |
| GET | `/my/dashboard` | 我的仪表板 |
| GET | `/my/leaves` | 我的请假 |
| GET | `/my/reimbursements` | 我的报销 |
| GET | `/my/salaries` | 我的薪资 |

---

## 📝 响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "验证失败"
  }
}
```

---

## 🔗 OpenAPI 文档

访问 `/api/v2/swagger` 查看完整的 OpenAPI 文档。

---

**最后更新**: 2025-12-27
