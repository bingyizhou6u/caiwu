# 测试指南

## 概述

本项目使用两种测试框架：
- **Vitest**: 单元测试和集成测试
- **Playwright**: E2E（端到端）测试

## 测试类型

### 1. 单元测试 (Unit Tests)

测试独立的函数、工具类和纯函数。

**位置**: `src/**/__tests__/*.test.ts` 或 `src/**/__tests__/*.test.tsx`

**示例**:
```tsx
// src/utils/__tests__/amount.test.ts
import { describe, it, expect } from 'vitest'
import { formatAmount, centsToYuan, yuanToCents } from '../amount'

describe('amount utils', () => {
  it('should convert cents to yuan', () => {
    expect(centsToYuan(100)).toBe(1)
    expect(centsToYuan(1234)).toBe(12.34)
  })

  it('should convert yuan to cents', () => {
    expect(yuanToCents(1)).toBe(100)
    expect(yuanToCents(12.34)).toBe(1234)
  })
})
```

### 2. 组件测试 (Component Tests)

测试 React 组件的渲染和交互。

**位置**: `src/**/__tests__/*.test.tsx`

**示例**:
```tsx
// src/components/form/__tests__/AmountInput.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AmountInput } from '../AmountInput'
import { Form } from 'antd'

describe('AmountInput', () => {
  it('renders correctly', () => {
    render(
      <Form>
        <Form.Item name="amount">
          <AmountInput placeholder="请输入金额" />
        </Form.Item>
      </Form>
    )
    expect(screen.getByPlaceholderText('请输入金额')).toBeInTheDocument()
  })
})
```

### 3. Hook 测试 (Hook Tests)

测试自定义 React Hooks。

**位置**: `src/hooks/**/__tests__/*.test.tsx`

**示例**:
```tsx
// src/hooks/business/__tests__/useAccounts.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useAccounts } from '../useAccounts'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useAccounts', () => {
  it('should fetch accounts', async () => {
    const { result } = renderHook(() => useAccounts(), {
      wrapper: createWrapper(),
    })
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
```

### 4. E2E 测试 (End-to-End Tests)

测试完整的用户流程。

**位置**: `tests/*.spec.ts`

**示例**:
```tsx
// tests/login.spec.ts
import { test, expect } from '@playwright/test'

test('user can login', async ({ page }) => {
  await page.goto('http://localhost:5173/login')
  await page.fill('input[id="email"]', 'admin@example.com')
  await page.fill('input[id="password"]', 'password')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*\/dashboard/)
})
```

## 测试工具函数

### 金额格式化测试

```tsx
import { describe, it, expect } from 'vitest'
import { formatAmount, formatAmountWithCurrency, centsToYuan } from '../amount'

describe('formatAmount', () => {
  it('formats cents correctly', () => {
    expect(formatAmount(100)).toMatch(/¥\s?1\.00/)
    expect(formatAmount(1234)).toMatch(/¥\s?12\.34/)
  })

  it('handles null/undefined', () => {
    expect(formatAmount(null)).toBe('-')
    expect(formatAmount(undefined)).toBe('-')
  })
})
```

### 状态映射测试

```tsx
import { describe, it, expect } from 'vitest'
import { getStatusText, getStatusColor, BORROWING_STATUS } from '../status'

describe('status utils', () => {
  it('gets status text correctly', () => {
    expect(getStatusText('pending', BORROWING_STATUS)).toBe('待审批')
    expect(getStatusText('approved', BORROWING_STATUS)).toBe('已通过')
  })

  it('gets status color correctly', () => {
    expect(getStatusColor('pending', BORROWING_STATUS)).toBe('processing')
    expect(getStatusColor('approved', BORROWING_STATUS)).toBe('success')
  })
})
```

### 日期格式化测试

```tsx
import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, calculateDaysDiff } from '../date'
import dayjs from 'dayjs'

describe('date utils', () => {
  it('formats date correctly', () => {
    expect(formatDate('2024-01-01')).toBe('2024-01-01')
    expect(formatDate(dayjs('2024-01-01'))).toBe('2024-01-01')
  })

  it('calculates days difference', () => {
    expect(calculateDaysDiff('2024-01-01', '2024-01-05')).toBe(5)
  })
})
```

