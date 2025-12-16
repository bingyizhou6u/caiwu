# 测试文件 V2 迁移指南

## 概述

所有路由已迁移到 v2，测试文件需要相应更新以使用 v2 路由和响应格式。

## 迁移步骤

### 1. 更新导入路径

**旧格式：**
```typescript
import { ipWhitelistRoutes } from '../../src/routes/ip-whitelist.js'
```

**新格式：**
```typescript
import { ipWhitelistRoutes } from '../../src/routes/v2/ip-whitelist.js'
```

### 2. 更新响应格式断言

#### V1 响应格式
```typescript
const data = await res.json()
expect(data).toEqual(mockResult)  // 直接比较
// 或
expect(data.ok).toBe(true)
```

#### V2 响应格式
```typescript
const data = await res.json()
expect(data.success).toBe(true)  // 使用 success 字段
expect(data.data).toEqual(mockResult)  // 数据在 data 字段中
```

### 3. 特殊情况的处理

#### 列表响应
如果路由返回列表，v2 格式可能是：
```typescript
// V2 可能返回 { results: [...] }
expect(data.data.results).toEqual(mockResult)
```

#### 分页响应
```typescript
expect(data.success).toBe(true)
expect(data.data.items).toEqual(mockItems)
expect(data.data.pagination).toEqual(mockPagination)
```

#### 错误响应
```typescript
const data = await res.json()
expect(data.success).toBe(false)
expect(data.error.code).toBe('ERROR_CODE')
expect(data.error.message).toBe('Error message')
```

## 需要更新的测试文件

以下测试文件仍在使用 v1 路由，需要更新：

1. ✅ `test/routes/ip-whitelist.test.ts` - 已完成
2. ⏳ `test/routes/employees.test.ts`
3. ⏳ `test/routes/audit.test.ts`
4. ⏳ `test/routes/allowance-payments.test.ts`
5. ⏳ `test/routes/employee-allowances.test.ts`
6. ⏳ `test/routes/employee-salaries.test.ts`
7. ⏳ `test/routes/site-bills.test.ts`
8. ⏳ `test/routes/my.test.ts`
9. ⏳ `test/routes/salary-payments.test.ts`
10. ⏳ `test/routes/rental.test.ts`
11. ⏳ `test/routes/position-permissions.test.ts`
12. ⏳ `test/routes/fixed-assets.test.ts`
13. ⏳ `test/routes/approvals.test.ts`

## 参考示例

参考 `test/routes/ip-whitelist.test.ts` 作为迁移示例。

## 注意事项

1. **响应结构变化**：v2 统一使用 `{ success, data, error }` 结构
2. **列表包装**：某些路由可能将列表包装在 `results` 或 `items` 字段中
3. **错误处理**：错误响应使用 `error` 对象，包含 `code` 和 `message`
4. **向后兼容**：旧的 v1 路由文件可以保留用于测试，但建议迁移到 v2

## 验证

更新后运行测试：
```bash
npm test -- test/routes/[filename].test.ts --run
```

确保所有测试通过后再继续下一个文件。

