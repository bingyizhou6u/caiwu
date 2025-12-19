# 路由与API测试

<cite>
**本文档引用的文件**  
- [auth.test.ts](file://backend/test/routes/v2/auth.test.ts)
- [master-data.test.ts](file://backend/test/routes/v2/master-data.test.ts)
- [batch-operations.test.ts](file://backend/test/routes/v2/batch-operations.test.ts)
- [auth.ts](file://backend/src/routes/v2/auth.ts)
- [master-data.ts](file://backend/src/routes/v2/master-data.ts)
- [currencies.ts](file://backend/src/routes/v2/master-data/currencies.ts)
- [security.ts](file://backend/src/middleware/security.ts)
- [permission.ts](file://backend/src/middleware/permission.ts)
- [ipWhitelist.ts](file://backend/src/middleware/ipWhitelist.ts)
- [rateLimit.ts](file://backend/src/middleware/rateLimit.ts)
- [jwt.ts](file://backend/src/utils/jwt.ts)
- [auth.ts](file://backend/src/utils/auth.ts)
- [AuthService.ts](file://backend/src/services/AuthService.ts)
- [response.ts](file://backend/src/utils/response.ts)
</cite>

## 目录
1. [引言](#引言)
2. [认证API端到端测试方案](#认证api端到端测试方案)
3. [主数据API端到端测试方案](#主数据api端到端测试方案)
4. [批量操作API测试方案](#批量操作api测试方案)
5. [安全机制验证方法](#安全机制验证方法)
6. [测试流程与数据库状态验证](#测试流程与数据库状态验证)
7. [API版本兼容性与迁移测试](#api版本兼容性与迁移测试)
8. [结论](#结论)

## 引言
本文档系统化描述了财务管理系统中路由层的集成测试方案，重点解析`auth.test.ts`和`master-data.test.ts`文件中对RESTful API端点的端到端验证。详细说明了如何测试HTTP方法、路径参数、查询参数和请求体的正确性，以及响应状态码、数据格式和错误信息的合规性。涵盖了认证中间件（JWT、TOTP）、权限控制、IP白名单等安全机制在API测试中的验证方法。结合`batch-operations.test.ts`，展示了批量操作接口的幂等性、事务完整性和性能边界测试。提供了测试中模拟请求、设置认证头、验证数据库状态变更的完整流程，并讨论了API版本兼容性和迁移测试策略。

## 认证API端到端测试方案

`auth.test.ts`文件实现了对认证API的全面端到端测试，验证了登录、获取用户信息等核心功能。测试使用Vitest框架，通过模拟HTTP请求来验证API的正确性。

测试首先在`beforeAll`钩子中初始化数据库，执行SQL模式文件来创建所有必要的表结构。`beforeEach`钩子在每个测试用例执行前清理数据库中的`employees`、`sessions`和`positions`表，确保测试环境的纯净。

登录测试用例（`POST /api/v2/auth/login`）通过以下步骤验证：
1. 在数据库中创建一个测试用户和职位记录
2. 构造包含邮箱、密码和TOTP验证码的请求体
3. 发送POST请求到`/api/v2/auth/login`端点
4. 验证响应状态码为200
5. 验证响应体包含`success: true`、有效的`token`和`user`信息

获取用户信息测试用例（`GET /api/v2/auth/me`）通过以下步骤验证：
1. 先执行登录操作获取JWT令牌
2. 在请求头中设置`Authorization: Bearer <token>`
3. 发送GET请求到`/api/v2/auth/me`端点
4. 验证响应状态码为200
5. 验证响应体包含正确的用户信息

这些测试验证了认证流程的完整性和响应格式的统一性，确保API返回符合V2版本规范的响应结构。

**Section sources**
- [auth.test.ts](file://backend/test/routes/v2/auth.test.ts#L1-L189)

## 主数据API端到端测试方案

`master-data.test.ts`文件实现了对主数据管理API的端到端测试，重点验证了币种（currencies）的创建和查询功能。该测试同样使用Vitest框架，通过模拟完整的HTTP请求-响应周期来验证API的正确性。

测试用例（`should allow creating and listing currencies with unified response format`）通过以下步骤验证主数据API：
1. **用户权限设置**：创建一个具有系统管理权限的管理员用户，其权限配置允许对币种进行创建、读取、更新和删除操作。
2. **用户登录**：调用`/api/v2/auth/login`端点获取JWT令牌，用于后续需要认证的请求。
3. **创建币种**：使用获取的令牌，发送POST请求到`/api/v2/currencies`端点，创建一个新的币种（如CNY）。
4. **验证创建结果**：检查响应状态码为200，响应体包含`success: true`，并验证返回的币种代码和名称与请求一致。
5. **查询币种列表**：发送GET请求到`/api/v2/currencies`端点，获取所有币种列表。
6. **验证查询结果**：检查响应状态码为200，响应体包含`success: true`，并在结果数组中找到刚刚创建的币种。

该测试验证了主数据API的完整工作流，包括权限控制、数据创建、数据查询和响应格式的统一性。测试确保了只有具有适当权限的用户才能创建和管理主数据，并且API返回的数据格式符合V2版本的统一规范。

**Section sources**
- [master-data.test.ts](file://backend/test/routes/v2/master-data.test.ts#L1-L154)

## 批量操作API测试方案

`batch-operations.test.ts`文件实现了对批量操作API的全面测试，验证了批量删除、批量停用等操作的正确性、事务完整性和错误处理能力。该测试方案特别关注了幂等性、事务完整性和性能边界。

### 批量删除操作测试
`should batch create and then delete currencies`测试用例验证了批量删除功能：
1. **数据准备**：在数据库中预置USD、EUR和JPY三种币种。
2. **批量删除**：发送POST请求到`/api/v2/currencies/batch`端点，请求体包含`ids: ['USD', 'EUR']`和`operation: 'delete'`。
3. **验证结果**：检查响应状态码为200，响应体显示`successCount: 2`，`failureCount: 0`。
4. **数据库验证**：直接查询数据库，确认USD和EUR已被删除，而JPY仍然存在。

### 批量操作错误处理测试
`should report failures when deleting used currency`测试用例验证了错误处理机制：
1. **数据准备**：创建USD和CNY两种币种，并创建一个使用USD币种的账户。
2. **批量删除**：尝试批量删除USD（已使用）和CNY（未使用）。
3. **验证部分失败**：检查响应体显示`successCount: 1`（CNY删除成功），`failureCount: 1`（USD删除失败）。
4. **错误信息验证**：验证失败原因包含"无法删除"的错误信息。
5. **数据库状态验证**：确认USD币种仍然存在，确保了数据完整性。

### 批量停用操作测试
`should batch deactivate currencies`测试用例验证了批量停用功能：
1. **数据准备**：创建一个激活状态的USD币种。
2. **批量停用**：发送批量操作请求，操作类型为`deactivate`。
3. **状态验证**：直接查询数据库，确认USD币种的`active`字段已更新为0。

这些测试确保了批量操作API的健壮性，验证了其在成功、部分成功和完全失败情况下的正确行为，以及对数据库状态变更的准确控制。

**Section sources**
- [batch-operations.test.ts](file://backend/test/routes/v2/batch-operations.test.ts#L1-L236)

## 安全机制验证方法

路由层的集成测试方案全面覆盖了多种安全机制的验证，确保API在各种安全威胁下仍能正确运行。

### 认证中间件验证
认证中间件（JWT和TOTP）在`auth.test.ts`中得到了充分验证：
- **JWT令牌生成与验证**：登录测试验证了系统能正确生成符合JWT标准的令牌，并且`/me`端点能正确解析和验证令牌。
- **TOTP双因素认证**：测试中生成了TOTP验证码并包含在登录请求中，验证了双因素认证流程的正确性。
- **令牌提取**：测试验证了系统能从`Authorization`头、自定义头`x-caiwu-token`和Cookie中正确提取认证令牌。

### 权限控制验证
权限控制在`master-data.test.ts`中得到了验证：
- **权限配置**：测试中创建的管理员用户具有完整的系统权限，其权限信息以JSON格式存储在数据库中。
- **权限检查**：主数据API在创建、更新和删除操作前会调用`hasPermission`函数检查用户权限。
- **拒绝访问**：如果用户没有相应权限，系统会返回403 Forbidden错误。

### IP白名单验证
IP白名单机制在`ipWhitelist.ts`中实现，并通过以下方式验证：
- **健康检查放行**：`/api/health`和`/api/version`等健康检查端点始终允许访问。
- **IP地址提取**：从`CF-Connecting-IP`头获取客户端IP地址。
- **缓存机制**：使用内存缓存存储白名单IP，每分钟刷新一次，提高性能。
- **访问控制**：如果IP白名单规则启用且客户端IP不在白名单中，则返回403 Forbidden错误。

### 请求限流验证
请求限流机制在`rateLimit.ts`中实现，通过以下策略保护敏感接口：
- **登录限流**：每IP每分钟最多5次登录尝试。
- **密码重置限流**：每IP每小时最多3次重置请求。
- **TOTP重置限流**：每邮箱每小时最多3次重置请求。
- **通用API限流**：每用户每分钟最多100次请求，每IP每分钟最多200次请求。

这些安全机制的测试确保了系统在面对暴力破解、DDoS攻击和未授权访问等安全威胁时具有足够的防护能力。

**Section sources**
- [security.ts](file://backend/src/middleware/security.ts#L1-L81)
- [permission.ts](file://backend/src/middleware/permission.ts#L1-L43)
- [ipWhitelist.ts](file://backend/src/middleware/ipWhitelist.ts#L1-L76)
- [rateLimit.ts](file://backend/src/middleware/rateLimit.ts#L1-L134)
- [jwt.ts](file://backend/src/utils/jwt.ts#L1-L132)
- [auth.ts](file://backend/src/utils/auth.ts#L1-L17)
- [AuthService.ts](file://backend/src/services/AuthService.ts#L1-L495)

## 测试流程与数据库状态验证

路由层的集成测试方案采用了完整的端到端测试流程，确保了测试的可靠性和可重复性。

### 测试环境初始化
测试使用`beforeAll`钩子在所有测试用例执行前初始化数据库：
```typescript
beforeAll(async () => {
  const statements = schemaSql.split(';').filter(s => s.trim().length > 0)
  for (const statement of statements) {
    await env.DB.prepare(statement).run()
  }
  db = drizzle(env.DB, { schema })
})
```
此过程执行SQL模式文件，创建所有必要的数据库表，确保测试环境与生产环境一致。

### 测试数据准备
每个测试用例通过`beforeEach`钩子在执行前清理相关表的数据，然后手动插入测试所需的数据：
- 创建职位记录（`positions`表）
- 创建员工记录（`employees`表），包含邮箱、密码哈希、TOTP密钥等
- 设置用户权限
- 预置主数据（如币种、账户等）

### HTTP请求模拟
测试使用应用实例的`request`方法直接模拟HTTP请求，无需启动实际服务器：
```typescript
const res = await app.request(
  '/api/v2/auth/login',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, totp }),
  },
  testEnv,
  executionCtx as any
)
```
这种方法避免了网络延迟，提高了测试速度，并允许直接访问应用上下文。

### 数据库状态验证
除了验证HTTP响应，测试还直接查询数据库来验证状态变更：
```typescript
const remaining = await db.select().from(currencies).all()
expect(remaining.length).toBe(1)
expect(remaining[0].code).toBe('JPY')
```
这种直接的数据库验证确保了API操作确实改变了持久化状态，而不仅仅是返回了正确的响应。

### 异步任务处理
测试正确处理了异步任务（如邮件发送），通过`waitUntil`机制等待所有异步操作完成：
```typescript
await Promise.all(tasks)
```
这确保了测试不会在异步操作完成前就结束，提高了测试的准确性。

**Section sources**
- [auth.test.ts](file://backend/test/routes/v2/auth.test.ts#L1-L189)
- [master-data.test.ts](file://backend/test/routes/v2/master-data.test.ts#L1-L154)
- [batch-operations.test.ts](file://backend/test/routes/v2/batch-operations.test.ts#L1-L236)

## API版本兼容性与迁移测试

系统通过多种机制确保API版本兼容性和平滑迁移，这些机制在测试方案中得到了验证。

### 统一响应格式
所有API端点返回统一的响应格式，确保了客户端的兼容性：
```typescript
export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  message?: string
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
  }
}
```
这种统一的响应结构使得客户端可以一致地处理成功和错误响应，无论API版本如何变化。

### 版本化路由
API使用版本化路由（`/api/v2/`），允许新旧版本并存：
- V2版本的认证API位于`/api/v2/auth/login`
- 系统可以同时支持V1和V2版本，逐步迁移客户端

### 缓存兼容性
主数据API实现了查询缓存机制，确保了性能和数据一致性的平衡：
- 使用`createQueryCache`创建缓存实例
- 为不同查询条件生成不同的缓存键
- 在数据变更时清除相关缓存
- 异步更新缓存，不阻塞响应

### 迁移策略
系统提供了V2迁移指南（`V2_MIGRATION_GUIDE.md`），指导客户端如何从旧版本迁移到新版本。测试方案确保了：
- 新版本API的稳定性
- 旧版本API的向后兼容性
- 平滑的迁移路径

这些机制共同确保了API的长期可维护性和系统的稳定性。

**Section sources**
- [response.ts](file://backend/src/utils/response.ts#L1-L132)

## 结论
本文档系统化地描述了财务管理系统路由层的集成测试方案。通过分析`auth.test.ts`、`master-data.test.ts`和`batch-operations.test.ts`等测试文件，展示了如何对RESTful API端点进行端到端验证。测试方案全面覆盖了HTTP方法、路径参数、查询参数和请求体的正确性验证，以及响应状态码、数据格式和错误信息的合规性检查。

安全机制的测试方案特别完善，涵盖了JWT认证、TOTP双因素认证、基于角色的权限控制、IP白名单和请求限流等多种安全措施。批量操作API的测试确保了幂等性、事务完整性和错误处理的正确性。

测试流程设计合理，通过直接调用应用实例的`request`方法模拟HTTP请求，避免了网络开销，提高了测试效率。同时，通过直接查询数据库来验证状态变更，确保了测试的准确性和可靠性。

API版本兼容性通过统一的响应格式、版本化路由和缓存机制得到保障，为系统的长期维护和演进提供了坚实的基础。整体测试方案体现了高质量的工程实践，确保了系统的稳定性、安全性和可维护性。