# 路由配置文档

> **目录**：`frontend/src/router/`  
> **核心文件**：`index.tsx`

---

## 🗺️ 路由结构

```
/
├── /login                    # 登录页（公开）
├── /auth/activate            # 账户激活（公开）
├── /auth/reset-password      # 密码重置（公开）
├── /auth/request-totp-reset  # TOTP 重置请求（公开）
├── /auth/reset-totp          # TOTP 重置确认（公开）
│
└── / (需登录，MainLayout)
    ├── /my/center            # 首页/个人中心
    ├── /my/leaves            # 我的请假
    ├── /my/reimbursements    # 我的报销
    ├── /my/assets            # 我的资产
    ├── /my/approvals         # 我的审批
    │
    ├── /finance/flows        # 资金流水
    ├── /finance/transfer     # 账户转账
    ├── /finance/transactions # 账户动账
    ├── /finance/ar           # 应收管理
    ├── /finance/ap           # 应付管理
    │
    ├── /hr/employees         # 员工管理
    ├── /hr/salary-payments   # 薪资发放
    ├── /hr/allowance-payments# 津贴发放
    ├── /hr/leaves            # 请假管理
    ├── /hr/reimbursements    # 报销管理
    │
    ├── /assets/list          # 固定资产
    ├── /assets/rental        # 租赁管理
    │
    ├── /sites/list           # 站点管理
    ├── /sites/bills          # 站点账单
    │
    ├── /reports/*            # 报表模块
    │
    └── /system/*             # 系统管理
```

---

## ⚡ 懒加载机制

所有页面组件使用 `React.lazy()` + `Suspense` 实现代码分割：

```tsx
const loaders = {
  'finance/flows': () => import('../features/finance/pages/FlowsPage'),
  // ...
}

const Flows = lazy(loaders['finance/flows'])
```

### 路由预加载

```tsx
import { preloadRoute } from '@/router'

// 鼠标悬停时预加载
<Menu onMouseEnter={() => preloadRoute('finance/flows')} />
```

---

## 🔒 路由守卫

### PrivateRoute

```tsx
// router/PrivateRoute.tsx
export const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return children
}
```

---

## 📂 路由与 Features 对应

| 路由前缀 | Feature 目录 |
|---------|-------------|
| `/my/*` | `features/my/` |
| `/finance/*` | `features/finance/` |
| `/hr/*` | `features/hr/` |
| `/assets/*` | `features/assets/` |
| `/sites/*` | `features/sites/` |
| `/reports/*` | `features/reports/` |
| `/system/*` | `features/system/` |
| `/auth/*` | `features/auth/` |

---

**最后更新**：2025-12-27
