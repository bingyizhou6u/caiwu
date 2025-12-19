# 测试指南

本文档介绍项目的测试脚本和工具使用方法。

## 后端测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行服务层测试
npm run test:services

# 运行路由层测试
npm run test:routes

# 运行工具函数测试
npm run test:utils

# 监视模式（自动运行变更的测试）
npm run test:watch

# 运行变更相关的测试
npm run test:changed
```

### 测试覆盖率

```bash
# 生成覆盖率报告
npm run test:coverage

# 查看覆盖率UI
npm run test:coverage:ui

# 检查覆盖率是否达标
npm run test:coverage:check
```

### 测试数据管理

```bash
# 生成完整测试数据
npm run test:seed

# 仅生成最小数据集
npm run test:seed:minimal

# 清理所有测试数据
npm run test:clean

# 清理特定模块数据
npm run test:clean -- --module=finance
npm run test:clean -- --module=hr
npm run test:clean -- --module=asset
```

### CI环境测试

```bash
# CI优化配置运行测试
npm run test:ci
```

## 前端测试

### 单元测试

```bash
# 运行单元测试
npm run test:unit

# 监视模式
npm run test:unit:watch
```

### E2E测试

```bash
# 运行所有E2E测试
npm run test:e2e

# 有头模式（显示浏览器）
npm run test:e2e:headed

# 调试模式
npm run test:e2e:debug

# 运行特定模块测试
npm run test:e2e:auth      # 认证流程测试
npm run test:e2e:finance   # 财务模块测试
npm run test:e2e:hr        # 人事模块测试
```

### 运行所有测试

```bash
# 运行单元测试 + E2E测试
npm run test:all

# CI环境测试
npm run test:ci
```

## 测试工具和Fixtures

### 后端测试Fixtures

项目提供了完整的测试数据fixtures，位于 `backend/test/fixtures/`：

- `master-data.ts` - 主数据（部门、职位、账户、币种等）
- `employees.ts` - 员工数据（包含不同角色和权限）
- `finance.ts` - 财务数据（流水、应收应付、借款等）
- `assets.ts` - 资产数据（固定资产、租赁物业等）

使用示例：

```typescript
import { getAllFixtures, FIXTURE_IDS, EMPLOYEE_IDS } from '../fixtures'

// 获取所有fixtures
const fixtures = getAllFixtures()

// 使用预定义的ID
const ceoId = EMPLOYEE_IDS.CEO
const accountId = FIXTURE_IDS.ACCOUNT_BANK_CNY
```

### 测试辅助函数

位于 `backend/test/helpers/`：

#### 数据库辅助 (db-helper.ts)

```typescript
import { createTestEntity, findEntity, truncateAllTables } from '../helpers/db-helper'

// 创建测试实体
const employee = await createTestEntity.employee(db, { name: 'Test User' })
const account = await createTestEntity.account(db)

// 查找实体
const foundEmployee = await findEntity.employeeById(db, employee.id)

// 清理数据
await truncateAllTables(db)
```

#### Mock辅助 (mock-helper.ts)

```typescript
import { createMockService, createMockContext } from '../helpers/mock-helper'

// 创建Mock服务
const mockFinanceService = createMockService.finance()
mockFinanceService.createCashFlow.mockResolvedValue({ id: '123' })

// 创建Mock上下文
const mockContext = createMockContext()
```

#### 断言辅助 (assertion-helper.ts)

```typescript
import { assertEmployee, assertCashFlow, assertResponse } from '../helpers/assertion-helper'

// 业务断言
assertEmployee.hasRequiredFields(employee)
assertEmployee.isActive(employee)

assertCashFlow.isIncome(flow)
assertCashFlow.isNotReversed(flow)

// API响应断言
await assertResponse.isSuccess(response)
await assertResponse.hasPagination(response)
```

### 前端测试工具

#### Page Objects (tests/utils/page-objects.ts)

```typescript
import { createPageObjects } from './utils/page-objects'

test('user login', async ({ page }) => {
  const po = createPageObjects(page)
  
  // 使用Page Object
  await po.login.login('user@example.com', 'password')
  await po.login.expectLoginSuccess()
  
  // 创建财务流水
  await po.financeFlow.gotoList()
  await po.financeFlow.createFlow({
    type: 'income',
    account: 'acc-001',
    amount: '100000',
  })
})
```

#### 用户Fixtures (tests/fixtures/users.ts)

```typescript
import { TEST_USERS, getUserFixture } from './fixtures/users'

// 获取测试用户
const adminUser = getUserFixture('admin')
const financeUser = TEST_USERS.finance

await po.login.login(adminUser.email, adminUser.password)
```

## 测试最佳实践

### 1. 使用Fixtures

优先使用fixtures而不是硬编码测试数据：

```typescript
// ✅ 好
import { EMPLOYEE_IDS } from '../fixtures'
const employeeId = EMPLOYEE_IDS.CEO

// ❌ 避免
const employeeId = 'some-random-id'
```

### 2. 测试隔离

每个测试应该独立，使用 `beforeEach` 清理数据：

```typescript
beforeEach(async () => {
  await db.delete(employees).execute()
  await db.delete(cashFlows).execute()
})
```

### 3. 使用辅助函数

利用测试辅助函数简化测试代码：

```typescript
// ✅ 好
const employee = await createTestEntity.employee(db)
assertEmployee.hasRequiredFields(employee)

// ❌ 避免重复代码
const employee = await db.insert(employees).values({
  id: uuid(),
  email: 'test@example.com',
  // ... 很多字段
}).execute()
expect(employee.id).toBeDefined()
expect(employee.email).toBeDefined()
// ...
```

### 4. Mock外部依赖

测试时Mock外部服务：

```typescript
const mockEmailService = createMockService.email()
mockEmailService.sendEmail.mockResolvedValue({ success: true })
```

### 5. E2E测试使用Page Objects

E2E测试使用Page Object模式提高可维护性：

```typescript
// ✅ 好
await po.employee.createEmployee({ name: 'John', email: 'john@example.com' })

// ❌ 避免
await page.click('button:has-text("新增员工")')
await page.fill('#name', 'John')
// ...
```

## 故障排查

### 测试失败

1. 检查数据库状态是否正确初始化
2. 确认Mock配置正确
3. 查看详细错误信息 `npm test -- --reporter=verbose`

### 覆盖率不达标

1. 运行 `npm run test:coverage:ui` 查看未覆盖的代码
2. 针对性添加测试用例
3. 使用 `npm run test:coverage:check` 验证

### E2E测试不稳定

1. 增加适当的等待时间
2. 使用更精确的选择器
3. 检查Mock API是否正确配置

## 参考资源

- [Vitest 文档](https://vitest.dev/)
- [Playwright 文档](https://playwright.dev/)
- [Testing Library 文档](https://testing-library.com/)
