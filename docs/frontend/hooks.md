# 自定义 Hooks 文档

> **目录**：`frontend/src/hooks/`  
> **导出入口**：`frontend/src/hooks/index.ts`

---

## 📁 结构

```
hooks/
├── index.ts              # 统一导出入口
├── business/             # 业务 Hooks (49+)
│   ├── useEmployees.ts
│   ├── useFlows.ts
│   ├── useLeaves.ts
│   └── ...
├── forms/                # 表单 Hooks (6)
│   ├── useFormModal.ts
│   ├── useTableActions.ts
│   └── useZodForm.ts
├── useBusinessData.ts    # 业务数据聚合
├── usePermissionConfig.ts # 权限配置
└── usePWA.ts             # PWA 相关
```

---

## 🔗 业务 Hooks 分类

### 员工管理
- `useEmployees` - 员工列表
- `useCreateEmployee` - 创建员工
- `useUpdateEmployeeSalaries` - 更新薪资
- `useDeleteEmployee` - 删除员工
- `useResetUserPassword` - 重置密码

### 财务
- `useFlows` - 现金流水
- `useAccountTransfers` - 账户转账
- `useAR`, `useAP` - 应收应付
- `useSalaryPayments` - 薪资发放

### 人事
- `useLeaves` - 请假管理
- `useExpenses` - 报销管理
- `useAllowances` - 津贴管理

### 资产
- `useFixedAssets` - 固定资产
- `useRentalProperties` - 租赁物业
- `useDormitoryAllocations` - 宿舍分配

### 报表
- `useAPSummary`, `useARSummary` - 应收应付汇总
- `useAccountBalance` - 账户余额
- `useDepartmentCash` - 部门现金

### 个人中心
- `useMyDashboard` - 我的仪表板
- `useMyLeaves` - 我的请假
- `useMyReimbursements` - 我的报销
- `useMyProfile` - 我的资料

### 项目管理 (PM)
- `useProjects` - 项目列表
- `useTasks`, `useTask` - 任务列表/单个任务
- `useKanbanTasks` - 看板数据
- `useCreateTask`, `useUpdateTask`, `useDeleteTask` - 任务 CRUD
- `useUpdateTaskStatus` - 更新任务状态
- `useTimelogs`, `useCreateTimelog` - 工时记录

---

## 🎨 表单 Hooks

| Hook | 用途 |
|------|------|
| `useFormModal` | 管理表单弹窗状态 |
| `useMultipleModals` | 多弹窗管理 |
| `useTableActions` | 表格操作封装 |
| `useZodForm` | Zod 表单验证 |

---

## 📝 使用示例

```tsx
import { useEmployees, useCreateEmployee } from '@/hooks'

function EmployeePage() {
  const { data, isLoading } = useEmployees()
  const { mutate: create } = useCreateEmployee()

  return (
    <Table dataSource={data?.data} loading={isLoading} />
  )
}
```

---

**最后更新**：2025-12-28
