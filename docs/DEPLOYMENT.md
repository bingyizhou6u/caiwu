# 部署文档

> 详细的部署指南，包括生产环境部署、环境变量配置和回滚流程

## 📋 目录

1. [前置要求](#前置要求)
2. [环境准备](#环境准备)
3. [数据库迁移](#数据库迁移)
4. [部署步骤](#部署步骤)
5. [环境变量配置](#环境变量配置)
6. [验证部署](#验证部署)
7. [回滚流程](#回滚流程)
8. [监控与告警](#监控与告警)

## 前置要求

### 必需工具

- Node.js 18+
- npm 或 yarn
- Wrangler CLI（通过 npm 安装）
- Cloudflare 账户

### 必需权限

- Cloudflare 账户管理员权限
- D1 数据库访问权限
- Workers 部署权限

## 环境准备

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
# 或使用项目本地版本
npm install
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

这会打开浏览器，完成 Cloudflare 账户登录。

### 3. 配置项目

确保 `wrangler.toml` 文件配置正确：

```toml
name = "caiwu-backend"
main = "src/index.ts"
compatibility_date = "2024-11-21"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "caiwu-db"
database_id = "your-database-id"

[[r2_buckets]]
binding = "VOUCHERS"
bucket_name = "caiwu-vouchers"

[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "your-kv-namespace-id"
```

## 数据库迁移

### 1. 检查迁移状态

```bash
npm run migrate:check:remote
```

### 2. 应用迁移

```bash
# 应用所有未执行的迁移
npm run migrate:up:remote

# 或手动执行单个迁移文件
wrangler d1 execute caiwu-db --remote --file=src/db/migration_xxx.sql
```

### 3. 验证迁移

```bash
# 查看迁移历史
npm run migrate:status:remote
```

## 部署步骤

### 1. 代码检查

```bash
# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 运行测试
npm test
```

### 2. 构建（如果需要）

```bash
# 生成 OpenAPI 文档
npm run gen:openapi
```

### 3. 部署到生产环境

```bash
# 部署 Workers
npm run deploy

# 或使用 wrangler 命令
wrangler deploy
```

### 4. 部署到预览环境（可选）

```bash
wrangler deploy --env preview
```

## 环境变量配置

### Secret 变量

Secret 变量通过 `wrangler secret` 命令设置，不会存储在代码中：

```bash
# JWT 密钥（必需）
wrangler secret put AUTH_JWT_SECRET
# 输入: 你的 JWT 密钥（至少 32 字符）

# 邮件服务 Token（如果使用邮件服务）
wrangler secret put EMAIL_TOKEN
```

### 普通变量

普通变量在 `wrangler.toml` 中配置：

```toml
[vars]
CF_ACCOUNT_ID = "your-account-id"
CF_ZONE_ID = "your-zone-id"
CF_IP_LIST_ID = "your-ip-list-id"
```

### 查看已设置的 Secret

```bash
wrangler secret list
```

## 验证部署

### 1. 健康检查

```bash
curl https://your-worker.workers.dev/api/health
```

预期响应：

```json
{
  "status": "healthy",
  "checks": {
    "db": true,
    "kv": true,
    "r2": true
  },
  "timestamp": "2025-12-15T10:00:00.000Z"
}
```

### 2. API 测试

```bash
# 测试 API 端点
curl https://your-worker.workers.dev/api/v2/version
```

### 3. 查看日志

```bash
# 实时查看日志
wrangler tail

# 查看特定时间的日志
wrangler tail --since 1h
```

## 回滚流程

### 1. 查看部署历史

```bash
# 查看 Workers 部署历史（通过 Cloudflare Dashboard）
# 或使用 wrangler 命令
wrangler deployments list
```

### 2. 回滚到上一个版本

```bash
# 通过 Cloudflare Dashboard 回滚
# 1. 登录 Cloudflare Dashboard
# 2. 进入 Workers & Pages
# 3. 选择你的 Worker
# 4. 点击 "Deployments"
# 5. 选择要回滚的版本
# 6. 点击 "Promote to Production"
```

### 3. 数据库回滚（如果需要）

```bash
# 手动执行回滚迁移（如果有）
wrangler d1 execute caiwu-db --remote --file=src/db/migration_rollback_xxx.sql
```

**注意**: 数据库回滚需要谨慎操作，建议先备份数据。

## 监控与告警

### Cloudflare Dashboard

1. **Workers 监控**
   - 请求数量
   - 错误率
   - 响应时间
   - CPU 时间使用

2. **D1 数据库监控**
   - 查询数量
   - 查询时间
   - 错误率

3. **R2 存储监控**
   - 存储使用量
   - 请求数量
   - 带宽使用

### 设置告警

1. 登录 Cloudflare Dashboard
2. 进入 "Notifications"
3. 创建新的通知规则
4. 配置告警条件（如错误率 > 5%）

### 健康检查端点

系统提供 `/api/health` 端点，可以配置外部监控服务定期检查：

```bash
# 示例：每分钟检查一次
*/1 * * * * curl -f https://your-worker.workers.dev/api/health || alert
```

## 常见问题

### 1. 部署失败：认证错误

```bash
# 重新登录
wrangler login
```

### 2. 数据库连接失败

- 检查 `wrangler.toml` 中的数据库配置
- 确认数据库 ID 正确
- 检查数据库是否已创建

### 3. Secret 未设置

```bash
# 查看已设置的 Secret
wrangler secret list

# 设置缺失的 Secret
wrangler secret put SECRET_NAME
```

### 4. 迁移失败

- 检查迁移文件语法
- 查看迁移历史确认是否已执行
- 检查数据库权限

## 最佳实践

1. **部署前检查**
   - ✅ 运行所有测试
   - ✅ 代码检查通过
   - ✅ 类型检查通过
   - ✅ 迁移状态检查

2. **部署策略**
   - 使用预览环境先测试
   - 灰度发布（如果支持）
   - 监控部署后的指标

3. **回滚准备**
   - 保留上一个版本的代码
   - 记录数据库迁移历史
   - 准备回滚脚本

4. **监控告警**
   - 设置关键指标告警
   - 定期检查日志
   - 监控错误率

## 更新记录

- 2025-12-15: 初始版本

