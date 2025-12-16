# 错误码说明文档

> 本文档列出了系统中所有使用的错误码及其含义

## 错误码格式

错误码采用 `CATEGORY_DESCRIPTION` 格式，例如：`AUTH_UNAUTHORIZED`

## 错误码分类

### AUTH - 认证与授权错误

| 错误码 | HTTP 状态码 | 说明 | 解决方案 |
|--------|------------|------|---------|
| `AUTH_UNAUTHORIZED` | 401 | 未授权，未登录或 Token 无效 | 重新登录获取 Token |
| `AUTH_TOKEN_EXPIRED` | 401 | Token 已过期 | 刷新 Token 或重新登录 |
| `AUTH_FORBIDDEN` | 403 | 已登录但权限不足 | 联系管理员分配权限 |
| `AUTH_INVALID_CREDENTIALS` | 401 | 用户名或密码错误 | 检查用户名和密码 |
| `AUTH_TOTP_REQUIRED` | 401 | 需要 TOTP 验证 | 提供 TOTP 验证码 |

### VALIDATION - 验证错误

| 错误码 | HTTP 状态码 | 说明 | 解决方案 |
|--------|------------|------|---------|
| `VALIDATION_BAD_REQUEST` | 400 | 请求参数验证失败 | 检查请求参数格式 |
| `VALIDATION_REQUIRED_FIELD` | 400 | 必填字段缺失 | 补充必填字段 |
| `VALIDATION_INVALID_FORMAT` | 400 | 字段格式不正确 | 检查字段格式（如邮箱、日期等） |

### BUSINESS - 业务逻辑错误

| 错误码 | HTTP 状态码 | 说明 | 解决方案 |
|--------|------------|------|---------|
| `BUSINESS_GENERAL` | 400 | 通用业务错误 | 查看错误详情 |
| `BUSINESS_NOT_FOUND` | 404 | 资源不存在 | 检查资源 ID 是否正确 |
| `BUSINESS_DUPLICATE` | 409 | 资源已存在 | 检查是否重复创建 |
| `BUSINESS_STATE_INVALID` | 400 | 状态转换无效 | 检查当前状态是否允许此操作 |
| `BUSINESS_ACTION_FAILED` | 400 | 操作失败 | 查看错误详情 |
| `BUSINESS_INSUFFICIENT_BALANCE` | 400 | 余额不足 | 检查账户余额 |

### SYSTEM - 系统错误

| 错误码 | HTTP 状态码 | 说明 | 解决方案 |
|--------|------------|------|---------|
| `SYSTEM_INTERNAL_ERROR` | 500 | 系统内部错误 | 联系技术支持 |
| `SYSTEM_DB_ERROR` | 500 | 数据库错误 | 联系技术支持 |
| `SYSTEM_EXTERNAL_API` | 500 | 外部服务错误 | 稍后重试 |

## 错误响应格式

### 成功响应

```json
{
  "success": true,
  "data": {
    // 响应数据
  }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "未授权",
    "details": {
      // 可选的错误详情
    }
  }
}
```

## 前端错误处理示例

```typescript
import { ErrorCodes } from '@/constants/errorCodes'

try {
  const response = await apiClient.get('/api/v2/users')
  // 处理成功响应
} catch (error: any) {
  const errorCode = error.response?.data?.error?.code
  
  switch (errorCode) {
    case ErrorCodes.AUTH_UNAUTHORIZED:
      // 跳转到登录页
      router.push('/login')
      break
    case ErrorCodes.AUTH_FORBIDDEN:
      message.error('权限不足')
      break
    case ErrorCodes.BUSINESS_NOT_FOUND:
      message.error('资源不存在')
      break
    default:
      message.error(error.response?.data?.error?.message || '操作失败')
  }
}
```

## 错误码使用指南

### 后端使用

```typescript
import { Errors } from '../utils/errors.js'

// 抛出业务错误
throw Errors.NOT_FOUND('用户')

// 抛出验证错误
throw Errors.VALIDATION_ERROR('邮箱格式不正确')

// 抛出权限错误
throw Errors.FORBIDDEN()
```

### 前端使用

```typescript
import { ErrorCodes } from '@/constants/errorCodes'

// 检查错误码
if (error.code === ErrorCodes.AUTH_UNAUTHORIZED) {
  // 处理未授权错误
}
```

## 错误监控

所有错误都会被记录到监控系统中，包括：

- 错误码
- 错误消息
- 错误堆栈（开发环境）
- 请求上下文（用户 ID、IP、路径等）

## 更新日志

- 2025-12-15: 初始版本，包含所有基础错误码

