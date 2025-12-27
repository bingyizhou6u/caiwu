# 报表模块文档

> **服务目录**：`backend/src/services/reports/`

---

## 📊 报表分类

### 财务报表

| 报表 | 路径 | 说明 |
|------|------|------|
| 账户余额 | `/reports/account-balance` | 各账户当前余额 |
| 部门现金 | `/reports/dept-cash` | 部门现金汇总 |
| 站点增长 | `/reports/site-growth` | 站点收入趋势 |
| 费用汇总 | `/reports/expense-summary` | 费用分类统计 |
| 费用明细 | `/reports/expense-detail` | 费用明细清单 |

### 应收应付报表

| 报表 | 路径 | 说明 |
|------|------|------|
| 应收汇总 | `/reports/ar-summary` | 应收账款汇总 |
| 应收明细 | `/reports/ar-detail` | 应收账款明细 |
| 应付汇总 | `/reports/ap-summary` | 应付账款汇总 |
| 应付明细 | `/reports/ap-detail` | 应付账款明细 |

### 人事报表

| 报表 | 路径 | 说明 |
|------|------|------|
| 员工薪资 | `/hr/salary-report` | 员工薪资一览 |
| 年假统计 | Dashboard | 员工年假使用 |

---

## 🏠 仪表板

### 个人仪表板 (`/my/center`)

- 待处理审批数
- 本月请假/报销统计
- 我的资产列表
- 今日考勤状态

### 管理仪表板

- 今日现金流
- 本月收支对比
- 待处理事项
- 账户余额概览

---

## 🔗 服务对应

| 服务 | 说明 |
|------|------|
| `ReportService` | 通用报表服务 |
| `DashboardReportService` | 仪表板数据 |
| `FinancialReportService` | 财务报表 |
| `HRReportService` | 人事报表 |
| `AssetReportService` | 资产报表 |

---

**最后更新**：2025-12-27
