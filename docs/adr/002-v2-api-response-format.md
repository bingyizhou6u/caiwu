# ADR-002: V2 API 统一响应格式

## 状态

已采用

## 上下文

项目需要统一 API 响应格式，以便：

1. **前端统一处理**: 前端可以统一处理所有 API 响应
2. **错误处理**: 统一的错误格式便于错误处理和监控
3. **类型安全**: TypeScript 项目需要类型安全的响应格式
4. **向后兼容**: 需要支持从 V1 到 V2 的平滑迁移

## 决策

V2 API 采用统一的响应格式：

```typescript
// 成功响应
{
  success: true,
  data: T
}

// 错误响应
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  }
}
```

## 理由

### 优势

1. **明确的状态标识**: `success` 字段明确标识请求是否成功
2. **类型安全**: TypeScript 可以基于 `success` 字段进行类型收窄
3. **统一错误格式**: 所有错误都有统一的结构，便于处理
4. **可扩展性**: `details` 字段允许添加额外的错误信息

### 与其他方案对比

| 方案 | 优势 | 劣势 | 选择 |
|------|------|------|------|
| **统一格式** | 类型安全、易于处理 | 需要迁移 | ✅ 采用 |
| HTTP 状态码 | 标准、简单 | 类型不安全 | ❌ 不采用 |
| 混合格式 | 灵活 | 不一致、难以处理 | ❌ 不采用 |

## 后果

### 正面影响

1. ✅ 前端代码更简洁，统一的错误处理逻辑
2. ✅ TypeScript 类型安全，减少运行时错误
3. ✅ 便于错误监控和日志记录
4. ✅ 更好的开发体验

### 负面影响

1. ⚠️ 需要从 V1 迁移到 V2
2. ⚠️ 响应体积略有增加（`success` 字段）

### 风险缓解

1. **渐进式迁移**: V1 和 V2 并存，逐步迁移
2. **文档完善**: 详细的迁移指南和示例
3. **工具函数**: 提供响应工具函数简化使用

## 实施

### 后端工具函数

```typescript
// utils/response.ts
export const apiSuccess = <T>(data: T): ApiSuccessResponse<T> => ({
  success: true,
  data
})

export const apiError = (
  code: string,
  message: string,
  details?: any
): ApiErrorResponse => ({
  success: false,
  error: { code, message, details }
})
```

### 前端类型定义

```typescript
type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } }

// 类型收窄
function handleResponse<T>(response: ApiResponse<T>) {
  if (response.success) {
    // TypeScript 知道这里是 T 类型
    return response.data
  } else {
    // TypeScript 知道这里是错误
    throw new Error(response.error.message)
  }
}
```

### 分页响应格式

```typescript
{
  success: true,
  data: {
    items: T[],
    pagination: {
      page: number,
      pageSize: number,
      total: number,
      totalPages: number
    }
  }
}
```

### 游标分页响应格式

```typescript
{
  success: true,
  data: {
    results: T[],
    pagination: {
      hasNext: boolean,
      hasPrev: boolean,
      nextCursor?: string,
      prevCursor?: string,
      limit: number
    }
  }
}
```

## 迁移指南

### V1 到 V2 迁移

1. **更新 API 路径**: `/api/xxx` → `/api/v2/xxx`
2. **更新响应处理**: 检查 `success` 字段
3. **更新错误处理**: 使用 `error.code` 和 `error.message`

### 示例

```typescript
// V1
const response = await fetch('/api/users')
const data = await response.json()
// data 直接是用户数组

// V2
const response = await fetch('/api/v2/users')
const result = await response.json()
if (result.success) {
  const data = result.data.items // 用户数组
} else {
  // 处理错误
  console.error(result.error.message)
}
```

## 参考

- [API 参考文档](../../.qoder/repowiki/zh/content/API参考/API参考.md)
- [错误码文档](../ERROR_CODES.md)

## 更新记录

- 2025-12-15: 初始版本

