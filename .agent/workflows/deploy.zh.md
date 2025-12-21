---
description: Deploy the application to Cloudflare
---
# 部署工作流

本工作流基于 `DEPLOY.md`，用于将应用部署到 Cloudflare 生产环境。

## 1. 数据库迁移

**重要**: 部署前必须确保数据库 Schema 是最新的。

```bash
cd backend
# 检查迁移状态
npm run migrate:check

# 应用迁移 (生产环境)
npm run migrate:up
```

## 2. 设置环境变量 (如果需要)

如果引入了新的环境变量，需通过 `wrangler secret` 设置：

```bash
cd backend
# 示例: wrangler secret put NEW_SECRET
```

## 3. 部署后端

```bash
cd backend
// turbo
npm run deploy
```

## 4. 部署前端

```bash
cd frontend
# 构建
npm run build

# 部署 (通常通过 Cloudflare Pages 自动集成，手动部署如下)
# npx wrangler pages deploy dist --project-name=your-project
```

## 5. 验证部署

1. 访问生产环境 URL。
2. 登录测试账户。
3. 验证关键功能 (如创建单据)。
4. 查看 Cloudflare Dashboard 日志确认无报错。