## 测试 React Query Hooks

### Mock API 客户端

```tsx
import { vi } from 'vitest'
import { api as apiClient } from '../../../api/http'

vi.mock('../../../api/http', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

describe('useMyHook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches data correctly', async () => {
    const mockData = { results: [{ id: '1' }] }
    vi.mocked(apiClient.get).mockResolvedValue(mockData)

    const { result } = renderHook(() => useMyHook(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(mockData.results)
  })
})
```

## 测试表单组件

### 使用 React Hook Form

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Form } from 'antd'
import { EmployeeSelect } from '../EmployeeSelect'

describe('EmployeeSelect', () => {
  it('renders and allows selection', async () => {
    const user = userEvent.setup()
    
    render(
      <Form>
        <Form.Item name="employeeId">
          <EmployeeSelect />
        </Form.Item>
      </Form>
    )

    const select = screen.getByPlaceholderText('请选择员工')
    await user.click(select)
    
    // 测试选择逻辑
  })
})
```

## E2E 测试最佳实践

### 1. 使用 Mock API

```tsx
test('creates a flow', async ({ page }) => {
  // Mock API 响应
  await page.route('**/api/flows', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        json: { id: '1', amountCents: 100 },
      })
    } else {
      await route.fulfill({
        json: { results: [], total: 0 },
      })
    }
  })

  await page.goto('http://localhost:5173/finance/flows')
  // 执行测试操作
})
```

### 2. 等待元素出现

```tsx
// ✅ 使用 waitFor
await page.waitForSelector('button[type="submit"]')

// ✅ 使用 expect with timeout
await expect(page.getByText('保存成功')).toBeVisible({ timeout: 5000 })
```

### 3. 处理异步操作

```tsx
// ✅ 等待导航
await page.click('button[type="submit"]')
await expect(page).toHaveURL(/.*\/success/)

// ✅ 等待 API 请求完成
await page.waitForResponse(response => 
  response.url().includes('/api/flows') && response.status() === 200
)
```

## 测试覆盖率目标

- **单元测试**: 工具函数和纯函数 > 80%
- **组件测试**: 关键组件 > 60%
- **Hook 测试**: 业务 hooks > 70%
- **E2E 测试**: 核心用户流程 100%

## 运行测试

```bash
# 运行所有单元测试
npm test

# 运行测试并查看覆盖率
npm test -- --coverage

# 运行特定测试文件
npm test -- src/utils/__tests__/amount.test.ts

# 运行 E2E 测试
npm run test:e2e

# 运行 E2E 测试并打开 UI
npx playwright test --ui
```

## 测试检查清单

### 单元测试
- [ ] 测试正常情况
- [ ] 测试边界情况（null, undefined, 空数组等）
- [ ] 测试错误情况
- [ ] 测试返回值类型

### 组件测试
- [ ] 测试组件渲染
- [ ] 测试用户交互
- [ ] 测试 props 变化
- [ ] 测试错误状态

### Hook 测试
- [ ] 测试数据获取
- [ ] 测试加载状态
- [ ] 测试错误处理
- [ ] 测试缓存行为

### E2E 测试
- [ ] 测试核心用户流程
- [ ] 测试表单提交
- [ ] 测试导航
- [ ] 测试权限控制

## 常见问题

### Q: 如何测试需要 React Query 的组件？

A: 使用 `QueryClientProvider` 包装组件：

```tsx
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

render(<MyComponent />, { wrapper: createWrapper() })
```

### Q: 如何测试需要路由的组件？

A: 使用 `MemoryRouter` 或 `BrowserRouter`：

```tsx
import { MemoryRouter } from 'react-router-dom'

render(
  <MemoryRouter>
    <MyComponent />
  </MemoryRouter>
)
```

### Q: 如何 Mock Ant Design 组件？

A: 通常不需要 Mock，直接使用真实组件。如果需要 Mock，使用 `vi.mock`：

```tsx
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    Modal: {
      confirm: vi.fn(),
    },
  }
})
```

