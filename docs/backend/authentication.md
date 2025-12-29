# 认证架构

## 概述

系统使用 **Cloudflare Access Zero Trust** 模式进行用户认证，不再使用传统的邮箱/密码登录。

## 架构

```
用户访问应用
     ↓
Cloudflare Access 边缘验证
     ↓
通过验证 → POST /api/v2/auth/cf-session
     ↓
后端验证 CF JWT → 查找员工 → 创建会话 → 签发应用 JWT
     ↓
前端存储 token → 进入系统
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/auth/cf-session` | POST | CF Access 登录，建立应用会话 |
| `/auth/logout` | POST | 登出，销毁会话 |
| `/auth/me` | GET | 获取当前用户信息 |
| `/my-permissions` | GET | 获取当前用户权限 |

## 认证流程

### 1. Cloudflare Access 验证

用户访问应用时，Cloudflare Access 在边缘拦截请求：
- 未登录用户被重定向到 CF Access 登录页
- 已登录用户在请求头中携带 `CF-Access-JWT-Assertion`

### 2. 后端会话建立

`/auth/cf-session` 端点：
1. 中间件验证 CF Access JWT（aud、iss、exp、签名）
2. 从 JWT 中提取用户邮箱
3. 在 `employees.personalEmail` 中查找匹配员工
4. 获取员工职位和权限
5. 创建 `sessions` 表记录
6. 签发应用内部 JWT

### 3. 前端 Token 管理

- Token 存储在 zustand store（持久化到 localStorage）
- API 请求自动携带 `Authorization: Bearer <token>` 和 `X-Caiwu-Token` header
- 401 响应自动清空 token 并跳转登录页

## JWT Payload

```typescript
{
  sid: string      // Session ID
  sub: string      // Employee ID
  email: string    // 员工邮箱
  name: string     // 员工姓名
  position: {...}  // 职位和权限信息
  cfSub: string    // CF Access 用户 ID（审计追踪）
}
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `CF_ACCESS_AUD` | Cloudflare Access Application Audience Tag |
| `CF_ACCESS_TEAM_DOMAIN` | Access Team Domain (如 ar-teams.cloudflareaccess.com) |
| `AUTH_JWT_SECRET` | 应用内部 JWT 签名密钥 |

## 安全特性

- **Zero Trust**: 未验证流量在边缘被拦截，不会到达应用
- **双重 JWT**: CF Access JWT + 应用内部 JWT
- **无密码存储**: 不再存储用户密码，无泄露风险
- **边缘防护**: DDoS/暴力破解在 Cloudflare 边缘被阻止
